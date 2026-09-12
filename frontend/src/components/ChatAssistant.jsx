import React, { useState, useRef, useEffect } from 'react';
import { ChatIcon, SendIcon, CitationIcon, RefreshIcon, AlertCircleIcon, ShieldIcon } from './Icons';

const MAX_INPUT_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 30000; // 30s timeout

export function ChatAssistant({
  externalPrompt,
  onClearExternalPrompt,
  taxYear,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome to TaxSense PK. I provide authoritative guidance on Pakistani salaried income tax rules.

I can explain:
• Official FBR tax slabs & calculation breakdowns
• Filing deadlines & late-filing penalty regulations
• Wealth statement requirements (Section 116)
• Eligible tax credits, rebates, & monthly withholding certificates

All statutory answers cite official publications (Income Tax Ordinance 2001 and Finance Act 2026). How can I assist with your tax obligations today?`,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [sessionId, setSessionId] = useState(() => {
    return 'session_' + Math.random().toString(36).substring(2, 10);
  });
  const [error, setError] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

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
    const rawQuery = textToSend || input;
    const query = rawQuery.trim();
    if (!query || isLoading) return;

    // Guard against offline state
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You are currently offline.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: query,
        },
        {
          role: 'assistant',
          content: 'Network connection unavailable. Please check your internet connection and try again.',
          isError: true,
          failedQuery: query,
        },
      ]);
      return;
    }

    setLastQuery(query);
    setError(null);
    const userMessage = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Hardened timeout with AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          session_id: sessionId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      clearTimeout(timeoutId);
      console.error('Chat error:', err);

      let friendlyMessage = `Unable to connect to the statutory advisory service. Please ensure the Python backend server is running on port 8000.\n\n*Technical Detail: ${err.message}*`;
      if (err.name === 'AbortError') {
        friendlyMessage = 'The request timed out after 30 seconds. The advisory agent took too long to retrieve and generate a response. Please check your server and try again.';
      }

      setError(err.message || 'Connection failed.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: friendlyMessage,
          isError: true,
          failedQuery: query,
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleClearHistory = async () => {
    try {
      await fetch(`/api/chat/${sessionId}`, { method: 'DELETE' });
    } catch (e) {
      // Non-blocking cleanup
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
    'Who is legally required to submit a wealth statement under Section 116?',
    'What changed in salary tax slabs between TY 2025-26 and TY 2026-27?',
    'How does employer tax withholding work on monthly salary?',
  ];

  // Helper to parse statutory citation blocks if present in text
  const renderMessageContent = (content) => {
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
        <div style={{
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}>
          {content}
        </div>
      );
    }

    return (
      <div style={{ lineHeight: 1.6, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
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
          {showClearConfirm ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FAF2DE',
              border: '1px solid #D8C388',
              padding: '3px 8px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.6875rem',
            }}>
              <span style={{ color: '#593E02', fontWeight: 600 }}>Clear chat?</span>
              <button
                type="button"
                onClick={() => {
                  handleClearHistory();
                  setShowClearConfirm(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8C2626',
                  fontWeight: 700,
                  fontSize: '0.6875rem',
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                Yes
              </button>
              <span style={{ color: '#D8C388' }}>|</span>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-neutral-muted)',
                  fontSize: '0.6875rem',
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowClearConfirm(true)}
              title="Clear Chat History"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              <RefreshIcon size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="chat-messages-scroll">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                width: '100%',
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
                background: isUser ? 'var(--color-primary)' : (msg.isError ? '#FDF2F2' : 'var(--color-neutral-surface)'),
                color: isUser ? 'var(--color-neutral-surface)' : (msg.isError ? 'var(--color-semantic-surcharge)' : 'var(--color-neutral-text)'),
                border: isUser ? '1px solid var(--color-primary-deep)' : (msg.isError ? '1px solid #F8B4B4' : '1px solid var(--color-neutral-border)'),
                boxShadow: isUser ? 'none' : 'var(--shadow-subtle)',
                fontSize: '0.875rem',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
              }}>
                {renderMessageContent(msg.content)}

                {msg.isError && msg.failedQuery && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => sendMessage(msg.failedQuery)}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', gap: '6px' }}
                    >
                      <RefreshIcon size={12} />
                      <span>Retry Query</span>
                    </button>
                  </div>
                )}
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

      {/* Suggested Questions */}
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
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              value={input}
              maxLength={MAX_INPUT_CHARS}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask an FBR tax question (e.g. wealth statement threshold, exemptions, slabs)..."
              disabled={isLoading}
              style={{
                width: '100%',
                border: '1px solid var(--color-neutral-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
              }}
            />
            {input.length > 1500 && (
              <span style={{
                position: 'absolute',
                right: '10px',
                bottom: '-18px',
                fontSize: '0.625rem',
                color: input.length >= MAX_INPUT_CHARS ? 'var(--color-semantic-surcharge)' : 'var(--color-neutral-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
                {input.length} / {MAX_INPUT_CHARS}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !input.trim()}
            style={{ padding: '0 18px', minWidth: '88px', height: '42px' }}
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
