import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import mysql from 'mysql2/promise';

export const maxDuration = 30; // seconds

const systemPrompt = `
You are a friendly AI assistant. When a user greets you (e.g., "Hey", "Hi", "Hello"), respond with a friendly greeting. Do not provide information about products or services unless the user asks specifically.
`;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
};

async function fetchTradeData(tradeId: string) {
  let connection;
  try {
    console.log('Attempting to connect to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Database connected successfully');
    
    console.log('Executing query for trade_id:', tradeId);
    const [rows] = await connection.execute(
      'SELECT * FROM trade_log WHERE trade_id = ? ORDER BY check_timestamp DESC',
      [tradeId]
    );
    console.log('Query executed, rows found:', Array.isArray(rows) ? rows.length : 0);
    
    return rows as mysql.RowDataPacket[];
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

function formatReport(records: mysql.RowDataPacket[]): string {
  console.log('Formatting report for', records.length, 'records');
  
  if (!records.length) {
    return 'No trades found for this ID.';
  }

  const header = `## Trade Report for **${records[0].trade_id}**\n\n`;
  const summary = `**Total Records Found:** ${records.length}\n\n`;

  const tableHeader = '| Field | Value |\n|-------|-------|\n';
  const tables = records.map((rec, idx) => {
    const recordHeader = `**Record ${idx + 1}**\n${tableHeader}`;
    const recordRows = Object.entries(rec)
      .filter(([key]) => key !== 'trade_id')
      .map(([key, val]) => `| ${key} | ${val || 'N/A'} |`)
      .join('\n');
    
    return recordHeader + recordRows + '\n\n';
  }).join('');

  return header + summary + tables;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1]?.content || '';
    
    console.log('Received message:', userMessage);

    // More flexible regex to catch various trade ID formats
    const tradeIdMatch = userMessage.match(/\b(tid\d{6,})\b/i);
    console.log('Trade ID match:', tradeIdMatch);
    
    if (tradeIdMatch) {
      const tradeId = tradeIdMatch[1].toLowerCase(); // Normalize to lowercase
      console.log('Processing trade ID:', tradeId);
      
      try {
        const records = await fetchTradeData(tradeId);
        const report = formatReport(records);
        
        console.log('Report generated successfully');

        // Create a proper AI SDK streaming response for trade reports
        const result = streamText({
          model: perplexity('llama-3.1-sonar-large-128k-online'),
          messages: [
            { 
              role: 'system', 
              content: 'You are a trade report system. Simply return the provided trade report exactly as given without any modifications or additional commentary.' 
            },
            { 
              role: 'user', 
              content: `Please display this trade report:\n\n${report}` 
            }
          ],
          temperature: 0, // Make it deterministic
        });

        return result.toDataStreamResponse();
        
      } catch (dbError) {
        console.error('Database error details:', dbError);
        
        const errorMessage = `⚠️ Error fetching trade data for ${tradeId}. 
        
**Error Details:**
- ${dbError instanceof Error ? dbError.message : 'Unknown database error'}
        
Please check:
1. Database connection settings
2. Trade ID format (should be like 'tid00000553')
3. Table name 'trade_log' exists
4. Column 'trade_id' exists in the table

Please try again later or contact support.`;

        // Use AI SDK for error responses too
        const result = streamText({
          model: perplexity('llama-3.1-sonar-large-128k-online'),
          messages: [
            { 
              role: 'system', 
              content: 'You are a helpful assistant. Simply return the provided error message exactly as given.' 
            },
            { 
              role: 'user', 
              content: errorMessage 
            }
          ],
          temperature: 0,
        });

        return result.toDataStreamResponse();
      }
    }

    // If no trade ID found, forward to LLM
    console.log('No trade ID found, forwarding to LLM');
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];
    
    const result = streamText({
      model: perplexity('llama-3.1-sonar-large-128k-online'),
      messages: fullMessages
    });

    return result.toDataStreamResponse();
    
  } catch (error) {
    console.error('Request processing error:', error);
    
    // Use AI SDK for general errors too
    const result = streamText({
      model: perplexity('llama-3.1-sonar-large-128k-online'),
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant. Simply return the provided error message exactly as given.' 
        },
        { 
          role: 'user', 
          content: '⚠️ An unexpected error occurred. Please try again.' 
        }
      ],
      temperature: 0,
    });

    return result.toDataStreamResponse();
  }
}