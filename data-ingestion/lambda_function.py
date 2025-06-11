import json
import requests
import pymysql
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def create_and_insert_table(cursor, table_name, data):
    """
    Create table if not exists and insert data into it.
    Ensures unique (trade_id, order_type) pairs.
    Returns the number of inserted and skipped records.
    """
    # Create table with unique constraint
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            trade_id VARCHAR(100),
            broker_id VARCHAR(100),
            contra_broker_id VARCHAR(100),
            ticker VARCHAR(50),
            order_type VARCHAR(20),
            quantity INT,
            price DECIMAL(18, 4),
            date DATE,
            trade_timestamp DATETIME,
            status VARCHAR(50) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_trade_order (trade_id, order_type)
        )
    """)
    logger.info(f"Table {table_name} created or already exists with unique (trade_id, order_type) constraint.")

    # Prepare insert query with IGNORE for duplicates
    insert_query = f"""
        INSERT IGNORE INTO {table_name} (
            trade_id, broker_id, contra_broker_id, ticker,
            order_type, quantity, price, date, trade_timestamp, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    inserted_count = 0
    skipped_count = 0
    for record in data:
        try:
            result = cursor.execute(insert_query, (
                record['trade_id'],
                record['broker_id'],
                record['contra_broker_id'],
                record['ticker'],
                record['order_type'],
                int(record['quantity']),
                float(record['price']),
                record['date'],
                record['trade_timestamp'],
                ""  # status column default
            ))
            if result == 1:
                inserted_count += 1
            else:
                skipped_count += 1
                logger.info(f"Skipped duplicate: {record['trade_id']} - {record['order_type']}")
        except Exception as e:
            logger.warning(f"Failed to insert into {table_name} for trade_id {record.get('trade_id')}: {str(e)}")
    return inserted_count, skipped_count

def lambda_handler(event, context):
    """
    Lambda function that:
    1. Fetches trade data from API
    2. Stores structured records in MySQL tables 'trades_data' and 'dtcc_data'
    Ensures unique (trade_id, order_type) pairs.
    """
    # 1. Fetch data from API
    api_url = "https://trades-backend-8kxo.onrender.com/get_records"
    try:
        logger.info("Fetching data from API...")
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        data = response.json()

        logger.info(f"Successfully fetched {len(data)} records from API")
        if not data:
            return {
                'statusCode': 200,
                'body': json.dumps('No records received from API')
            }

        logger.info(f"First record keys: {list(data[0].keys())}")

    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'API request failed: {str(e)}')
        }

    # 2. Connect to RDS and insert structured records into both tables
    conn = None
    inserted_counts = {}
    skipped_counts = {}
    try:
        logger.info("Connecting to RDS database...")
        conn = pymysql.connect(
            host='trades-market.cluster-cdya8kk4eoa1.us-west-2.rds.amazonaws.com',
            user='admin',
            password='DTCC2025',
            database='trades_market',
            connect_timeout=10
        )

        with conn.cursor() as cursor:
            logger.info("Database connection established")

            # Insert into both tables
            for table_name in ["trades_data", "dtcc_data"]:
                logger.info(f"Creating and inserting into {table_name}...")
                inserted, skipped = create_and_insert_table(cursor, table_name, data)
                inserted_counts[table_name] = inserted
                skipped_counts[table_name] = skipped
                logger.info(f"Inserted {inserted} records into {table_name}. Skipped {skipped} duplicates.")

            conn.commit()
            logger.info(f"Successfully inserted records into both tables.")

    except pymysql.MySQLError as e:
        logger.error(f"Database error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Database operation failed: {str(e)}')
        }
    finally:
        if conn and conn.open:
            conn.close()
            logger.info("Database connection closed")

    # Return result
    return {
        'statusCode': 200,
        'body': json.dumps({
            'status': 'success',
            'message': 'Structured records stored successfully in both tables.',
            'records_received': len(data),
            'records_stored': inserted_counts,
            'records_skipped': skipped_counts,
            'duplicate_handling': 'INSERT IGNORE with UNIQUE (trade_id, order_type)',
            'execution_time_ms': context.get_remaining_time_in_millis(),
            'first_record_keys': list(data[0].keys()) if data else None
        })
    }
