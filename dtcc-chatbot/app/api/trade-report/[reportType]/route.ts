// app/api/trade-report/[reportType]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Use your actual dbConfig from your environment
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
};

function getStatusDescription(status: string): string {
  const statusMap: Record<string, string> = {
    'VERF': 'Verified - Trade passed all validation checks',
    'UMAT': 'Unmatched - Trade verified but awaiting matching',
    'MTCH': 'Matched - Trade successfully matched with counterpart',
    'RCND': 'Reconciled - Trade successfully reconciled with DTCC data',
    'SKIP': 'Skipped - Trade skipped due to order type mismatch only',
    'UNMT': 'Unmatched - No matching counterpart trade found',
    'ERR1': 'Verification Error - Failed validation checks',
    'ERR2': 'Matching Error - Trade ID matched but fields mismatched',
    'ERR3': 'Reconciliation Error - Failed DTCC reconciliation'
  };
  return statusMap[status] || status;
}

async function generateReport(reportType: string) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    let dateFilter = '';
    switch (reportType.toLowerCase()) {
      case 'daily':
      case 'today':
        dateFilter = 'DATE(check_timestamp) = CURDATE()';
        break;
      case 'weekly':
        dateFilter = 'check_timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        break;
      case 'monthly':
        dateFilter = 'check_timestamp >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        break;
      default:
        dateFilter = 'DATE(check_timestamp) = CURDATE()';
    }

    const [detailedData] = await connection.execute(`
      SELECT 
        trade_id,
        status,
        errors,
        check_timestamp,
        id
      FROM trade_log 
      WHERE ${dateFilter}
      ORDER BY check_timestamp DESC
    `);

    return detailedData as mysql.RowDataPacket[];
  } finally {
    if (connection) await connection.end();
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ reportType: string }> }
) {
  try {
    // Await params to access reportType
    const { reportType } = await context.params;
    const detailedData = await generateReport(reportType);

    const csvHeaders = ['Trade ID', 'Status', 'Status Description', 'Errors', 'Timestamp', 'Record ID'];
    const csvRows = detailedData.map((row: any) => [
      row.trade_id,
      row.status,
      getStatusDescription(row.status),
      row.errors || '',
      row.check_timestamp,
      row.id
    ]);
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${reportType}_trade_report.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate CSV.' }, { status: 500 });
  }
}
