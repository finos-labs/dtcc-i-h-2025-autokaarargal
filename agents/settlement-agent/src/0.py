import json 
import boto3
import pymysql
from decimal import Decimal
from datetime import datetime

# Aurora DB credentials
db_host = 'trades-market.cluster-cdya8kk4eoa1.us-west-2.rds.amazonaws.com'
db_user = 'admin'
db_password = 'DTCC2025'
db_port = 3306
db_name = 'trades_market'
table_name = 'trades_data'
log_table = 'trade_log'

# S3 output configuration
s3 = boto3.client('s3')
s3_bucket = 'settlement-bucket-result'  # your bucket
s3_prefix = 'settlement-results/'

def lambda_handler(event, context):
    conn = None
    cursor = None
    settlement_logs = []

    try:
        conn = pymysql.connect(
            host=db_host,
            user=db_user,
            passwd=db_password,
            db=db_name,
            port=db_port,
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False
        )
        cursor = conn.cursor()
        print("✅ Connected to Aurora DB")

        cursor.execute(f"SELECT * FROM {table_name} WHERE status = 'RCND'")
        trades = cursor.fetchall()

        for trade in trades:
            trade_id = trade["trade_id"]
            broker_id = trade["broker_id"]
            contra_broker_id = trade["contra_broker_id"]
            ticker = trade["ticker"]
            quantity = trade["quantity"]
            price = trade["price"]
            status = "SETTLED"
            error = ""

            # Simulated rules — fail if price or quantity is 0
            if not price or not quantity or price <= 0 or quantity <= 0:
                status = "FAILED"
                error = "Invalid price or quantity"

            # Update trade status
            cursor.execute(f"UPDATE {table_name} SET status = %s WHERE trade_id = %s", (status, trade_id))

            # Log entry — only trade_id, status, time (no 'message' column assumed)
            cursor.execute(f"""
                INSERT INTO {log_table} (trade_id, status, settled_at)
                VALUES (%s, %s, %s)
            """, (trade_id, status, datetime.utcnow()))

            settlement_logs.append({
                "trade_id": trade_id,
                "broker_id": broker_id,
                "contra_broker_id": contra_broker_id,
                "ticker": ticker,
                "quantity": quantity,
                "price": str(price),
                "status": status,
                "error": error
            })

        conn.commit()

        # Upload result to S3
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        s3_key = f"{s3_prefix}settlement_result_{timestamp}.json"
        s3.put_object(
            Bucket=s3_bucket,
            Key=s3_key,
            Body=json.dumps(settlement_logs, indent=2),
            ContentType="application/json"
        )
        print(f"✅ Settlement log uploaded to s3://{s3_bucket}/{s3_key}")

        return {
            "statusCode": 200,
            "body": json.dumps(settlement_logs),
            "headers": {"Content-Type": "application/json"}
        }

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {"Content-Type": "application/json"}
        }

    finally:
        if cursor: cursor.close()
        if conn: conn.close()     