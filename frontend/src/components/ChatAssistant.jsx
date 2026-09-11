import React, { useState, useRef, useEffect } from 'react';
import { ChatIcon, SendIcon, CitationIcon, RefreshIcon, AlertCircleIcon, ShieldIcon } from './Icons';

export function ChatAssistant({
  externalPrompt,
  onClearExternalPrompt,
  taxYear,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome to TaxSense PK. I am your statutory assistant for Pakistani salaried income tax.

You can ask me questions regarding:
• Official FBR tax slabs and calculation formulas
• Filing deadlines and penalty regulations
• Wealth statement requirements (Section 116)
• Tax credits, deductions, and withholding certificates

All statutory answers are retrieved directly from official government records (Income Tax Ordinance 2001 and Finance Act 2026). How can I assist with your tax obligations today?`,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    return 'session_' + Math.random().toString(36).substring(2, 10);
  });
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle external prompt sent from the Calculator Ledger
  useEffect(() => {
    if (externalPrompt) {
      sendMessage(externalPrompt);
      if (onClearExternalPrompt) onClearExternalPrompt();
    }
  }, [externalPrompt]);

  const sendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    setError(null);
    const userMessage = { role: 'user', content: query.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query.trim(),
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (data.session_id) {
        setSessionId(data.session_id);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError(err.message || 'Unable to connect to the tax assistant API.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Unable to complete your request. Please ensure the backend server is running.\n\n*Error: ${err.message}*`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch(`/api/chat/${sessionId}`, { method: 'DELETE' });
    } catch (e) {
      // Ignore cleanup error
    }
    const newSession = 'session_' + Math.random().toString(36).substring(2, 10);
    setSessionId(newSession);
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation cleared. What questions do you have regarding your Pakistan income tax return or salary withholding?',
      },
    ]);
  };

  const suggestedQuestions = [
    'What is the salary tax filing deadline for Tax Year 2025-26?',
    'Who is legally required to file a wealth statement under Section 116?',
    'What changed in tax slabs between TY 2025-26 and TY 2026-27?',
    'How does employer tax withholding work on monthly salary?',
  ];

  // Helper to parse statutory citation blocks if present in text
  const renderMessageContent = (content) => {
    // Check for [Source: ..., page ...] citations
    const sourceRegex = /\[Source:\s*([^,\]]+)(?:,\s*page\s*([^\]]+))?\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = sourceRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          text: content.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'citation',
        source: match[1]?.trim() || 'FBR Statutory Document',
        page: match[2]?.trim() || null,
        fullMatch: match[0],
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        text: content.substring(lastIndex),
      });
    }

    if (parts.length <= 1) {
      return (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {content}
        </div>
      );
    }

    return (
      <div style={{ lineHeight: 1.6 }}>
        {parts.map((part, idx) => {
          if (part.type === 'text') {
            return (
              <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>
                {part.text}
              </span>
            );
          }
          return (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--color-primary-surface)',
                border: '1px solid var(--color-neutral-border)',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 'var(--radius-xs)',
                margin: '2px 4px',
                verticalAlign: 'middle',
              }}
            >
              <CitationIcon size={12} />
              <span>
                {part.source}
                {part.page ? `, p. ${part.page}` : ''}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="ledger-card" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '620px',
    }}>
      {/* Header */}
      <div className="card-header">
        <h2 className="card-title">
          <ChatIcon size={20} />
          <span>Statutory Advisory Assistant</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-relief" style={{ fontSize: '0.625rem' }}>
            RAG Grounded
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleClearHistory}
            title="Clear Chat History"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <RefreshIcon size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: '#FAFCFB',
        maxHeight: '520px',
      }}>
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
                fontSize: '0.6875rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                color: isUser ? 'var(--color-primary)' : 'var(--color-neutral-muted)',
                fontWeight: 600,
              }}>
                {!isUser && <ShieldIcon size={12} />}
                <span>{isUser ? 'Taxpayer Query' : 'TaxSense PK Advisor'}</span>
              </div>

              <div style={{
                maxWidth: '88%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                background: isUser ? 'var(--color-primary)' : 'var(--color-neutral-surface)',
                color: isUser ? 'var(--color-neutral-surface)' : 'var(--color-neutral-text)',
                border: isUser ? '1px solid var(--color-primary-deep)' : '1px solid var(--color-neutral-border)',
                boxShadow: isUser ? 'none' : 'var(--shadow-subtle)',
                fontSize: '0.875rem',
              }}>
                {renderMessageContent(msg.content)}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              color: 'var(--color-neutral-muted)',
              fontWeight: 600,
            }}>
              <ShieldIcon size={12} />
              <span>TaxSense PK Advisor</span>
            </div>
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-neutral-surface)',
              border: '1px solid var(--color-neutral-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--color-neutral-muted)',
              fontSize: '0.8125rem',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                animation: 'pulse 1s infinite alternate',
              }} />
              <span>Searching FBR ordinances and statutory precedents...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions (only if few messages) */}
      {messages.length <= 2 && (
        <div style={{
          padding: '10px 20px',
          background: 'var(--color-neutral-ground)',
          borderTop: '1px solid var(--color-neutral-border)',
        }}>
          <span style={{
            display: 'block',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-neutral-muted)',
            marginBottom: '6px',
          }}>
            Frequently Sourced Legal Inquiries
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-ghost"
                onClick={() => sendMessage(q)}
                disabled={isLoading}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--color-neutral-border)',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--color-neutral-surface)',
                  textAlign: 'left',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--color-neutral-border)',
        background: 'var(--color-neutral-surface)',
      }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          style={{ display: 'flex', gap: '10px' }}
        >
          <input
            type="text"
            className="form-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about FBR rules, wealth statements, exemptions, deadlines..."
            disabled={isLoading}
            style={{
              flex: 1,
              border: '1px solid var(--color-neutral-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !input.trim()}
            style={{ padding: '0 18px', minWidth: '88px' }}
          >
            <SendIcon size={16} />
            <span>Send</span>
          </button>
        </form>

        <div style={{
          marginTop: '10px',
          fontSize: '0.6875rem',
          color: 'var(--color-neutral-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          lineHeight: 1.3,
        }}>
          <ShieldIcon size={12} />
          <span>
            Advisory based on official Income Tax Ordinance 2001 & Finance Act 2026. Verify final filings on the FBR Iris portal.
          </span>
        </div>
      </div>
    </div>
  );
}
