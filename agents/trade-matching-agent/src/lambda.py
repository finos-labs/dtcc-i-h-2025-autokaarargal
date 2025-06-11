import pymysql
import os

# Aurora DB config
db_host = 'trades-market.cluster-cdya8kk4eoa1.us-west-2.rds.amazonaws.com'
db_user = 'admin'
db_password = 'DTCC2025'
db_name = 'trades_data'
db_port = 3306

def lambda_handler(event, context):
    # Connect to Aurora
    conn = pymysql.connect(
        host=db_host, user=db_user,
        passwd=db_password, db=db_name,
        port=db_port, autocommit=False
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    try:
        # Fetch all unmatched trades
        cursor.execute("SELECT * FROM trades WHERE status = 'UMAT'")
        trades = cursor.fetchall()
        
        matched_ids = set()

        for i, t1 in enumerate(trades):
            if t1['trade_id'] in matched_ids:
                continue

            for j in range(i + 1, len(trades)):
                t2 = trades[j]

                # Skip already matched
                if t2['trade_id'] in matched_ids:
                    continue

                # Rule: Same ticker, quantity, date; opposite order_type
                if (
                    t1['ticker'] == t2['ticker'] and
                    t1['quantity'] == t2['quantity'] and
                    t1['date'] == t2['date'] and
                    t1['order_type'] != t2['order_type']
                ):
                    # Update both trades to MTCH
                    cursor.execute("UPDATE trades SET status='MTCH' WHERE trade_id=%s", (t1['trade_id'],))
                    cursor.execute("UPDATE trades SET status='MTCH' WHERE trade_id=%s", (t2['trade_id'],))
                    matched_ids.update([t1['trade_id'], t2['trade_id']])
                    break  # Go to next t1

        conn.commit()
        result = {
            "matched_count": len(matched_ids) // 2,
            "unmatched_count": len(trades) - len(matched_ids)
        }

    except Exception as e:
        conn.rollback()
        print(f"Error during matching: {e}")
        result = {"error": str(e)}
    
    finally:
        cursor.close()
        conn.close()

    return result
