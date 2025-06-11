import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import mysql from 'mysql2/promise';

export const maxDuration = 30; // seconds

const systemPrompt = `
You are the DTCC Trade Processing Assistant, an internal AI system for DTCC operations staff. You help analyze trade processing status, troubleshoot issues, and provide insights into the trade lifecycle.

## Your Capabilities:
- Trade status lookups and analysis
- Error diagnosis and resolution guidance
- Processing statistics and trends
- Historical trade data queries
- Status transition explanations

## Trade Status Definitions:
- **VERF**: Verified - Trade passed all validation checks
- **UMAT**: Unmatched - Trade verified but awaiting matching
- **MTCH**: Matched - Trade successfully matched with counterpart  
- **RCND**: Reconciled - Trade successfully reconciled with DTCC data
- **SKIP**: Skipped - Trade skipped due to order type mismatch only
- **UNMT**: Unmatched - No matching counterpart trade found
- **ERR1**: Verification Error - Failed validation (invalid instrument, broker, price, etc.)
- **ERR2**: Matching Error - Trade ID matched but fields mismatched
- **ERR3**: Reconciliation Error - Failed DTCC reconciliation

## Communication Style:
- Professional and concise for operational staff
- Provide actionable insights and next steps
- Use technical terminology appropriate for DTCC operations
- Highlight critical issues that need immediate attention
- Offer troubleshooting guidance for errors

When greeting, briefly introduce yourself as the DTCC Trade Processing Assistant.
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
    console.log('Connecting to DTCC trade database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Database connected successfully');
    
    console.log('Querying trade_log for trade_id:', tradeId);
    const [rows] = await connection.execute(
      'SELECT * FROM trade_log WHERE trade_id = ? ORDER BY check_timestamp DESC',
      [tradeId]
    );
    console.log('Query executed, records found:', Array.isArray(rows) ? rows.length : 0);
    
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

async function fetchBulkTradeData(filters: any) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    let query = 'SELECT * FROM trade_log WHERE 1=1';
    const params: any[] = [];
    
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.dateFrom) {
      query += ' AND check_timestamp >= ?';
      params.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      query += ' AND check_timestamp <= ?';
      params.push(filters.dateTo);
    }
    
    query += ' ORDER BY check_timestamp DESC LIMIT 100';
    
    const [rows] = await connection.execute(query, params);
    return rows as mysql.RowDataPacket[];
  } catch (error) {
    console.error('Bulk query failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

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

function deduplicateTradeRecords(records: mysql.RowDataPacket[]): mysql.RowDataPacket[] {
  const uniqueRecords: mysql.RowDataPacket[] = [];
  const seenStatuses = new Set<string>();
  
  // Sort records by timestamp (newest first) to maintain chronological order
  const sortedRecords = records.sort((a, b) => 
    new Date(b.check_timestamp).getTime() - new Date(a.check_timestamp).getTime()
  );
  
  for (const record of sortedRecords) {
    const statusKey = `${record.status}-${record.check_timestamp}`;
    
    if (!seenStatuses.has(statusKey)) {
      seenStatuses.add(statusKey);
      uniqueRecords.push(record);
    }
  }
  
  return uniqueRecords;
}

function formatTradeReport(records: mysql.RowDataPacket[]): string {
  console.log('Formatting DTCC trade report for', records.length, 'records');
  
  if (!records.length) {
    return '❌ **Trade Not Found**\n\nNo processing records found for this Trade ID in the DTCC system.';
  }

  // Deduplicate records to show only unique status transitions
  const uniqueRecords = deduplicateTradeRecords(records);
  console.log('Deduplicated to', uniqueRecords.length, 'unique status records');

  const tradeId = uniqueRecords[0].trade_id;
  const currentStatus = uniqueRecords[0].status;
  const latestTimestamp = uniqueRecords[0].check_timestamp;
  
  // Determine criticality
  const isCritical = ['ERR1', 'ERR2', 'ERR3'].includes(currentStatus);
  const needsAttention = ['UNMT', 'SKIP'].includes(currentStatus);
  
  let header = `# 📊 DTCC Trade Report: **${tradeId}**\n\n`;
  
  // Status summary with indicators
  if (isCritical) {
    header += `🚨 **CRITICAL**: Current Status: **${currentStatus}** - ${getStatusDescription(currentStatus)}\n`;
  } else if (needsAttention) {
    header += `⚠️ **ATTENTION**: Current Status: **${currentStatus}** - ${getStatusDescription(currentStatus)}\n`;
  } else if (currentStatus === 'RCND') {
    header += `✅ **COMPLETED**: Current Status: **${currentStatus}** - ${getStatusDescription(currentStatus)}\n`;
  } else {
    header += `📋 **IN PROGRESS**: Current Status: **${currentStatus}** - ${getStatusDescription(currentStatus)}\n`;
  }
  
  header += `📅 Last Updated: ${latestTimestamp}\n`;
  header += `📈 Processing Steps: ${uniqueRecords.length}\n\n`;

  // Processing timeline with unique statuses only
  header += `## 🔄 Processing Timeline\n\n`;
  
  const timeline = uniqueRecords.reverse().map((record, index) => {
    const statusIcon = record.status === 'RCND' ? '✅' : 
                      record.status.startsWith('ERR') ? '❌' : 
                      record.status === 'SKIP' ? '⏭️' :
                      record.status === 'UNMT' ? '⚠️' : '🔄';
    
    let step = `**Step ${index + 1}**: ${statusIcon} **${record.status}** - ${getStatusDescription(record.status)}\n`;
    step += `   📅 ${record.check_timestamp}\n`;
    
    // Parse and display errors if present
    if (record.errors) {
      try {
        const errors = JSON.parse(record.errors);
        if (errors && errors.length > 0) {
          step += `   🚨 **Issues**: ${errors.join(', ')}\n`;
        }
      } catch (e) {
        if (record.errors.trim() !== '[]' && record.errors.trim() !== '') {
          step += `   🚨 **Issues**: ${record.errors}\n`;
        }
      }
    }
    step += '\n';
    return step;
  }).join('');
  
  header += timeline;

  // Recommendations based on current status
  header += `## 💡 Recommendations\n\n`;
  
  switch (currentStatus) {
    case 'ERR1':
      header += `🔧 **Action Required**: Review validation errors and correct trade data or update validation rules.\n`;
      header += `👥 **Contact**: Trading Systems Team\n`;
      break;
    case 'ERR2':
      header += `🔧 **Action Required**: Investigate field mismatches between matched trades.\n`;
      header += `👥 **Contact**: Settlement Operations Team\n`;
      break;
    case 'ERR3':
      header += `🔧 **Action Required**: Reconcile discrepancies with DTCC data or correct internal records.\n`;
      header += `👥 **Contact**: DTCC Integration Team\n`;
      break;
    case 'UNMT':
      header += `📋 **Manual Review**: No matching counterpart found. Check for missing trades or data entry errors.\n`;
      header += `👥 **Contact**: Settlement Operations Team\n`;
      break;
    case 'SKIP':
      header += `📋 **Manual Review**: Order type mismatch detected. Verify trade details.\n`;
      header += `👥 **Contact**: Settlement Operations Team\n`;
      break;
    case 'RCND':
      header += `✅ **Complete**: Trade successfully processed through all stages.\n`;
      break;
    default:
      header += `🔄 **In Progress**: Trade is currently being processed.\n`;
  }

  return header;
}

