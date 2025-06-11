import pymysql
import os
from datetime import datetime
from decimal import Decimal
import json

def lambda_handler(event, context):
    # Validate environment variables
    required_env_vars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
    
    if missing_vars:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": f"Missing required environment variables: {', '.join(missing_vars)}"
            }),
            "headers": {"Content-Type": "application/json"}
        }

    # Aurora DB config
    db_config = {
        "host": os.environ["DB_HOST"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
        "db": os.environ["DB_NAME"],
        "port": int(os.environ.get("DB_PORT", "3306")),
        "autocommit": False
    }

    try:
        conn = pymysql.connect(**db_config)
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        timestamp = datetime.utcnow()
        successful_settlements = 0
        failed_settlements = 0

        # Get all matched trades ready for settlement
        cursor.execute("""
            SELECT t1.trade_id, t1.broker_id, t1.contra_broker_id, t1.ticker, 
                   t1.quantity, t1.price, t1.date, t1.order_type,
                   t2.trade_id AS contra_trade_id
            FROM trades_data t1
            JOIN trades_data t2 ON t1.trade_id = t2.trade_id 
                               AND t1.broker_id = t2.contra_broker_id 
                               AND t2.broker_id = t1.contra_broker_id
            WHERE t1.status = 'RCND' AND t2.status = 'RCND'
              AND t1.broker_id < t2.broker_id  -- Process each pair only once
        """)
        trades = cursor.fetchall()

        for trade in trades:
            trade_id = trade['trade_id']
            contra_trade_id = trade['contra_trade_id']
            errors = []
            
            # Validate trade details
            try:
                if Decimal(str(trade['price'])) <= 0:
                    errors.append("Invalid price (must be positive)")
                if trade['quantity'] <= 0:
                    errors.append("Invalid quantity (must be positive)")
            except Exception as e:
                errors.append(f"Validation error: {str(e)}")
            
            status = 'STLD' if not errors else 'ERR5'
            count_update = 2 if not errors else 0
            successful_settlements += count_update
            failed_settlements += 2 - count_update

            # Update status for both trades in the pair
            for tid in [trade_id, contra_trade_id]:
                cursor.execute("""
                    UPDATE trades_data 
                    SET status = %s
                    WHERE trade_id = %s
                """, (status, tid))
                
                # Log settlement result
                cursor.execute("""
                    INSERT INTO trade_log 
                    (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    tid,
                    status,
                    json.dumps(errors) if errors else None,
                    timestamp
                ))

        conn.commit()
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Settlement processing complete",
                "settled_trades": len(trades) * 2,
                "successful_settlements": successful_settlements,
                "failed_settlements": failed_settlements
            }),
            "headers": {"Content-Type": "application/json"}
        }

    except pymysql.MySQLError as e:
        if 'conn' in locals():
            conn.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Database error: {str(e)}"}),
            "headers": {"Content-Type": "application/json"}
        }
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {"Content-Type": "application/json"}
        }
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()