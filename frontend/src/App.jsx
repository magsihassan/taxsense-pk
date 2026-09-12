import React, { useState } from 'react';
import { Header } from './components/Header';
import { ChatAssistant } from './components/ChatAssistant';
import { SalarySlipAuditor } from './components/SalarySlipAuditor';
import { CalculatorLedger } from './components/CalculatorLedger';
import { ChatIcon, FileTextIcon, CalculatorIcon, ShieldIcon } from './components/Icons';

export function App() {
  const [taxYear, setTaxYear] = useState('2025-26');
  const [annualIncome, setAnnualIncome] = useState(2400000);
  // Default first tab is Statutory Advisory Assistant as requested
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant' | 'salary-slip' | 'calculator'
  const [externalPrompt, setExternalPrompt] = useState(null);

  const handleResetAll = () => {
    setAnnualIncome(2400000);
    setTaxYear('2025-26');
    setActiveTab('assistant');
    setExternalPrompt(null);
  };

  const handleSendToAssistant = (promptText) => {
    setExternalPrompt(promptText);
    setActiveTab('assistant');
  };

  const handleLoadIntoCalculator = (annualGross) => {
    setAnnualIncome(annualGross);
    setActiveTab('calculator');
  };

  return (
    <div className="app-shell">
      {/* Top Institutional Header */}
      <Header
        taxYear={taxYear}
        setTaxYear={setTaxYear}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetAll={handleResetAll}
      />

      {/* Main Workspace Container */}
      <main className="main-workspace">
        {/* Universal 3-Tab Switcher Bar */}
        <nav className="workspace-tab-nav" aria-label="Feature Workspace Tabs">
          <button
            type="button"
            className={`workspace-tab-btn ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
          >
            <ChatIcon size={16} />
            <span>1. Statutory Advisory Assistant</span>
          </button>
          <button
            type="button"
            className={`workspace-tab-btn ${activeTab === 'salary-slip' ? 'active' : ''}`}
            onClick={() => setActiveTab('salary-slip')}
          >
            <FileTextIcon size={16} />
            <span>2. Salary Slip Audit</span>
            <span className="badge badge-ochre" style={{ fontSize: '0.5625rem', padding: '1px 5px' }}>
              OCR
            </span>
          </button>
          <button
            type="button"
            className={`workspace-tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculator')}
          >
            <CalculatorIcon size={16} />
            <span>3. Tax Calculator</span>
          </button>
        </nav>

        {/* Tab 1: Statutory Advisory Assistant */}
        {activeTab === 'assistant' && (
          <div className="tab-view-container">
            <ChatAssistant
              externalPrompt={externalPrompt}
              onClearExternalPrompt={() => setExternalPrompt(null)}
              taxYear={taxYear}
            />
          </div>
        )}

        {/* Tab 2: Salary Slip Audit */}
        {activeTab === 'salary-slip' && (
          <div className="tab-view-container">
            <SalarySlipAuditor
              taxYear={taxYear}
              setTaxYear={setTaxYear}
              onLoadIntoCalculator={handleLoadIntoCalculator}
              onSendToAssistant={handleSendToAssistant}
            />
          </div>
        )}

        {/* Tab 3: Tax Calculator */}
        {activeTab === 'calculator' && (
          <div className="tab-view-container">
            <CalculatorLedger
              annualIncome={annualIncome}
              setAnnualIncome={setAnnualIncome}
              taxYear={taxYear}
              setTaxYear={setTaxYear}
              onSendToAssistant={handleSendToAssistant}
              onNavigateToSalarySlip={() => setActiveTab('salary-slip')}
            />
          </div>
        )}
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
