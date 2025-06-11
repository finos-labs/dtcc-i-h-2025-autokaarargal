import pymysql
import os
import json
from decimal import Decimal
from datetime import datetime

# Environment configs
db1 = {
    'host': os.environ['DB1_HOST'],
    'user': os.environ['DB1_USER'],
    'password': os.environ['DB1_PASSWORD'],
    'db': os.environ['DB1_NAME'],
    'port': int(os.environ.get('DB_PORT', 3306))
}

db2 = {
    'host': os.environ['DB2_HOST'],
    'user': os.environ['DB2_USER'],
    'password': os.environ['DB2_PASSWORD'],
    'db': os.environ['DB2_NAME'],
    'port': int(os.environ.get('DB_PORT', 3306))
}

def connect(config):
    return pymysql.connect(
        host=config['host'], user=config['user'],
        passwd=config['password'], db=config['db'],
        port=config['port'], autocommit=False,
        cursorclass=pymysql.cursors.DictCursor
    )

def lambda_handler(event, context):
    conn1 = connect(db1)
    conn2 = connect(db2)
    cursor1 = conn1.cursor()
    cursor2 = conn2.cursor()

    try:
        cursor1.execute("SELECT * FROM trades")
        trades_db1 = {t['trade_id']: t for t in cursor1.fetchall()}

        cursor2.execute("SELECT * FROM trades")
        trades_db2 = {t['trade_id']: t for t in cursor2.fetchall()}

        reconciled = 0
        logs = []

        for trade_id, t1 in trades_db1.items():
            t2 = trades_db2.get(trade_id)

            if not t2:
                logs.append((trade_id, ["Missing in DB2"]))
                continue

            errors = []
            fields = ['ticker', 'quantity', 'price', 'date', 'order_type']
            for field in fields:
                v1 = str(t1[field]) if field != 'price' else str(Decimal(t1[field]))
                v2 = str(t2[field]) if field != 'price' else str(Decimal(t2[field]))
                if v1 != v2:
                    errors.append(f"Mismatch in {field}: DB1='{v1}' DB2='{v2}'")

            if not errors:
                cursor1.execute("UPDATE trades SET status='RECONCILED' WHERE trade_id=%s", (trade_id,))
                cursor2.execute("UPDATE trades SET status='RECONCILED' WHERE trade_id=%s", (trade_id,))
                reconciled += 1
            else:
                logs.append((trade_id, errors))

        # Insert logs
        for trade_id, error_fields in logs:
            cursor1.execute("""
                INSERT INTO trade_reconciliation_log (trade_id, error_fields, logged_at)
                VALUES (%s, %s, %s)
            """, (trade_id, json.dumps(error_fields), datetime.utcnow()))

            cursor2.execute("""
                INSERT INTO trade_reconciliation_log (trade_id, error_fields, logged_at)
                VALUES (%s, %s, %s)
            """, (trade_id, json.dumps(error_fields), datetime.utcnow()))

        conn1.commit()
        conn2.commit()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "reconciled_count": reconciled,
                "mismatches_logged": len(logs)
            })
        }

    except Exception as e:
        conn1.rollback()
        conn2.rollback()
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

    finally:
        cursor1.close()
        cursor2.close()
        conn1.close()
        conn2.close()
