import pymysql
import os
import json
from decimal import Decimal
from datetime import datetime

# Database config from environment variables
db = {
    'host': os.environ['DB_HOST'],
    'user': os.environ['DB_USER'],
    'password': os.environ['DB_PASSWORD'],
    'db': os.environ['DB_NAME'],
    'port': int(os.environ.get('DB_PORT', 3306))
}

def connect(config):
    return pymysql.connect(
        host=config['host'],
        user=config['user'],
        passwd=config['password'],
        db=config['db'],
        port=config['port'],
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor
    )

def lambda_handler(event, context):
    conn = connect(db)
    cursor = conn.cursor()

    try:
        # Step 1: Fetch all MTCH trades
        cursor.execute("SELECT * FROM trades_data WHERE status='MTCH'")
        matched_trades = cursor.fetchall()

        reconciled = 0
        skipped = 0
        timestamp = datetime.utcnow()

        for trade in matched_trades:
            trade_id = trade['trade_id']

            # Step 2: Fetch all dtcc_data rows with this trade_id
            cursor.execute("SELECT * FROM dtcc_data WHERE trade_id = %s", (trade_id,))
            dtcc_trades = cursor.fetchall()

            if not dtcc_trades:
                # Log missing trade in DTCC with ERR3
                cursor.execute("""
                    INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    trade_id,
                    "ERR3",
                    json.dumps(["Not found in dtcc_data"]),
                    timestamp
                ))
                continue

            # Step 3: Try to find exact match including order_type
            exact_match = None
            fields_to_check = ['ticker', 'quantity', 'price', 'date', 'order_type']
            for dtcc in dtcc_trades:
                match = True
                for field in fields_to_check:
                    v1 = str(trade[field]) if field != 'price' else str(Decimal(trade[field]))
                    v2 = str(dtcc[field]) if field != 'price' else str(Decimal(dtcc[field]))
                    if v1 != v2:
                        match = False
                        break
                if match:
                    exact_match = dtcc
                    break

            if exact_match:
                # Step 4: Update both tables to RCND and log success
                cursor.execute("UPDATE trades_data SET status='RCND' WHERE trade_id=%s", (trade_id,))
                cursor.execute("UPDATE dtcc_data SET status='RCND' WHERE trade_id=%s", (trade_id,))
                cursor.execute("""
                    INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    trade_id,
                    "RCND",
                    json.dumps([]),
                    timestamp
                ))
                reconciled += 1
                continue

            # Step 5: Check if mismatch is only in order_type
            partial_match_found = False
            for dtcc in dtcc_trades:
                match = True
                for field in ['ticker', 'quantity', 'price', 'date']:  # excluding order_type
                    v1 = str(trade[field]) if field != 'price' else str(Decimal(trade[field]))
                    v2 = str(dtcc[field]) if field != 'price' else str(Decimal(dtcc[field]))
                    if v1 != v2:
                        match = False
                        break
                if match:
                    partial_match_found = True
                    break

            if partial_match_found:
                # Log as SKIP (order_type mismatch only)
                cursor.execute("""
                    INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    trade_id,
                    "SKIP",
                    json.dumps(["Order type mismatch only, skipped reconciliation"]),
                    timestamp
                ))
                skipped += 1
                continue

            # Step 6: Log mismatch in trade_log with ERR3
            errors = []
            reference_dtcc = dtcc_trades[0]
            for field in fields_to_check:
                v1 = str(trade[field]) if field != 'price' else str(Decimal(trade[field]))
                v2 = str(reference_dtcc[field]) if field != 'price' else str(Decimal(reference_dtcc[field]))
                if v1 != v2:
                    errors.append(f"Mismatch in {field}: trades_data='{v1}' vs dtcc_data='{v2}'")

            cursor.execute("""
                INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                VALUES (%s, %s, %s, %s)
            """, (
                trade_id,
                "ERR3",
                json.dumps(errors),
                timestamp
            ))

        conn.commit()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "reconciled_count": reconciled,
                "skipped_order_type_mismatch": skipped,
                "mismatches_logged": len(matched_trades) - reconciled - skipped
            }),
            "headers": {
                "Content-Type": "application/json"
            }
        }

    except Exception as e:
        conn.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

    finally:
        cursor.close()
        conn.close()
