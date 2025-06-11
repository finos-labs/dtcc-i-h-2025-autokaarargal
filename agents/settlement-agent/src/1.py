import pymysql
import os
from datetime import datetime
from decimal import Decimal
import json
import boto3

# Aurora DB config
db_host = os.environ.get("DB_HOST")
db_user = os.environ.get("DB_USER")
db_password = os.environ.get("DB_PASSWORD")
db_name = os.environ.get("DB_NAME")
db_port = int(os.environ.get("DB_PORT", "3306"))

# S3 config
s3_bucket = os.environ.get("SETTLEMENT_BUCKET")
s3_prefix = os.environ.get("SETTLEMENT_PREFIX", "settlement-results/")

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
    s3 = boto3.client('s3')
    
    settlement_results = []
    timestamp = datetime.utcnow()

    try:
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
            if Decimal(trade['price']) <= 0:
                errors.append("Invalid price (must be positive)")
            if trade['quantity'] <= 0:
                errors.append("Invalid quantity (must be positive)")
            
            if not errors:
                # Settlement successful
                new_status = 'STLD'
                
                # Update both trades in the pair
                for tid in [trade_id, contra_trade_id]:
                    cursor.execute("""
                        UPDATE trades_data 
                        SET status = %s, settled_at = %s
                        WHERE trade_id = %s
                    """, (new_status, timestamp, tid))
                    
                    # Log settlement
                    cursor.execute("""
                        INSERT INTO trade_log (trade_id, status, check_timestamp)
                        VALUES (%s, %s, %s)
                    """, (tid, new_status, timestamp))
            else:
                # Settlement failed
                new_status = 'ERR5'
                
                for tid in [trade_id, contra_trade_id]:
                    cursor.execute("""
                        UPDATE trades_data 
                        SET status = %s
                        WHERE trade_id = %s
                    """, (new_status, tid))
                    
                    # Log failure with errors
                    cursor.execute("""
                        INSERT INTO trade_log (trade_id, status, errors, check_timestamp)
                        VALUES (%s, %s, %s, %s)
                    """, (tid, new_status, json.dumps(errors), timestamp))
            
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
        
        # Upload settlement results to S3
        if settlement_results:
            s3_key = f"{s3_prefix}settlement_{timestamp.strftime('%Y%m%d_%H%M%S')}.json"
            s3.put_object(
                Bucket=s3_bucket,
                Key=s3_key,
                Body=json.dumps(settlement_results, indent=2),
                ContentType='application/json'
            )

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Settlement processing complete",
                "settled_trades": len(trades) * 2,  # Count both sides of each trade
                "successful_settlements": len([r for r in settlement_results if r['status'] == 'STLD']),
                "failed_settlements": len([r for r in settlement_results if r['status'] == 'FLSD']),
                "s3_location": f"s3://{s3_bucket}/{s3_key}" if settlement_results else None
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