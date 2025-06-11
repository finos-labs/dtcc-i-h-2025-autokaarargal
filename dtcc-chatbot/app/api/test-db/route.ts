// app/api/test-db/route.ts
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
};

export async function GET() {
  let connection;
  const results = {
    connectionStatus: 'failed' as string,
    tableExists: false,
    recordCount: 0,
    sampleRecord: null as any,
    sampleTradeIds: [] as string[],
    error: null as string | null,
    envVars: {
      DB_HOST: process.env.DB_HOST ? 'Set' : 'Missing',
      DB_USER: process.env.DB_USER ? 'Set' : 'Missing',
      DB_PASSWORD: process.env.DB_PASSWORD ? 'Set' : 'Missing',
      DB_PORT: process.env.DB_PORT ? 'Set' : 'Missing',
      DB_NAME: process.env.DB_NAME ? 'Set' : 'Missing',
    }
  };

  try {
    console.log('Testing database connection...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');
    results.connectionStatus = 'success';

    // Test if table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'trade_log'"
    ) as any[];
    results.tableExists = tables.length > 0;
    console.log('Table exists:', results.tableExists);

    if (results.tableExists) {
      // Test if specific trade ID exists
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM trade_log WHERE trade_id = ?',
        ['tid00000553']
      ) as any[];
      results.recordCount = countResult[0]?.count || 0;
      console.log('Records found for tid00000553:', results.recordCount);

      // Show sample data structure
      const [sample] = await connection.execute(
        'SELECT * FROM trade_log LIMIT 1'
      ) as any[];
      results.sampleRecord = sample[0] || null;
      console.log('Sample record:', results.sampleRecord);

      // Also check all trade_ids that start with 'tid'
      const [allTids] = await connection.execute(
        "SELECT DISTINCT trade_id FROM trade_log WHERE trade_id LIKE 'tid%' LIMIT 10"
      ) as any[];
      results.sampleTradeIds = allTids.map((row: any) => row.trade_id);
    }

  } catch (error) {
    console.error('❌ Database test failed:', error);
    results.error = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  return Response.json(results, { 
    headers: { 'Content-Type': 'application/json' },
    status: results.connectionStatus === 'success' ? 200 : 500
  });
}