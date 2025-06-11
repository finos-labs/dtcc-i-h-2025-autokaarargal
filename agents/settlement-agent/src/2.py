import pymysql
import os
from datetime import datetime
from decimal import Decimal
import json
import boto3

def lambda_handler(event, context):
    # Validate environment variables first
    required_env_vars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "SETTLEMENT_BUCKET"]
    missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
    
    if missing_vars:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": f"Missing required environment variables: {', '.join(missing_vars)}"
            }),
            "headers": {
                "Content-Type": "application/json"
            }
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

    # S3 config
    s3_bucket = os.environ["SETTLEMENT_BUCKET"]
    s3_prefix = os.environ.get("SETTLEMENT_PREFIX", "settlement-results/")

    try:
        conn = pymysql.connect(**db_config)
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        s3 = boto3.client('s3')
        
        settlement_results = []
        timestamp = datetime.utcnow()

        # Get all matched trades ready for settlement
        cursor.execute("""
            SELECT t1.trade_id, t1.broker_id, t1.contra_broker_id, t1.ticker, 
                   t1.quantity, t1.price, t1.date, t1.order_type,
                   t2.trade_id as contra_trade_id
            FROM trades_data t1
            JOIN trades_data t2 ON t1.trade_id = t2.trade_id 
                               AND t1.broker_id = t2.contra_broker_id 
                               AND t2.broker_id = t1.contra_broker_id
            WHERE t1.status = 'RCND' AND t2.status = 'RCND'
              AND t1.broker_id < t2.broker_id  # Ensure we process each pair only once
        """)
        trades = cursor.fetchall()

        for trade in trades:
            trade_id = trade['trade_id']
            contra_trade_id = trade['contra_trade_id']
            errors = []
            
            # Validate trade details before settlement
            try:
                if Decimal(str(trade['price'])) <= 0:  # Ensure price is converted to string first
                    errors.append("Invalid price (must be positive)")
                if trade['quantity'] <= 0:
                    errors.append("Invalid quantity (must be positive)")
            except Exception as e:
                errors.append(f"Validation error: {str(e)}")
            
            if not errors:
                new_status = 'STLD'  # Settlement successful
            else:
                new_status = 'ERR5'  # Settlement failed
            
            # Update status only in trades_data for both trades in the pair
            for tid in [trade_id, contra_trade_id]:
                cursor.execute("""
                    UPDATE trades_data 
                    SET status = %s
                    WHERE trade_id = %s
                """, (new_status, tid))
                
                # Insert into trade_log with only the required fields
                cursor.execute("""
                    INSERT INTO trade_log 
                    (trade_id, status, errors, check_timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    tid,
                    new_status,
                    json.dumps(errors) if errors else None,
                    timestamp
                ))
            
            # Prepare settlement result record
            settlement_results.append({
                'trade_id': trade_id,
                'contra_trade_id': contra_trade_id,
                'ticker': trade['ticker'],
                'quantity': trade['quantity'],
                'price': str(trade['price']),
                'trade_date': trade['date'].isoformat() if trade['date'] else None,
                'broker_id': trade['broker_id'],
                'contra_broker_id': trade['contra_broker_id'],
                'status': new_status,
                'errors': errors,
                'settlement_time': timestamp.isoformat()
            })

        conn.commit()
        
        # Upload settlement results to S3 if there are any
        if settlement_results:
            s3_key = f"{s3_prefix}settlement_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"
            try:
                s3.put_object(
                    Bucket=s3_bucket,
                    Key=s3_key,
                    Body=json.dumps(settlement_results, indent=2),
                    ContentType='application/json'
                )
                s3_location = f"s3://{s3_bucket}/{s3_key}"
            except Exception as e:
                return {
                    "statusCode": 500,
                    "body": json.dumps({
                        "error": f"Failed to upload to S3: {str(e)}",
                        "settlement_data": settlement_results
                    }),
                    "headers": {
                        "Content-Type": "application/json"
                    }
                }
        else:
            s3_location = None

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Settlement processing complete",
                "settled_trades": len(trades) * 2,
                "successful_settlements": len([r for r in settlement_results if r['status'] == 'STLD']),
                "failed_settlements": len([r for r in settlement_results if r['status'] == 'ERR5']),
                "s3_location": s3_location
            }),
            "headers": {
                "Content-Type": "application/json"
            }
        }

    except pymysql.MySQLError as e:
        if 'conn' in locals():
            conn.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": f"Database error: {str(e)}",
                "type": "MySQL"
            }),
            "headers": {
                "Content-Type": "application/json"
            }
        }
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e),
                "type": "General"
            }),
            "headers": {
                "Content-Type": "application/json"
            }
        }
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()