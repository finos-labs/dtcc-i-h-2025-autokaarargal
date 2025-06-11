import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import mysql from 'mysql2/promise';

export const maxDuration =50; // seconds

const systemPrompt = `
You are the DTCC Trade Processing Assistant, an internal AI system for DTCC operations staff. You help analyze trade processing status, troubleshoot issues, and provide insights into the trade lifecycle.

## Your Capabilities:
- Trade status lookups and analysis
- Error diagnosis and resolution guidance
- Processing statistics and trends
- Historical trade data queries
- Status transition explanations
- Report generation (weekly, monthly, daily, custom period)

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


## Greeting Protocol:
- When users greet you ("hi", "hello", "hey"), respond as the DTCC Trade Processing Assistant
- Briefly introduce yourself and offer trade processing assistance
- Never discuss the HEY email service - it's unrelated to DTCC operations

Example greeting response:
"DTCC Trade Processing Assistant here. How can I assist with trade processing today?"
`;

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
};

function isOffTopic(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const greetingRegex = /^(hey|hi|hello|yo|sup|howdy)[\s!,.]?/i;

  const domainKeywords = [
    'trade', 'dtcc', 'status', 'verf', 'umat', 'mtch', 'rcnd', 'skip', 'unmt',
    'err1', 'err2', 'err3', 'reconcile', 'match', 'verify', 'process', 'broker',
    'settlement', 'clearing', 'transaction', 'report', 'error', 'validation',
    'counterpart', 'operation', 'lifecycle', 'statistics', 'trend', 'resolution'
  ];

  const offTopicIndicators = [
    'hey.com', 'email service', 'calendar', 'notes', 'scheduling', 'productivity app',
    'music', 'movie', 'sport', 'news', 'weather', 'joke', 'funny', 'entertain',
    'recipe', 'cook', 'shopping', 'game', 'trivia', 'personal', 'off-topic',
    'unrelated', 'outside scope', 'not about trade', 'other subject'
  ];

  const hasDomainKeyword = domainKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  const hasOffTopicIndicator = offTopicIndicators.some(indicator =>
    lowerMessage.includes(indicator)
  );

  const isHeyEmailQuery = (
    lowerMessage.includes('hey') &&
    !greetingRegex.test(lowerMessage) &&
    (lowerMessage.includes('email') || lowerMessage.includes('app'))
  );

  return (
    (!hasDomainKeyword && hasOffTopicIndicator) ||
    isHeyEmailQuery
  );
}

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
    
    query += ' ORDER BY check_timestamp DESC LIMIT 1000';
    
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

