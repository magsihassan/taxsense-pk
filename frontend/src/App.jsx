import React, { useState } from 'react';
import { Header } from './components/Header';
import { CalculatorLedger } from './components/CalculatorLedger';
import { SalarySlipAuditor } from './components/SalarySlipAuditor';
import { ChatAssistant } from './components/ChatAssistant';
import { CalculatorIcon, ChatIcon, FileTextIcon, ShieldIcon } from './components/Icons';

export function App() {
  const [taxYear, setTaxYear] = useState('2025-26');
  const [annualIncome, setAnnualIncome] = useState(2400000);
  const [activeView, setActiveView] = useState('calculator'); // 'calculator' | 'salary-slip'
  const [activeMobileTab, setActiveMobileTab] = useState('calculator'); // 'calculator' | 'salary-slip' | 'assistant'
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

  const handleLoadIntoCalculator = (annualGross) => {
    setAnnualIncome(annualGross);
    setActiveView('calculator');
    setActiveMobileTab('calculator');
  };

  // Keep mobile tab and desktop activeView aligned when switched from header
  const handleSelectView = (view) => {
    setActiveView(view);
    setActiveMobileTab(view);
  };

  return (
    <div className="app-shell">
      {/* Top Institutional Header */}
      <Header
        taxYear={taxYear}
        setTaxYear={setTaxYear}
        activeView={activeView}
        setActiveView={handleSelectView}
        onResetAll={handleResetAll}
      />

      {/* Main Workspace Container */}
      <main className="main-workspace">
        {/* Mobile / Tablet Tab Switcher */}
        <div className="mobile-view-tabs" style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            className={`mobile-tab-btn ${activeMobileTab === 'calculator' ? 'active' : ''}`}
            onClick={() => {
              setActiveMobileTab('calculator');
              setActiveView('calculator');
            }}
          >
            <CalculatorIcon size={16} />
            <span>Calculator</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-btn ${activeMobileTab === 'salary-slip' ? 'active' : ''}`}
            onClick={() => {
              setActiveMobileTab('salary-slip');
              setActiveView('salary-slip');
            }}
          >
            <FileTextIcon size={16} />
            <span>Salary Slip</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-btn ${activeMobileTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveMobileTab('assistant')}
          >
            <ChatIcon size={16} />
            <span>Assistant</span>
          </button>
        </div>

        {/* Left Cockpit: Calculator Ledger OR Salary Slip Auditor */}
        <div className={`cockpit-column ${(activeMobileTab === 'calculator' || activeMobileTab === 'salary-slip') ? 'active-tab' : ''}`}>
          {activeView === 'calculator' ? (
            <CalculatorLedger
              annualIncome={annualIncome}
              setAnnualIncome={setAnnualIncome}
              taxYear={taxYear}
              setTaxYear={setTaxYear}
              onSendToAssistant={handleSendToAssistant}
              onNavigateToSalarySlip={() => handleSelectView('salary-slip')}
            />
          ) : (
            <SalarySlipAuditor
              taxYear={taxYear}
              setTaxYear={setTaxYear}
              onLoadIntoCalculator={handleLoadIntoCalculator}
              onSendToAssistant={handleSendToAssistant}
            />
          )}
        </div>

        {/* Right Cockpit: Conversational Chat Assistant */}
        <div className={`cockpit-column ${activeMobileTab === 'assistant' ? 'active-tab' : ''}`}>
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
