import React, { useState } from 'react';
import { Header } from './components/Header';
import { CalculatorLedger } from './components/CalculatorLedger';
import { ChatAssistant } from './components/ChatAssistant';
import { CalculatorIcon, ChatIcon, ShieldIcon } from './components/Icons';

export function App() {
  const [taxYear, setTaxYear] = useState('2025-26');
  const [annualIncome, setAnnualIncome] = useState(2400000);
  const [activeMobileTab, setActiveMobileTab] = useState('calculator'); // 'calculator' | 'assistant'
  const [externalPrompt, setExternalPrompt] = useState(null);

  const handleResetAll = () => {
    setAnnualIncome(2400000);
    setTaxYear('2025-26');
    setExternalPrompt(null);
  };

  const handleSendToAssistant = (promptText) => {
    setExternalPrompt(promptText);
    setActiveMobileTab('assistant');
  };

  return (
    <div className="app-shell">
      {/* Top Institutional Header */}
      <Header
        taxYear={taxYear}
        setTaxYear={setTaxYear}
        onResetAll={handleResetAll}
      />

      {/* Main Workspace Container */}
      <main className="main-workspace">
        {/* Mobile / Tablet Tab Switcher */}
        <div className="mobile-view-tabs" style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            className={`mobile-tab-btn ${activeMobileTab === 'calculator' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('calculator')}
          >
            <CalculatorIcon size={16} />
            <span>Tax Calculator</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-btn ${activeMobileTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('assistant')}
          >
            <ChatIcon size={16} />
            <span>Statutory Assistant</span>
          </button>
        </div>

        {/* Left Cockpit: Calculator Ledger */}
        <div style={{
          display: activeMobileTab === 'calculator' || window.innerWidth > 1024 ? 'block' : 'none',
        }}>
          <CalculatorLedger
            annualIncome={annualIncome}
            setAnnualIncome={setAnnualIncome}
            taxYear={taxYear}
            setTaxYear={setTaxYear}
            onSendToAssistant={handleSendToAssistant}
          />
        </div>

        {/* Right Cockpit: Conversational Chat Assistant */}
        <div style={{
          display: activeMobileTab === 'assistant' || window.innerWidth > 1024 ? 'block' : 'none',
        }}>
          <ChatAssistant
            externalPrompt={externalPrompt}
            onClearExternalPrompt={() => setExternalPrompt(null)}
            taxYear={taxYear}
          />
        </div>
      </main>

      {/* Institutional Legal Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--color-neutral-border)',
        background: 'var(--color-neutral-surface)',
        padding: '16px var(--spacing-lg)',
        fontSize: '0.75rem',
        color: 'var(--color-neutral-muted)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldIcon size={14} />
            <span>TaxSense PK · Salaried Individual Tax System (FBR Ordinance 2001 & Finance Act 2026)</span>
          </div>
          <div>
            <span>Statutory Disclaimer: Informational calculation & advisory tool. Not a substitute for official FBR Iris filing or legal counsel.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
