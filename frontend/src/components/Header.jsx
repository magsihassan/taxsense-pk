import React from 'react';
import { ShieldIcon, RefreshIcon } from './Icons';

export function Header({ taxYear, setTaxYear, onResetAll, apiStatus = 'connected' }) {
  return (
    <header style={{
      background: 'var(--color-neutral-surface)',
      borderBottom: '1px solid var(--color-neutral-border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 var(--spacing-lg)',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand Mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            background: 'var(--color-primary)',
            color: 'var(--color-neutral-surface)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-primary-deep)',
            boxShadow: '0 1px 3px rgba(14, 56, 43, 0.15)',
          }}>
            <ShieldIcon size={22} />
          </div>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--color-primary)',
                letterSpacing: '-0.02em',
              }}>
                TaxSense PK
              </span>
              <span className="badge badge-ochre" style={{ fontSize: '0.625rem' }}>
                Official Rates
              </span>
            </div>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--color-neutral-muted)',
              fontWeight: 500,
              lineHeight: 1.2,
            }}>
              Pakistan Salaried Income Tax Ledger & Statutory Assistant
            </p>
          </div>
        </div>

        {/* Action & Tax Year Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Tax Year Selector in Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-neutral-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Filing Year
            </span>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-option ${taxYear === '2025-26' ? 'active' : ''}`}
                onClick={() => setTaxYear('2025-26')}
                title="Tax Year 2025-26 (Return filing deadline Sept 30, 2026)"
              >
                TY 2025-26
              </button>
              <button
                type="button"
                className={`segmented-option ${taxYear === '2026-27' ? 'active' : ''}`}
                onClick={() => setTaxYear('2026-27')}
                title="Tax Year 2026-27 (Current ongoing year, Finance Act 2026)"
              >
                TY 2026-27
              </button>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--color-neutral-border)' }} />

          {/* Reset / New Session */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResetAll}
            title="Clear current salary computation and start a fresh advisory session"
            style={{ padding: '7px 12px', fontSize: '0.8125rem' }}
          >
            <RefreshIcon size={14} />
            <span>New Session</span>
          </button>
        </div>
      </div>
    </header>
  );
}
