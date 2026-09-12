import React, { useState, useMemo } from 'react';
import { calculateTax, formatPKR, parseCleanIncome, SURCHARGE_THRESHOLD, MAX_CALCULABLE_INCOME } from '../utils/taxCalculator';
import { CalculatorIcon, InfoIcon, AlertCircleIcon, ChatIcon, CopyIcon, CheckIcon, ChevronRightIcon } from './Icons';

export function CalculatorLedger({
  annualIncome,
  setAnnualIncome,
  taxYear,
  setTaxYear,
  onSendToAssistant,
  onNavigateToSalarySlip,
}) {
  const [inputMode, setInputMode] = useState('annual'); // 'annual' | 'monthly'
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSlabsExpanded, setIsSlabsExpanded] = useState(false);

  // Derive calculated values deterministically
  const calc = useMemo(() => {
    return calculateTax(annualIncome, taxYear);
  }, [annualIncome, taxYear]);

  // Comparative calculations across both tax years for budget impact
  const comp2025 = useMemo(() => calculateTax(annualIncome, '2025-26'), [annualIncome]);
  const comp2026 = useMemo(() => calculateTax(annualIncome, '2026-27'), [annualIncome]);
  const taxDiff = comp2025.totalTax - comp2026.totalTax;

  // Monthly payroll breakdown
  const monthlyGross = Math.round(calc.annualTaxableIncome / 12);
  const monthlyNetTakeHome = Math.max(0, monthlyGross - calc.monthlyWithholding);

  // Next slab headroom calculation
  const nextSlab = calc.allSlabs[calc.matchedIndex + 1] || null;
  const headroomToNextSlab = nextSlab ? Math.max(0, nextSlab.lower - calc.annualTaxableIncome) : null;

  // Handle salary input change with hardened parsing
  const handleInputChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    const num = parseCleanIncome(rawValue);
    if (inputMode === 'monthly') {
      setAnnualIncome(num * 12);
    } else {
      setAnnualIncome(num);
    }
  };

  const displayedInputValue = useMemo(() => {
    const val = inputMode === 'monthly' ? Math.round(annualIncome / 12) : annualIncome;
    return val > 0 ? val.toLocaleString('en-US') : '';
  }, [annualIncome, inputMode]);

  const quickPresets = [
    { label: 'PKR 1.2M', val: 1200000 },
    { label: 'PKR 2.4M', val: 2400000 },
    { label: 'PKR 3.6M', val: 3600000 },
    { label: 'PKR 6.0M', val: 6000000 },
    { label: 'PKR 12M (Surcharge)', val: 12000000 },
  ];

  const handleAskAssistant = () => {
    const text = `I earn an annual taxable salary of PKR ${annualIncome.toLocaleString()} for Tax Year ${taxYear}. Based on the tax calculator, my estimated annual tax is PKR ${calc.totalTax.toLocaleString()} (marginal rate ${calc.marginalRate}, effective rate ${calc.effectiveRate}, estimated monthly net take-home PKR ${monthlyNetTakeHome.toLocaleString()}). Can you explain how this slab applies, what tax credits or exemptions I might claim, and whether I need to file a wealth statement?`;
    onSendToAssistant(text);
  };

  const fallbackCopy = (text) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  const handleCopyBreakdown = () => {
    const text = `TaxSense PK — Salaried Tax Computation
Tax Year: TY ${taxYear}
Annual Gross Taxable Salary: PKR ${calc.annualTaxableIncome.toLocaleString()}
Total Estimated Annual Tax: PKR ${calc.totalTax.toLocaleString()}
Monthly Payroll Withholding: PKR ${calc.monthlyWithholding.toLocaleString()}
Estimated Monthly Net Take-Home: PKR ${monthlyNetTakeHome.toLocaleString()}
Effective Tax Rate: ${calc.effectiveRate}
Marginal Slab Rate: ${calc.marginalRate} (Applies on excess above PKR ${calc.allSlabs[calc.matchedIndex].lower.toLocaleString()})
${calc.hasSurcharge ? `Includes 9% Surcharge of PKR ${calc.surcharge.toLocaleString()} (Income > PKR 10M in TY 2025-26)\n` : ''}Governing Law: FBR Income Tax Ordinance 2001 (First Schedule, Part I)`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        })
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  return (
    <div className="ledger-card" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div className="card-header">
        <h2 className="card-title">
          <CalculatorIcon size={20} />
          <span>Salaried Tax Ledger</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-primary">
            TY {taxYear}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-muted)', fontWeight: 500 }}>
            {taxYear === '2025-26' ? 'Filing Deadline: Sept 30, 2026' : 'Ongoing Tax Year'}
          </span>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Salary Input Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label className="form-label" htmlFor="salary-input" style={{ margin: 0 }}>
                Gross Taxable Salary
              </label>
              <div
                className="info-hint-container"
                onMouseEnter={() => setActiveTooltip('salary')}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <button
                  type="button"
                  className="info-hint-trigger"
                  aria-label="Gross taxable salary definition"
                  onClick={() => setActiveTooltip(activeTooltip === 'salary' ? null : 'salary')}
                >
                  <InfoIcon size={13} />
                </button>
                {activeTooltip === 'salary' && (
                  <div className="info-popover">
                    Includes basic salary, taxable allowances, and bonuses. Excludes tax-exempt medical allowance (up to 10% of basic pay).
                  </div>
                )}
              </div>
            </div>

            <div className="segmented-control" style={{ padding: '2px' }}>
              <button
                type="button"
                className={`segmented-option ${inputMode === 'annual' ? 'active' : ''}`}
                onClick={() => setInputMode('annual')}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                Annual
              </button>
              <button
                type="button"
                className={`segmented-option ${inputMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setInputMode('monthly')}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="input-group">
            <span className="input-prefix">PKR</span>
            <input
              id="salary-input"
              className="form-input"
              type="text"
              inputMode="numeric"
              placeholder={inputMode === 'annual' ? 'e.g. 2,400,000' : 'e.g. 200,000'}
              value={displayedInputValue}
              onChange={handleInputChange}
            />
            {annualIncome > 0 && (
              <button
                type="button"
                onClick={() => setAnnualIncome(0)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-neutral-muted)',
                  padding: '0 12px',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: 1,
                }}
                title="Clear salary amount"
                aria-label="Clear salary amount"
              >
                ×
              </button>
            )}
          </div>

          {calc.isCapped && (
            <div style={{
              background: '#FFF8E6',
              border: '1px solid #F2CF77',
              borderRadius: 'var(--radius-xs)',
              padding: '8px 12px',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--color-accent)',
            }}>
              <AlertCircleIcon size={14} />
              <span>Calculation capped at maximum stable threshold of PKR 1 Billion.</span>
            </div>
          )}

          <p style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', marginTop: '6px', lineHeight: 1.3 }}>
            Enter your total annual gross salary from your payslip or employment agreement.
          </p>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {quickPresets.map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setAnnualIncome(preset.val)}
                className="btn btn-ghost"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  border: '1px solid var(--color-neutral-border)',
                  borderRadius: 'var(--radius-xs)',
                  background: annualIncome === preset.val ? 'var(--color-primary-surface)' : 'var(--color-neutral-surface)',
                  color: annualIncome === preset.val ? 'var(--color-primary)' : 'var(--color-neutral-muted)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {onNavigateToSalarySlip && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'var(--color-primary-surface)',
              border: '1px solid var(--color-neutral-border)',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500 }}>
                Have an official salary slip PDF or image?
              </span>
              <button
                type="button"
                onClick={onNavigateToSalarySlip}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                <span>Audit Withholding via OCR</span>
                <ChevronRightIcon size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 4-Part Summary KPI Card + Delightful Take-Home Spotlight */}
        <div style={{
          background: 'var(--color-neutral-surface)',
          border: '1px solid var(--color-neutral-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px',
          boxShadow: 'var(--shadow-subtle)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--color-neutral-muted)',
            }}>
              Total Annual Tax Liability
            </span>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCopyBreakdown}
              style={{
                padding: '3px 8px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: '1px solid var(--color-neutral-border)',
                borderRadius: 'var(--radius-xs)',
                color: copied ? 'var(--color-semantic-deduction)' : 'var(--color-neutral-muted)',
              }}
              title="Copy computation breakdown to clipboard"
            >
              {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            lineHeight: 1.15,
            margin: '6px 0 16px',
          }} className="tabular-nums">
            {formatPKR(calc.totalTax)}
          </div>

          {/* Surcharge Alert if applicable */}
          {calc.hasSurcharge && (
            <div style={{
              background: '#FDF2F2',
              border: '1px solid #F8B4B4',
              borderRadius: 'var(--radius-xs)',
              padding: '8px 12px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8125rem',
              color: 'var(--color-semantic-surcharge)',
            }}>
              <AlertCircleIcon size={16} />
              <span>
                Includes 9% Surcharge of <strong>{formatPKR(calc.surcharge)}</strong> (applies to income &gt; PKR 10M in TY 2025-26 under Finance Act 2025).
              </span>
            </div>
          )}

          {/* Submetrics Grid with Educational Tooltips */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            borderTop: '1px solid var(--color-neutral-border-subtle)',
            paddingTop: '14px',
          }}>
            {/* Monthly Withholding */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', fontWeight: 500 }}>
                  Monthly Withholding
                </span>
                <div
                  className="info-hint-container"
                  onMouseEnter={() => setActiveTooltip('withholding')}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <button type="button" className="info-hint-trigger" aria-label="Monthly withholding definition">
                    <InfoIcon size={11} />
                  </button>
                  {activeTooltip === 'withholding' && (
                    <div className="info-popover">
                      The statutory payroll deduction your employer withholds each month from your salary under Section 149.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-neutral-text)' }} className="tabular-nums">
                {formatPKR(calc.monthlyWithholding)}
              </div>
            </div>

            {/* Effective Tax Rate */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', fontWeight: 500 }}>
                  Effective Rate
                </span>
                <div
                  className="info-hint-container"
                  onMouseEnter={() => setActiveTooltip('effective')}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <button type="button" className="info-hint-trigger" aria-label="Effective tax rate definition">
                    <InfoIcon size={11} />
                  </button>
                  {activeTooltip === 'effective' && (
                    <div className="info-popover">
                      Your true overall tax percentage (Total Tax ÷ Annual Salary). This represents what you actually pay across all slabs.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-primary)' }} className="tabular-nums">
                {calc.effectiveRate}
              </div>
            </div>

            {/* Marginal Slab Rate */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', fontWeight: 500 }}>
                  Marginal Rate
                </span>
                <div
                  className="info-hint-container"
                  onMouseEnter={() => setActiveTooltip('marginal')}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <button type="button" className="info-hint-trigger" aria-label="Marginal slab rate definition">
                    <InfoIcon size={11} />
                  </button>
                  {activeTooltip === 'marginal' && (
                    <div className="info-popover">
                      Applies strictly to income above PKR {calc.allSlabs[calc.matchedIndex].lower.toLocaleString()}, NEVER your whole salary.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-neutral-text)' }} className="tabular-nums">
                {calc.marginalRate}
              </div>
            </div>
          </div>

          {/* Delightful Touch: Net Monthly Take-Home Pay Spotlight */}
          <div style={{
            marginTop: '16px',
            borderTop: '1px solid var(--color-neutral-border-subtle)',
            background: 'var(--color-primary-surface)',
            margin: '16px -18px -18px -18px',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <span>Estimated In-Hand Take-Home Pay</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-muted)' }}>
                PKR {monthlyGross.toLocaleString()} gross − PKR {calc.monthlyWithholding.toLocaleString()} tax
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
            }} className="tabular-nums">
              {formatPKR(monthlyNetTakeHome)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-neutral-muted)' }}>/ month</span>
            </div>
          </div>
        </div>

        {/* Delightful Touch: Tax Year Budget Comparison Banner */}
        {annualIncome > 600000 && (
          <div style={{
            background: taxDiff > 0 ? '#E8F5EE' : (taxDiff < 0 ? '#FDF2F2' : 'var(--color-neutral-ground)'),
            border: `1px solid ${taxDiff > 0 ? '#C0E3CF' : (taxDiff < 0 ? '#F8B4B4' : 'var(--color-neutral-border)')}`,
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8125rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge ${taxDiff > 0 ? 'badge-relief' : 'badge-primary'}`}>
                {taxYear === '2025-26' ? 'Budget FY 2026-27 Outlook' : 'Comparison vs. TY 2025-26'}
              </span>
              <span style={{ color: 'var(--color-neutral-text)' }}>
                {taxDiff > 0
                  ? <span>Under TY 2026-27, you save <strong>{formatPKR(taxDiff)}</strong>/year (<strong>{formatPKR(Math.round(taxDiff / 12))}</strong>/month in relief).</span>
                  : (taxDiff < 0
                      ? <span>Tax increases by <strong>{formatPKR(Math.abs(taxDiff))}</strong>/year in TY 2026-27 under the new slab revision.</span>
                      : <span>Tax liability is identical across both tax years.</span>)}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTaxYear(taxYear === '2025-26' ? '2026-27' : '2025-26')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: '1px solid var(--color-neutral-border)',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--color-neutral-surface)',
                fontWeight: 600,
              }}
            >
              Switch to TY {taxYear === '2025-26' ? '2026-27' : '2025-26'}
            </button>
          </div>
        )}

        {/* Calculation Step Breakdown + Headroom Insight */}
        <div style={{
          background: 'var(--color-neutral-ground)',
          border: '1px solid var(--color-neutral-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px',
          fontSize: '0.8125rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
            color: 'var(--color-neutral-text)',
            marginBottom: '8px',
          }}>
            <InfoIcon size={15} />
            <span>Statutory Calculation Formula</span>
          </div>
          <div style={{ color: 'var(--color-neutral-muted)', lineHeight: 1.55 }}>
            {calc.annualTaxableIncome <= 600000 ? (
              <span>Your annual salary of {formatPKR(calc.annualTaxableIncome)} is within the statutory tax-free threshold (up to PKR 600,000). Total tax owed is <strong>PKR 0</strong>.</span>
            ) : (
              <div>
                <p style={{ marginBottom: '6px' }}>
                  Your salary of <strong>{formatPKR(calc.annualTaxableIncome)}</strong> places you in <strong>Slab {calc.matchedIndex + 1}</strong>. You owe a fixed base tax of <strong>{formatPKR(calc.baseTax)}</strong> on the first {formatPKR(calc.allSlabs[calc.matchedIndex].lower)}, plus <strong>{calc.marginalRate}</strong> on the remaining excess of {formatPKR(calc.excessOverLower)} ({calc.marginalRate} × {formatPKR(calc.excessOverLower)} = <strong>{formatPKR(calc.marginalTaxAmount)}</strong>){calc.hasSurcharge ? ` + 9% Surcharge of ${formatPKR(calc.surcharge)}` : ''}, giving total annual tax of <strong>{formatPKR(calc.totalTax)}</strong>.
                </p>
                {headroomToNextSlab && (
                  <p style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                    Bracket Headroom: You have <strong>{formatPKR(headroomToNextSlab)}</strong> in headroom before entering the next marginal bracket ({Math.round(nextSlab.rate * 100)}% above {formatPKR(nextSlab.lower)}).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabular Slabs Visualizer with Mobile Collapsible Support */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span className="form-label" style={{ margin: 0 }}>
              FBR Official Slab Schedule (TY {taxYear})
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsSlabsExpanded(!isSlabsExpanded)}
              style={{
                padding: '2px 6px',
                fontSize: '0.75rem',
                color: 'var(--color-primary)',
                fontWeight: 600,
              }}
            >
              {isSlabsExpanded ? 'Collapse Slabs ▴' : `View All ${calc.allSlabs.length} Slabs ▾`}
            </button>
          </div>

          <div style={{
            border: '1px solid var(--color-neutral-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-body)',
            }}>
              <thead>
                <tr style={{
                  background: 'var(--color-neutral-ground)',
                  borderBottom: '1px solid var(--color-neutral-border)',
                  textAlign: 'left',
                }}>
                  <th style={{ padding: '8px 10px', color: 'var(--color-neutral-muted)', fontWeight: 600 }}>Slab Range</th>
                  <th style={{ padding: '8px 10px', color: 'var(--color-neutral-muted)', fontWeight: 600, textAlign: 'right' }}>Base Tax</th>
                  <th style={{ padding: '8px 10px', color: 'var(--color-neutral-muted)', fontWeight: 600, textAlign: 'right' }}>Excess Rate</th>
                </tr>
              </thead>
              <tbody>
                {calc.allSlabs
                  .filter((_, idx) => isSlabsExpanded || idx === calc.matchedIndex)
                  .map((slab, filteredIdx) => {
                    const originalIdx = isSlabsExpanded ? filteredIdx : calc.matchedIndex;
                    const isCurrent = originalIdx === calc.matchedIndex;
                    return (
                      <tr
                        key={originalIdx}
                        style={{
                          background: isCurrent ? 'var(--color-primary-surface)' : (originalIdx % 2 === 0 ? 'var(--color-neutral-surface)' : '#FAFCFB'),
                          borderBottom: '1px solid var(--color-neutral-border-subtle)',
                          fontWeight: isCurrent ? 600 : 400,
                          color: isCurrent ? 'var(--color-primary)' : 'var(--color-neutral-text)',
                        }}
                      >
                        <td style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isCurrent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }} />}
                          <span>{slab.label}</span>
                          {!isSlabsExpanded && (
                            <span className="badge badge-primary" style={{ fontSize: '0.5625rem', padding: '1px 5px', marginLeft: 'auto' }}>
                              Your Slab
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }} className="tabular-nums">
                          {slab.baseTax > 0 ? formatPKR(slab.baseTax) : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }} className="tabular-nums">
                          {Math.round(slab.rate * 100)}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer to Assistant Action */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAskAssistant}
          style={{ width: '100%', marginTop: '4px' }}
        >
          <ChatIcon size={16} />
          <span>Consult Assistant on This Calculation</span>
        </button>
      </div>
    </div>
  );
}
