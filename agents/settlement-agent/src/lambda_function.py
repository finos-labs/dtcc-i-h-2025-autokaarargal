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
        # Fetch reconciled trades ready for settlement
        cursor.execute("""
            SELECT t1.trade_id, t1.broker_id, t1.contra_broker_id, t1.ticker, 
                   t1.quantity, t1.price, t1.date, t1.order_type,
                   t2.trade_id as contra_trade_id
            FROM trades_data t1
            JOIN trades_data t2 ON t1.trade_id = t2.trade_id 
                               AND t1.broker_id = t2.contra_broker_id 
                               AND t2.broker_id = t1.contra_broker_id
            WHERE t1.status = 'RCND' AND t2.status = 'RCND'
              AND t1.broker_id < t2.broker_id
        """)
        trades = cursor.fetchall()

        timestamp = datetime.utcnow()
        settled_count = 0
        failed_count = 0

        for trade in trades:
            trade_id = trade['trade_id']
            contra_trade_id = trade['contra_trade_id']
            errors = []

            try:
                if Decimal(str(trade['price'])) <= 0:
                    errors.append("Invalid price (must be positive)")
                if trade['quantity'] <= 0:
                    errors.append("Invalid quantity (must be positive)")
            except Exception as e:
                errors.append(f"Validation error: {str(e)}")

            new_status = 'STLD' if not errors else 'ERR5'

            # Update both trades
            for tid in [trade_id, contra_trade_id]:
                cursor.execute("UPDATE trades_data SET status = %s WHERE trade_id = %s", (new_status, tid))
                cursor.execute("""
                    INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    tid,
                    new_status,
                    json.dumps(errors) if errors else None,
                    timestamp
                ))

            if not errors:
                settled_count += 2
            else:
                failed_count += 2

        conn.commit()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Settlement completed",
                "total_trades_processed": len(trades) * 2,
                "successful_settlements": settled_count,
                "failed_settlements": failed_count
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
