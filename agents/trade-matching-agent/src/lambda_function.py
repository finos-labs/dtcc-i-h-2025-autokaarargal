import pymysql
import os
from datetime import datetime
from decimal import Decimal
import json

# Aurora DB config
db_host = os.environ.get("DB_HOST")
db_user = os.environ.get("DB_USER")
db_password = os.environ.get("DB_PASSWORD")
db_name = os.environ.get("DB_NAME")
db_port = int(os.environ.get("DB_PORT", "3306"))

def lambda_handler(event, context):
    conn = pymysql.connect(
        host=db_host,
        user=db_user,
        passwd=db_password,
        db=db_name,
        port=db_port,
        autocommit=False
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    try:
        cursor.execute("SELECT * FROM trades_data WHERE status = 'UMAT'")
        trades = cursor.fetchall()

        matched_ids = set()
        timestamp = datetime.utcnow()

        for i, t1 in enumerate(trades):
            if t1['trade_id'] in matched_ids:
                continue

            matched = False

            for j in range(i + 1, len(trades)):
                t2 = trades[j]
                if t2['trade_id'] in matched_ids:
                    continue

                if t1['trade_id'] != t2['trade_id']:
                    continue  # Skip, not the same trade_id

                # Now trade_id matches, so validate fields
                errors = []

                if t1['ticker'] != t2['ticker']:
                    errors.append("Mismatched ticker")
                if Decimal(t1['price']) != Decimal(t2['price']):
                    errors.append("Mismatched price")
                if t1['quantity'] != t2['quantity']:
                    errors.append("Mismatched quantity")
                if t1['date'] != t2['date']:
                    errors.append("Mismatched date")
                if t1['order_type'] == t2['order_type']:
                    errors.append("Same order_type")
                if t1['broker_id'] != t2['contra_broker_id']:
                    errors.append("broker_id ≠ contra_broker_id")
                if t1['contra_broker_id'] != t2['broker_id']:
                    errors.append("contra_broker_id ≠ broker_id")

                matched_ids.update([t1['trade_id'], t2['trade_id']])

                if not errors:
                    # Update both as MTCH
                    for tid in [t1['trade_id'], t2['trade_id']]:
                        cursor.execute("UPDATE trades_data SET status='MTCH' WHERE trade_id=%s", (tid,))
                        cursor.execute("""
                            INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                            VALUES (%s, %s, %s, %s)
                        """, (
                            tid, "MTCH", json.dumps([]), timestamp
                        ))
                else:
                    # Field mismatch for matched ID — log ERR2
                    for tid in [t1['trade_id'], t2['trade_id']]:
                        cursor.execute("UPDATE trades_data SET status='ERR2' WHERE trade_id=%s", (tid,))
                        cursor.execute("""
                            INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                            VALUES (%s, %s, %s, %s)
                        """, (
                            tid, "ERR2", json.dumps(errors), timestamp
                        ))

                matched = True
                break

            if not matched:
                # No matching trade_id found in the rest — UNMT
                cursor.execute("UPDATE trades_data SET status='UNMT' WHERE trade_id=%s", (t1['trade_id'],))
                cursor.execute("""
                    INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    t1['trade_id'], "UNMT", json.dumps(["No matching trade_id found"]), timestamp
                ))

        conn.commit()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "logs_written": len(trades),
                "matched_trades": len(matched_ids) // 2
            }),
            "headers": {
                "Content-Type": "application/json"
            }
        }

    except Exception as e:
        conn.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {
                "Content-Type": "application/json"
            }
        }

    finally:
        cursor.close()
        conn.close()
