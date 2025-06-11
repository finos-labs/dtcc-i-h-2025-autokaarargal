import json
import boto3
import pymysql
from datetime import datetime
import os
from decimal import Decimal

# S3 + Aurora Config
s3 = boto3.client('s3')
BUCKET = 'verification-agent-bucket'

# Environment variables for DB connection
db_host = os.environ.get("DB_HOST")
db_user = os.environ.get("DB_USER")
db_password = os.environ.get("DB_PASSWORD")
db_name = os.environ.get("DB_NAME")
db_port = int(os.environ.get("DB_PORT", "3306"))

def load_json_from_s3(key):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    return json.loads(obj['Body'].read())

def validate_trade(trade, rules, reference_prices, holidays, instruments):
    errors = []

    # 1. Instrument validity
    if trade["ticker"] not in instruments:
        errors.append("Invalid instrument")

    # 2. Broker checks
    if trade["broker_id"] in rules["approved_brokers"]:
        errors.append("Invalid broker_id")
    if trade["contra_broker_id"] in rules["approved_contra_brokers"]:
        errors.append("Invalid contra_broker_id")

    # 3. Price validation
    if rules["price_validation"]["enabled"]:
        ref_price = reference_prices.get(trade["ticker"])
        if ref_price is not None:
            ref_price = Decimal(str(ref_price))
            trade_price = Decimal(str(trade["price"]))
            allowed_deviation = ref_price * Decimal(rules["price_deviation_pct"]) / Decimal(100)

            if abs(trade_price - ref_price) > allowed_deviation:
                errors.append("Price out of allowed range")
        else:
            errors.append("Reference price not found")

    # 4. Order type check
    if trade["order_type"] not in rules["valid_order_types"]:
        errors.append("Invalid order_type")

    # 5. Holiday check
    trade_date = trade["date"].strftime('%Y-%m-%d')
    if trade_date in holidays:
        errors.append("Trade date falls on a holiday")

    return "UMAT" if not errors else "ERROR", errors

def lambda_handler(event, context):
    try:
        # Load rule and reference data
        rules = load_json_from_s3('rules.json')
        holidays = rules.get("holidays", [])
        reference_prices = rules.get("price_validation", {}).get("reference_prices", {})
        instruments = list(reference_prices.keys())

        # DB connection
        conn = pymysql.connect(
            host=db_host,
            user=db_user,
            passwd=db_password,
            db=db_name,
            port=db_port,
            autocommit=False
        )
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Fetch trades needing validation
        cursor.execute("SELECT * FROM trades_data WHERE status = ''")
        trades = cursor.fetchall()
        verification_logs = []

        for trade in trades:
            status, errors = validate_trade(trade, rules, reference_prices, holidays, instruments)

            # Log validation
            cursor.execute("""
                INSERT INTO trade_verification_log (trade_id, status, errors, verified_at)
                VALUES (%s, %s, %s, %s)
            """, (
                trade["trade_id"],
                status,
                json.dumps(errors),
                datetime.utcnow()
            ))

            # Update trade status
            cursor.execute("UPDATE trades_data SET status=%s WHERE trade_id=%s", (status, trade["trade_id"]))

            verification_logs.append({
                "trade_id": trade["trade_id"],
                "status": status,
                "errors": errors
            })

        conn.commit()

        return {
            "statusCode": 200,
            "body": json.dumps(verification_logs),
            "headers": {"Content-Type": "application/json"}
        }

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error verifying trades: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {"Content-Type": "application/json"}
        }

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close() 