async function generateStatusSummary(): Promise<string> {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [statusCounts] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM trade_log 
      WHERE DATE(check_timestamp) = CURDATE() 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    const [errorBreakdown] = await connection.execute(`
      SELECT status, errors, COUNT(*) as count
      FROM trade_log 
      WHERE status IN ('ERR1', 'ERR2', 'ERR3') 
      AND DATE(check_timestamp) = CURDATE()
      GROUP BY status, errors
      ORDER BY count DESC
      LIMIT 10
    `);
    
    let summary = `## 📊 Today's Processing Summary\n\n`;
    
    if (Array.isArray(statusCounts) && statusCounts.length > 0) {
      summary += `### Status Distribution\n`;
      (statusCounts as any[]).forEach((row: any) => {
        const icon = row.status === 'RCND' ? '✅' : 
                    row.status.startsWith('ERR') ? '❌' : 
                    row.status === 'SKIP' ? '⏭️' :
                    row.status === 'UNMT' ? '⚠️' : '🔄';
        summary += `${icon} **${row.status}**: ${row.count} trades\n`;
      });
      summary += `\n`;
    }
    
    if (Array.isArray(errorBreakdown) && errorBreakdown.length > 0) {
      summary += `### Top Error Patterns\n`;
      (errorBreakdown as any[]).forEach((row: any, index: number) => {
        if (index < 5) {  // Top 5 errors
          summary += `${index + 1}. **${row.status}**: ${row.count} occurrences\n`;
        }
      });
    }
    
    return summary;
  } catch (error) {
    return `⚠️ Unable to generate status summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1]?.content || '';
    
    console.log('DTCC Chat - Received message:', userMessage);

    // Enhanced trade ID detection (supports various formats)
    const tradeIdMatch = userMessage.match(/\b(tid\d{6,}|TID\d{6,}|trade[_\s]?id[:\s]*\d{6,})\b/i);
    
    // Status summary request detection
    const summaryRequest = /\b(summary|status|dashboard|overview|today)\b/i.test(userMessage);
    
    // Bulk query detection
    const bulkQueryMatch = userMessage.match(/\b(ERR[123]|VERF|UMAT|MTCH|RCND|SKIP|UNMT)\b/i);
    
    if (tradeIdMatch) {
      const tradeId = tradeIdMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '');
      console.log('Processing trade lookup for:', tradeId);
      
      try {
        const records = await fetchTradeData(tradeId);
        const report = formatTradeReport(records);
        
        console.log('Trade report generated successfully');

        const result = streamText({
          model: perplexity('llama-3.1-sonar-large-128k-online'),
          messages: [
            { 
              role: 'system', 
              content: `You are the DTCC Trade Processing Assistant. Present the provided trade report clearly and offer additional analysis or insights based on the trade status. Be professional and helpful to DTCC operations staff.` 
            },
            { 
              role: 'user', 
              content: `Please present this DTCC trade report and provide any additional insights:\n\n${report}` 
            }
          ],
          temperature: 0.2,
        });

        return result.toDataStreamResponse();
        
      } catch (dbError) {
        console.error('DTCC database error:', dbError);
        
        const errorMessage = `🚨 **DTCC System Error**

Unable to retrieve trade data for **${tradeId}**.

**Possible Issues:**
- Database connectivity problems
- Trade ID format incorrect (should be like 'tid000553')  
- Trade not yet processed into trade_log table
- System maintenance in progress

**Next Steps:**
1. Verify trade ID format
2. Check if trade was recently submitted
3. Contact IT Support if issue persists

**Error Details:** ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`;

        const result = streamText({
          model: perplexity('llama-3.1-sonar-large-128k-online'),
          messages: [
            { 
              role: 'system', 
              content: 'You are the DTCC Trade Processing Assistant. Present this error message professionally and offer helpful guidance.' 
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

    // Handle status summary requests
    if (summaryRequest && !tradeIdMatch) {
      console.log('Processing status summary request');
      
      try {
        const summary = await generateStatusSummary();
        
        const result = streamText({
          model: perplexity('llama-3.1-sonar-large-128k-online'),
          messages: [
            { 
              role: 'system', 
              content: systemPrompt + '\n\nProvide analysis and insights based on the status summary data provided.' 
            },
            { 
              role: 'user', 
              content: `Here's the current DTCC processing summary:\n\n${summary}\n\nPlease analyze this data and provide insights for operations staff.` 
            }
          ],
          temperature: 0.3,
        });

        return result.toDataStreamResponse();
      } catch (error) {
        console.error('Summary generation error:', error);
      }
    }

    // Forward other queries to LLM with enhanced context
    console.log('Forwarding general query to DTCC Assistant');
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];
    
    const result = streamText({
      model: perplexity('llama-3.1-sonar-large-128k-online'),
      messages: fullMessages,
      temperature: 0.4,
    });

    return result.toDataStreamResponse();
    
  } catch (error) {
    console.error('DTCC Chat processing error:', error);
    
    const result = streamText({
      model: perplexity('llama-3.1-sonar-large-128k-online'),
      messages: [
        { 
          role: 'system', 
          content: 'You are the DTCC Trade Processing Assistant. Acknowledge this system error professionally.' 
        },
        { 
          role: 'user', 
          content: '🚨 **System Error**: An unexpected error occurred in the DTCC Trade Processing Assistant. Please try again or contact IT Support if the issue persists.' 
        }
      ],
      temperature: 0,
    });

    return result.toDataStreamResponse();
  }
}