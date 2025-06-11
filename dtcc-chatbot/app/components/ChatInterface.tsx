// app/components/ChatInterface.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';

// Helper: Detects report type from assistant message
function getReportType(message: { role: string; content: string }) {
  if (message.role !== 'assistant') return null;
  
  if (/Daily Trade Processing Report/i.test(message.content)) return 'daily';
  if (/Weekly Trade Processing Report/i.test(message.content)) return 'weekly';
  if (/Monthly Trade Processing Report/i.test(message.content)) return 'monthly';
  
  return null;
}

// Custom button component to prevent hydration errors
function CustomButton({ 
  children, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} data-fdprocessedid="false">
      {children}
    </button>
  );
}

export default function ChatInterface({
  email,
  initialMessages,
  sessionId,
  onSessionId,
}: {
  email?: string;
  initialMessages?: any[];
  sessionId?: string;
  onSessionId?: (id: string) => void;
}) {
  const {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading
  } = useChat({
    api: '/api/chat',
  });

  // Static suggestions list
  const suggestions = [
    'Show details for tid000012',
    'Generate weekly report',
    'Generate daily report',
    'Generate monthly report'
  ];

  // Show suggestions when input is empty and not loading
  const showSuggestions = input === '' && !isLoading;

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
  }, [initialMessages, setMessages]);

  // Only sets the input, doesn't submit
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // Focus the input field for immediate editing
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]');
      if (inputElement instanceof HTMLInputElement) {
        inputElement.focus();
      }
    }, 10);
  };

  // Get report type from last assistant message
  const lastAssistantMessage = messages.length > 0
    ? [...messages].reverse().find((m) => m.role === 'assistant')
    : null;

  const reportType = lastAssistantMessage 
    ? getReportType(lastAssistantMessage)
    : null;

  // Check if it's a generic report request
  const isGenericReport = lastAssistantMessage?.content.includes('Trade Processing Report') && 
                          !reportType;

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {messages.map((m, idx) => (
          <div
            key={m.id || idx}
            className={`mb-4 p-3 rounded-lg ${
              m.role === 'user'
                ? 'ml-auto bg-blue-100 max-w-[80%]'
                : 'bg-gray-100 max-w-[90%]'
            }`}
          >
            <div className="text-sm font-medium text-gray-600 mb-1">
              {m.role === 'user' ? 'You' : 'DTCC Assistant'}
            </div>
            {m.role === 'assistant' ? (
              <ReactMarkdown>{m.content}</ReactMarkdown>
            ) : (
              <p className="text-gray-800">{m.content}</p>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="mb-4 p-3 rounded-lg bg-gray-100 max-w-[90%]">
            <div className="text-sm font-medium text-gray-600 mb-1">DTCC Assistant</div>
            <div className="flex items-center text-gray-600">
              <div className="animate-pulse">Processing trade data...</div>
              <div className="ml-2 h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="ml-1 h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="ml-1 h-2 w-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Context-aware CSV Download Links */}
      {(reportType || isGenericReport) && (
        <div className="flex flex-wrap gap-3 px-4 pb-4">
          {(reportType === 'daily' || isGenericReport) && (
            <a
              href="/api/trade-report/daily"
              download="daily_trade_report.csv"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Download Daily Report CSV 
            </a>
          )}
          
          {(reportType === 'weekly' || isGenericReport) && (
            <a
              href="/api/trade-report/weekly"
              download="weekly_trade_report.csv"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Download Weekly Report CSV
            </a>
          )}
          
          {(reportType === 'monthly' || isGenericReport) && (
            <a
              href="/api/trade-report/monthly"
              download="monthly_trade_report.csv"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              Download Monthly Report CSV
            </a>
          )}
        </div>
      )}

      {/* Static suggestions */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {suggestions.map((s, i) => (
            <CustomButton
              key={i}
              className="bg-gray-200 hover:bg-blue-100 text-gray-800 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
              onClick={() => handleSuggestionClick(s)}
              type="button"
            >
              {s}
            </CustomButton>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t bg-gray-50">
        <input
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          placeholder="Ask about a trade issue or request a report…"
          onChange={handleInputChange}
          type="text"
        />
        <CustomButton
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Send'}
        </CustomButton>
      </form>
    </div>
  );
}