async function generateReport(reportType: string) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    let dateFilter = '';
    let reportTitle = '';
    
    const now = new Date();
    
    switch (reportType.toLowerCase()) {
      case 'daily':
      case 'today':
        dateFilter = 'DATE(check_timestamp) = CURDATE()';
        reportTitle = `Daily Trade Processing Report - ${now.toDateString()}`;
        break;
      case 'weekly':
        dateFilter = 'check_timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        reportTitle = `Weekly Trade Processing Report - Last 7 Days`;
        break;
      case 'monthly':
        dateFilter = 'check_timestamp >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        reportTitle = `Monthly Trade Processing Report - Last 30 Days`;
        break;
      default:
        dateFilter = 'DATE(check_timestamp) = CURDATE()';
        reportTitle = `Trade Processing Report - ${now.toDateString()}`;
    }
    
    // Get summary statistics
    const [statusSummary] = await connection.execute(`
      SELECT 
        status,
        COUNT(*) as total_count,
        COUNT(DISTINCT trade_id) as unique_trades
      FROM trade_log 
      WHERE ${dateFilter}
      GROUP BY status 
      ORDER BY total_count DESC
    `);
    
    // Get error details
    const [errorDetails] = await connection.execute(`
      SELECT 
        status,
        errors,
        COUNT(*) as error_count,
        GROUP_CONCAT(DISTINCT trade_id SEPARATOR ', ') as affected_trades
      FROM trade_log 
      WHERE ${dateFilter} AND status IN ('ERR1', 'ERR2', 'ERR3')
      GROUP BY status, errors
      ORDER BY error_count DESC
      LIMIT 20
    `);
    
    // Get processing timeline
    const [timelineData] = await connection.execute(`
      SELECT 
        DATE(check_timestamp) as processing_date,
        HOUR(check_timestamp) as processing_hour,
        status,
        COUNT(*) as count
      FROM trade_log 
      WHERE ${dateFilter}
      GROUP BY DATE(check_timestamp), HOUR(check_timestamp), status
      ORDER BY processing_date DESC, processing_hour DESC
    `);
    
    // Get detailed trade data for CSV
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
    
    return {
      title: reportTitle,
      statusSummary: statusSummary as mysql.RowDataPacket[],
      errorDetails: errorDetails as mysql.RowDataPacket[],
      timelineData: timelineData as mysql.RowDataPacket[],
      detailedData: detailedData as mysql.RowDataPacket[],
      reportType
    };
    
  } catch (error) {
    console.error('Report generation failed:', error);
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

function formatReportSummary(reportData: any): string {
  const { title, statusSummary, errorDetails, timelineData, detailedData, reportType } = reportData;
  
  let report = `# 📊 ${title}\n\n`;
  
  // Executive Summary
  const totalTrades = statusSummary.reduce((sum: number, row: any) => sum + row.total_count, 0);
  const uniqueTrades = statusSummary.reduce((sum: number, row: any) => sum + row.unique_trades, 0);
  const errorCount = statusSummary.filter((row: any) => row.status.startsWith('ERR')).reduce((sum: number, row: any) => sum + row.total_count, 0);
  const successfulTrades = statusSummary.filter((row: any) => row.status === 'RCND').reduce((sum: number, row: any) => sum + row.total_count, 0);
  
  report += `## 📈 Executive Summary\n\n`;
  report += `- **Total Processing Records**: ${totalTrades.toLocaleString()}\n`;
  report += `- **Unique Trades Processed**: ${uniqueTrades.toLocaleString()}\n`;
  report += `- **Successfully Reconciled**: ${successfulTrades.toLocaleString()}\n`;
  report += `- **Errors Encountered**: ${errorCount.toLocaleString()}\n`;
  
  if (uniqueTrades > 0) {
    const successRate = ((successfulTrades / uniqueTrades) * 100).toFixed(2);
    const errorRate = ((errorCount / totalTrades) * 100).toFixed(2);
    report += `- **Success Rate**: ${successRate}%\n`;
    report += `- **Error Rate**: ${errorRate}%\n`;
  }
  
  report += `\n`;
  
  // Status Distribution
  report += `## 📊 Status Distribution\n\n`;
  statusSummary.forEach((row: any) => {
    const icon = row.status === 'RCND' ? '✅' : 
                row.status.startsWith('ERR') ? '❌' : 
                row.status === 'SKIP' ? '⏭️' :
                row.status === 'UNMT' ? '⚠️' : '🔄';
    
    const percentage = totalTrades > 0 ? ((row.total_count / totalTrades) * 100).toFixed(1) : '0';
    report += `${icon} **${row.status}** (${getStatusDescription(row.status).split(' - ')[0]}): ${row.total_count.toLocaleString()} records (${percentage}%)\n`;
    report += `   - Unique Trades: ${row.unique_trades.toLocaleString()}\n\n`;
  });
  
  // Error Analysis
  if (errorDetails.length > 0) {
    report += `## 🚨 Error Analysis\n\n`;
    report += `**Top Error Patterns:**\n\n`;
    
    errorDetails.slice(0, 10).forEach((row: any, index: number) => {
      report += `${index + 1}. **${row.status}** - ${row.error_count} occurrences\n`;
      if (row.errors && row.errors !== '[]') {
        try {
          const errors = JSON.parse(row.errors);
          if (Array.isArray(errors) && errors.length > 0) {
            report += `   Issues: ${errors.join(', ')}\n`;
          }
        } catch (e) {
          report += `   Issues: ${row.errors}\n`;
        }
      }
      
      // Show first few affected trades
      if (row.affected_trades) {
        const trades = row.affected_trades.split(', ').slice(0, 3);
        report += `   Affected Trades: ${trades.join(', ')}${trades.length < row.affected_trades.split(', ').length ? '...' : ''}\n`;
      }
      report += `\n`;
    });
  }
  
  // Generate CSV content for download
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
  .map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  .join('\n');
  
  // Add download section
  report += `## 📥 Download Options\n\n`;
  report += `**CSV Report Available**: ${detailedData.length.toLocaleString()} records ready for download\n\n`;
  report += `\`\`\`csv\n`;
  report += csvContent.split('\n').slice(0, 6).join('\n'); // Show first 5 rows + header as preview
  if (detailedData.length > 5) {
    report += `\n... and ${(detailedData.length - 5).toLocaleString()} more records\n`;
  }
  report += `\`\`\`\n\n`;
  
  // Recommendations
  report += `## 💡 Recommendations\n\n`;
  
  if (errorCount > 0) {
    report += `🔧 **Immediate Actions Required:**\n`;
    report += `- Review and resolve ${errorCount.toLocaleString()} error records\n`;
    report += `- Focus on top error patterns identified above\n`;
    report += `- Contact appropriate teams for critical issues\n\n`;
  }
  
  const pendingTrades = statusSummary.filter((row: any) => 
    !['RCND', 'ERR1', 'ERR2', 'ERR3', 'SKIP'].includes(row.status)
  ).reduce((sum: number, row: any) => sum + row.unique_trades, 0);
  
  if (pendingTrades > 0) {
    report += `⏳ **Pending Processing:**\n`;
    report += `- ${pendingTrades.toLocaleString()} trades still in processing pipeline\n`;
    report += `- Monitor for completion and potential bottlenecks\n\n`;
  }
  
  report += `📞 **Support Contacts:**\n`;
  report += `- **ERR1 Issues**: Trading Systems Team\n`;
  report += `- **ERR2/ERR3 Issues**: Settlement Operations Team\n`;
  report += `- **System Issues**: DTCC Integration Team\n`;
  
  return report;
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

    // ===== NEW: Handle greetings first =====
    const greetingRegex = /\b(hello|hi|hey|greetings|good\s*(morning|afternoon|evening))\b/i;
    if (greetingRegex.test(userMessage)) {
      console.log('Handling greeting');
      
      const result = streamText({
        model: perplexity('llama-3.1-sonar-large-128k-online'),
        messages: [
          { 
            role: 'system', 
            content: systemPrompt + '\n\nYou are greeting the user. Respond professionally as the DTCC Trade Processing Assistant.'
          },
          { 
            role: 'user', 
            content: userMessage 
          }
        ],
        temperature: 0.2,
      });

      return result.toDataStreamResponse();
    }
    // ===== END NEW SECTION =====

    // ===== NEW: Off-topic handling =====
    if (isOffTopic(userMessage)) {
      console.log('Detected off-topic query');

      const offTopicResponse = `🚫 **Off-Topic Request**  
        This assistant is designed exclusively for DTCC trade processing operations. 

        Your query appears unrelated to our core functions:
        - Trade status lookups
        - Error diagnosis
        - Processing reports
        - DTCC reconciliation issues

        Please ask about:
        ✓ Trade processing status (e.g., "status of TID000553")
        ✓ Error resolution (e.g., "how to fix ERR2?")
        ✓ Report generation (e.g., "generate weekly report")
        ✓ Trade lifecycle explanations`;

              const result = streamText({
                model: perplexity('llama-3.1-sonar-large-128k-online'),
                messages: [
                  { 
                    role: 'system', 
                    content: `You are the DTCC Trade Processing Assistant. Respond ONLY with the provided off-topic message without additions or explanations.`
                  },
                  { 
                    role: 'user', 
                    content: offTopicResponse 
                  }
                ],
                temperature: 0,
                maxTokens: 150
              });

              return result.toDataStreamResponse();
            }


    // Enhanced trade ID detection (supports various formats)
    const tradeIdMatch = userMessage.match(/\b(tid\d{6,}|TID\d{6,}|trade[_\s]?id[:\s]*\d{6,})\b/i);
    
    // Report generation detection
    const reportMatch = userMessage.match(/\b(generate|create|export|download)\s+(daily|weekly|monthly|today|report)\s*(report)?\b/i);
    
    // Status summary request detection
    const summaryRequest = /\b(summary|status|dashboard|overview|today)\b/i.test(userMessage) && !reportMatch;
    
    // Bulk query detection
    const bulkQueryMatch = userMessage.match(/\b(ERR[123]|VERF|UMAT|MTCH|RCND|SKIP|UNMT)\b/i);
    
    // Handle report generation requests
    if (reportMatch) {
      let reportType = reportMatch[2].toLowerCase();
      if (reportType === 'report') reportType = 'daily'; // Default to daily if just "report"
      
      console.log('Processing report generation for:', reportType);
      
      try {
        const reportData = await generateReport(reportType);
        const formattedReport = formatReportSummary(reportData);
        
        console.log('Report generated successfully');

        const result = streamText({
          model: perplexity('llama-3.1-sonar-large-128k-online'),
          messages: [
            { 
              role: 'system', 
              content: `You are the DTCC Trade Processing Assistant. Present the provided ${reportType} report clearly and highlight key insights for operations staff. Be professional and actionable.` 
            },
            { 
              role: 'user', 
              content: `Please present this DTCC ${reportType} report and provide key insights:\n\n${formattedReport}` 
            }
          ],
          temperature: 0.2,
        });

        return result.toDataStreamResponse();
        
      } catch (dbError) {
        console.error('Report generation error:', dbError);
        
        const errorMessage = `🚨 **Report Generation Error**

Unable to generate ${reportMatch[2]} report.

**Possible Issues:**
- Database connectivity problems
- Insufficient data for the requested period
- System maintenance in progress

**Next Steps:**
1. Try generating a different report period
2. Check system status
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