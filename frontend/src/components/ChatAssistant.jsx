import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatIcon,
  SendIcon,
  CitationIcon,
  RefreshIcon,
  AlertCircleIcon,
  ShieldIcon,
  CopyIcon,
  CheckIcon,
} from './Icons';
import { apiUrl } from '../utils/api';

const MAX_INPUT_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 60000; // 60s timeout

export function ChatAssistant({
  externalPrompt,
  onClearExternalPrompt,
  taxYear,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `### Welcome to TaxSense PK

> **Authoritative Advisory:** Sourced directly from official provisions of the **Income Tax Ordinance 2001** and **Finance Act 2026**.

I can assist salaried taxpayers with:

- **FBR Slabs & Precise Calculations**: Instant tax computation for Tax Year 2025-26 and 2026-27.
- **Wealth Statements (Section 116)**: Mandatory filing criteria, asset disclosures, and Form IR-6 requirements.
- **Filing Deadlines & Penalties**: Section 118 statutory dates, late-filing penalties, and Active Taxpayer List (ATL) rules.
- **Salary Withholding (Section 149)**: Employer monthly tax deduction verifications and allowable tax credit offsets.

What tax obligations or provisions can I assist you with today?`,
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
  const [copiedIndex, setCopiedIndex] = useState(null);

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
      const response = await fetch(apiUrl('/api/chat'), {
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
        friendlyMessage = `The request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)} seconds. The advisory agent took too long to retrieve and generate a response. Please check your server and try again.`;
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
      await fetch(apiUrl(`/api/chat/${sessionId}`), { method: 'DELETE' });
    } catch (e) {
      // Non-blocking cleanup
    }
    const newSession = 'session_' + Math.random().toString(36).substring(2, 10);
    setSessionId(newSession);
    setMessages([
      {
        role: 'assistant',
        content: `### Conversation Cleared

> Ready for a new inquiry.

Ask any question regarding your Pakistan income tax return, Section 116 wealth statement requirements, or salary tax withholding.`,
      },
    ]);
  };

  const handleCopyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex((prev) => (prev === index ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const suggestedQuestions = [
    'What is the salary tax filing deadline for Tax Year 2025-26?',
    'Who is legally required to submit a wealth statement under Section 116?',
    'What changed in salary tax slabs between TY 2025-26 and TY 2026-27?',
    'How does employer tax withholding work on monthly salary?',
  ];

  // Preprocess statutory citations like [Source: ITO 2001, page 12] into custom markdown links
  const preprocessStatutoryMarkdown = (text) => {
    if (!text) return '';
    return text.replace(
      /\[Source:\s*([^,\]]+)(?:,\s*(?:page|p\.)\s*([^\]]+))?\]/gi,
      (match, source, page) => {
        const cleanSource = (source || '').trim();
        const cleanPage = (page || '').trim();
        return `[cite:${cleanSource}|${cleanPage}](#statutory-citation)`;
      }
    );
  };

  const markdownComponents = {
    h1: ({ children }) => <h3 className="chat-md-heading chat-md-h1">{children}</h3>,
    h2: ({ children }) => <h4 className="chat-md-heading chat-md-h2">{children}</h4>,
    h3: ({ children }) => <h5 className="chat-md-heading chat-md-h3">{children}</h5>,
    h4: ({ children }) => <h6 className="chat-md-heading chat-md-h4">{children}</h6>,
    p: ({ children }) => <p className="chat-md-p">{children}</p>,
    strong: ({ children }) => <strong className="chat-md-strong">{children}</strong>,
    em: ({ children }) => <em className="chat-md-em">{children}</em>,
    blockquote: ({ children }) => (
      <div className="chat-md-callout">
        <div className="chat-md-callout-icon">
          <ShieldIcon size={14} />
        </div>
        <div className="chat-md-callout-content">{children}</div>
      </div>
    ),
    table: ({ children }) => (
      <div className="chat-md-table-wrapper">
        <table className="chat-md-table">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="chat-md-thead">{children}</thead>,
    tbody: ({ children }) => <tbody className="chat-md-tbody">{children}</tbody>,
    tr: ({ children }) => <tr className="chat-md-tr">{children}</tr>,
    th: ({ children }) => <th className="chat-md-th">{children}</th>,
    td: ({ children }) => <td className="chat-md-td">{children}</td>,
    ul: ({ children }) => <ul className="chat-md-ul">{children}</ul>,
    ol: ({ children }) => <ol className="chat-md-ol">{children}</ol>,
    li: ({ children }) => <li className="chat-md-li">{children}</li>,
    hr: () => <hr className="chat-md-hr" />,
    code: ({ inline, className, children, ...props }) => (
      <code className="chat-md-code" {...props}>
        {children}
      </code>
    ),
    a: ({ href, children, ...props }) => {
      if (href === '#statutory-citation') {
        const text = String(children);
        if (text.startsWith('cite:')) {
          const parts = text.slice(5).split('|');
          const source = parts[0] || 'Statutory Source';
          const page = parts[1];
          return (
            <span className="statutory-citation-badge" title="Statutory Ordinance Reference">
              <CitationIcon size={12} />
              <span>{source}{page ? `, p. ${page}` : ''}</span>
            </span>
          );
        }
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="chat-md-link" {...props}>
          {children}
        </a>
      );
    },
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

              {isUser ? (
                <div className="chat-bubble-user">
                  {msg.content}
                </div>
              ) : (
                <div className={msg.isError ? 'chat-bubble-assistant chat-bubble-error' : 'chat-bubble-assistant'}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {preprocessStatutoryMarkdown(msg.content)}
                  </ReactMarkdown>

                  {!msg.isError && (
                    <div className="chat-assistant-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ShieldIcon size={12} />
                        <span>FBR Statutory Grounded</span>
                      </div>
                      <button
                        type="button"
                        className={`chat-copy-btn ${copiedIndex === index ? 'copied' : ''}`}
                        onClick={() => handleCopyMessage(msg.content, index)}
                        title="Copy advisory brief to clipboard"
                      >
                        {copiedIndex === index ? (
                          <>
                            <CheckIcon size={12} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <CopyIcon size={12} />
                            <span>Copy Brief</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

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
              )}
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
