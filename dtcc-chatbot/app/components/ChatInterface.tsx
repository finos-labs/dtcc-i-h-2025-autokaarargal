//app/components/ChatInterface.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';

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
    setInput, // <-- Needed for suggestion click
    handleInputChange,
    handleSubmit,
  } = useChat({
    api: '/api/chat',
  });

  // Suggestions to display above input
  const suggestions = [
    'Show the detail of tid000012',
    'Generate report for the date 1X-12-25',
  ];
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
  };

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
      </div>

      {/* Suggestions above the input */}
      {showSuggestions && (
        <div className="flex gap-2 px-4 pb-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="bg-gray-200 hover:bg-blue-100 text-gray-800 px-3 py-2 rounded-lg text-sm transition-colors"
              onClick={() => handleSuggestionClick(s)}
              type="button"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t bg-gray-50">
        <input
          className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          placeholder="Ask about a trade issue or request a report…"
          onChange={handleInputChange}
        />
        <button
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  );
}
