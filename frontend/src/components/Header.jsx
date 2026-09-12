import React from 'react';
import { ShieldIcon, RefreshIcon, ChatIcon, FileTextIcon, CalculatorIcon } from './Icons';

export function Header({
  taxYear,
  setTaxYear,
  activeTab = 'assistant',
  setActiveTab,
  onResetAll,
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Brand Mark */}
        <div className="header-brand">
          <div className="header-brand-icon">
            <ShieldIcon size={22} />
          </div>
          <div>
            <div className="header-title-row">
              <h1 className="header-title">
                TaxSense PK
              </h1>
              <span className="badge badge-ochre" style={{ fontSize: '0.625rem' }}>
                Official Rates
              </span>
            </div>
            <p className="header-subtitle">
              Pakistan Salaried Income Tax Ledger & Statutory Assistant
            </p>
          </div>
        </div>

        {/* View Mode Navigation Switcher - 3 Tabs */}
        {setActiveTab && (
          <nav className="header-nav-tabs" aria-label="Main Navigation">
            <button
              type="button"
              className={`header-nav-tab ${activeTab === 'assistant' ? 'active' : ''}`}
              onClick={() => setActiveTab('assistant')}
            >
              <ChatIcon size={15} />
              <span>Statutory Advisory Assistant</span>
            </button>
            <button
              type="button"
              className={`header-nav-tab ${activeTab === 'salary-slip' ? 'active' : ''}`}
              onClick={() => setActiveTab('salary-slip')}
            >
              <FileTextIcon size={15} />
              <span>Salary Slip Audit</span>
              <span className="badge badge-ochre" style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>
                OCR
              </span>
            </button>
            <button
              type="button"
              className={`header-nav-tab ${activeTab === 'calculator' ? 'active' : ''}`}
              onClick={() => setActiveTab('calculator')}
            >
              <CalculatorIcon size={15} />
              <span>Tax Calculator</span>
            </button>
          </nav>
        )}

        {/* Action & Tax Year Controls */}
        <div className="header-actions">
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

          <div className="header-divider" />

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

