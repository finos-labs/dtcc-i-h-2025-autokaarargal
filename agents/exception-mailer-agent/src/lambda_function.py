import os
import mysql.connector
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# --- FETCH TRADES FROM DB ---
def fetch_trades():
    try:
        conn = mysql.connector.connect(
            host=os.environ['DB_HOST'],
            user=os.environ['DB_USER'],
            password=os.environ['DB_PASSWORD'],
            database=os.environ['DB_NAME'],
            port=int(os.environ.get('DB_PORT', 3306))
        )
        cursor = conn.cursor(dictionary=True)

        query = "SELECT trade_id, errors, check_timestamp FROM trade_log;"
        cursor.execute(query)
        results = cursor.fetchall()

        cursor.close()
        conn.close()
        return results
    except mysql.connector.Error as err:
        print(f"❌ Database error: {err}")
        return []

# --- SEND EMAIL NOTIFICATION ---
def send_email(trades):
    sender_email = os.environ['SENDER_EMAIL']
    receiver_email = os.environ['RECEIVER_EMAIL']
    email_password = os.environ['EMAIL_PASSWORD']
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))

    error_types = ["Mismatched price", "Mismatched date", "Mismatched quantity"]
    failed_trades = [t for t in trades if t['errors'] and any(e in t['errors'] for e in error_types)]

    if failed_trades:
        subject = "🚨 Trade Exceptions Found 🚨"
        body = "The following trades have errors:\n\n"
        for trade in failed_trades:
            body += f"Trade ID: {trade['trade_id']} | Errors: {trade['errors']} | Timestamp: {trade['check_timestamp']}\n"
    else:
        subject = "✅ No Trade Exceptions Found ✅"
        body = "All trades are processed without exceptions!"

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, email_password)
            server.send_message(msg)
            print("✅ Email notification sent successfully!")
    except smtplib.SMTPException as e:
        print(f"⚠ Email sending failed: {e}")

# --- LAMBDA HANDLER ---
def lambda_handler(event, context):
    trades_data = fetch_trades()
    send_email(trades_data)
    return {
        'statusCode': 200,
        'body': 'Trade validation email sent.'
    }
