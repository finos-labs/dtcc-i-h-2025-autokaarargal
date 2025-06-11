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
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute(
    'SELECT * FROM trade_log WHERE trade_id = ? ORDER BY check_timestamp DESC',
    [tradeId]
  );
  await connection.end();
  // Type assertion for SELECT queries
  return rows as mysql.RowDataPacket[];
}

function formatReport(records: mysql.RowDataPacket[]): string {
  if (!records.length) return 'No trades found for this ID.';

  const header = `## Trade Report for **${records[0].trade_id}**\n\n`;
  const summary = `**Total Records Found:** ${records.length}\n\n`;

  const tableHeader = '| Field | Value |\n|-------|-------|\n';
  const tables = records.map((rec, index) =>
    `**Record ${index + 1}**\n${tableHeader}` +
    Object.entries(rec)
      .filter(([key]) => key !== 'trade_id')
      .map(([key, value]) => `| ${key} | ${value} |`)
      .join('\n') + '\n\n'
  ).join('');

  return header + summary + tables;
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userMessage = messages[messages.length - 1]?.content || '';

  // Extract trade_id with format tid followed by 8+ digits
  const tradeIdMatch = userMessage.match(/\b(tid\d{8,})\b/i);

  if (tradeIdMatch) {
    const tradeId = tradeIdMatch[1];
    try {
      const records = await fetchTradeData(tradeId);
      const report = formatReport(records);
      // Respond as the assistant, bypassing LLM
      return new Response(
        JSON.stringify({ role: 'assistant', content: report }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('DB error:', error);
      return new Response(
        JSON.stringify({ role: 'assistant', content: '⚠️ Error fetching trade data. Please try again later.' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // If no trade_id, stream from LLM as before
  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];
  const result = streamText({
    model: perplexity('llama-3.1-sonar-large-128k-online'),
    messages: fullMessages,
  });
  return result.toDataStreamResponse();
}
