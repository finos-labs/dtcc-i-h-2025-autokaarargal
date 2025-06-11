'use client';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState, useRef } from 'react';

function getReportType(message: { role: string; content: string }) {
  if (message.role !== 'assistant') return null;
  
  if (/Daily Trade Processing Report/i.test(message.content)) return 'daily';
  if (/Weekly Trade Processing Report/i.test(message.content)) return 'weekly';
  if (/Monthly Trade Processing Report/i.test(message.content)) return 'monthly';
  
  return null;
}

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
  
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    'Show details for tid000012',
    'Generate weekly report',
    'Generate daily report',
    'Generate monthly report'
  ];

  const showSuggestions = input === '' && !isLoading;

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
  }, [initialMessages, setMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(suggestion.length, suggestion.length);
    }, 10);
  };

  const lastAssistantMessage = messages.length > 0
    ? [...messages].reverse().find((m) => m.role === 'assistant')
    : null;

  const reportType = lastAssistantMessage 
    ? getReportType(lastAssistantMessage)
    : null;

  const isGenericReport = lastAssistantMessage?.content.includes('Trade Processing Report') && 
                          !reportType;

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 relative">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      {/* Messages Container */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 pb-24">
        {messages.map((m, idx) => (
          <div
            key={m.id || idx}
            className={`mb-4 p-4 rounded-xl ${
              m.role === 'user'
                ? 'ml-auto bg-gradient-to-br from-blue-500/30 to-purple-600/30 backdrop-blur-sm border border-blue-500/30 max-w-[80%]'
                : 'bg-gray-800/50 backdrop-blur-sm border border-gray-700 max-w-[90%]'
            }`}
          >
            <div className={`text-sm font-medium mb-2 ${
              m.role === 'user' ? 'text-blue-400' : 'text-purple-400'
            }`}>
              {m.role === 'user' ? 'You' : 'DTCC Assistant'}
            </div>
            {m.role === 'assistant' ? (
              <ReactMarkdown className="prose prose-invert max-w-none text-gray-200">
                {m.content}
              </ReactMarkdown>
            ) : (
              <p className="text-gray-200">{m.content}</p>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="mb-4 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 max-w-[90%]">
            <div className="text-sm font-medium text-purple-400 mb-2">
              DTCC Assistant
            </div>
            <div className="flex items-center text-gray-200">
              <div className="animate-pulse">Processing trade data...</div>
              <div className="ml-2 h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="ml-1 h-2 w-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="ml-1 h-2 w-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Context-aware CSV Download Links */}
      {(reportType || isGenericReport) && (
        <div className="sticky bottom-24 z-20 flex flex-wrap gap-3 px-6 py-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-700">
          {(reportType === 'daily' || isGenericReport) && (
            <a
              href="/api/trade-report/daily"
              download="daily_trade_report.csv"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md"
            >
              Download Daily Report CSV 
            </a>
          )}
          
          {(reportType === 'weekly' || isGenericReport) && (
            <a
              href="/api/trade-report/weekly"
              download="weekly_trade_report.csv"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-md"
            >
              Download Weekly Report CSV
            </a>
          )}
          
          {(reportType === 'monthly' || isGenericReport) && (
            <a
              href="/api/trade-report/monthly"
              download="monthly_trade_report.csv"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-md"
            >
              Download Monthly Report CSV
            </a>
          )}
        </div>
      )}

      {/* Static suggestions */}
      {showSuggestions && (
        <div className="sticky bottom-24 z-20 flex flex-wrap gap-2 px-6 py-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-700">
          {suggestions.map((s, i) => (
            <CustomButton
              key={i}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap font-medium border border-gray-700 shadow-sm"
              onClick={() => handleSuggestionClick(s)}
              type="button"
            >
              {s}
            </CustomButton>
          ))}
        </div>
      )}

      {/* Fixed input area at bottom */}
      <div className="sticky bottom-0 z-30 border-t border-slate-700 bg-slate-900/80 backdrop-blur-lg p-4">
        <form 
          onSubmit={handleSubmit} 
          className="flex gap-3 w-full max-w-5xl mx-auto"
        >
          <input
            ref={inputRef}
            className="flex-1 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-gray-200 placeholder-gray-500 border border-gray-700 shadow-inner"
            value={input}
            placeholder="Ask about a trade issue or request a report…"
            onChange={handleInputChange}
            type="text"
          />
          <CustomButton
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 font-medium shadow-lg"
            type="submit"
            disabled={isLoading || input.trim() === ''}
          >
            {isLoading ? (
              <span className="flex items-center">
                <span className="animate-pulse">Processing</span>
                <span className="ml-1 flex">
                  <span className="h-1.5 w-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="ml-0.5 h-1.5 w-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="ml-0.5 h-1.5 w-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </span>
              </span>
            ) : 'Send'}
          </CustomButton>
        </form>
      </div>
    </div>
  );
}