import React, { useState, useMemo } from 'react';
import { calculateTax, formatPKR, SURCHARGE_THRESHOLD } from '../utils/taxCalculator';
import { CalculatorIcon, InfoIcon, AlertCircleIcon, ChevronRightIcon, ChatIcon } from './Icons';

export function CalculatorLedger({
  annualIncome,
  setAnnualIncome,
  taxYear,
  setTaxYear,
  onSendToAssistant,
}) {
  const [inputMode, setInputMode] = useState('annual'); // 'annual' | 'monthly'

  // Derive calculated values deterministically
  const calc = useMemo(() => {
    return calculateTax(annualIncome, taxYear);
  }, [annualIncome, taxYear]);

  // Handle salary input change
  const handleInputChange = (e) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(rawValue) || 0;
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
    const text = `I earn an annual taxable salary of PKR ${annualIncome.toLocaleString()} for Tax Year ${taxYear}. Based on the tax calculator, my estimated annual tax is PKR ${calc.totalTax.toLocaleString()} (marginal rate ${calc.marginalRate}, effective rate ${calc.effectiveRate}). Can you explain how this slab applies, what tax credits or exemptions I might claim, and whether I need to file a wealth statement?`;
    onSendToAssistant(text);
  };

  return (
    <div className="ledger-card" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div className="card-header">
        <h2 className="card-title">
          <CalculatorIcon size={20} />
          <span>Salaried Tax Ledger</span>
        </h2>
        <span className="badge badge-primary">
          TY {taxYear}
        </span>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Salary Input Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" htmlFor="salary-input" style={{ margin: 0 }}>
              Gross Taxable Salary
            </label>
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
          </div>

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
        </div>

        {/* 4-Part Summary KPI Card */}
        <div style={{
          background: 'var(--color-neutral-surface)',
          border: '1px solid var(--color-neutral-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px',
          boxShadow: 'var(--shadow-subtle)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
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
            <span className="badge badge-primary" style={{ fontSize: '0.625rem' }}>
              Deterministic FBR Math
            </span>
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
                Includes 9% Surcharge of <strong>{formatPKR(calc.surcharge)}</strong> (taxable income &gt; PKR 10,000,000 in TY 2025-26).
              </span>
            </div>
          )}

          {/* Submetrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            borderTop: '1px solid var(--color-neutral-border-subtle)',
            paddingTop: '14px',
          }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', marginBottom: '2px', fontWeight: 500 }}>
                Monthly Withholding
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-neutral-text)' }} className="tabular-nums">
                {formatPKR(calc.monthlyWithholding)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', marginBottom: '2px', fontWeight: 500 }}>
                Effective Tax Rate
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-primary)' }} className="tabular-nums">
                {calc.effectiveRate}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-muted)', marginBottom: '2px', fontWeight: 500 }}>
                Marginal Slab Rate
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-neutral-text)' }} className="tabular-nums">
                {calc.marginalRate}
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Step Breakdown */}
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
            <span>Exact Statutory Calculation Formula</span>
          </div>
          <div style={{ color: 'var(--color-neutral-muted)', lineHeight: 1.5 }}>
            {calc.annualTaxableIncome <= 600000 ? (
              <span>Income of {formatPKR(calc.annualTaxableIncome)} falls within the tax-exempt threshold (up to PKR 600,000). Total tax liability is <strong>PKR 0</strong>.</span>
            ) : (
              <span>
                Base tax of <strong>{formatPKR(calc.baseTax)}</strong> + <strong>{calc.marginalRate}</strong> on excess over {formatPKR(calc.allSlabs[calc.matchedIndex].lower)} ({formatPKR(calc.excessOverLower)} × {calc.marginalRate} = <strong>{formatPKR(calc.marginalTaxAmount)}</strong>)
                {calc.hasSurcharge ? ` + 9% Surcharge of ${formatPKR(calc.surcharge)}` : ''} = <strong>{formatPKR(calc.totalTax)}</strong>.
              </span>
            )}
          </div>
        </div>

        {/* Tabular Slabs Visualizer */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span className="form-label" style={{ margin: 0 }}>
              FBR Tax Slabs (TY {taxYear})
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-muted)' }}>
              First Schedule, Part I
            </span>
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
                  <th style={{ padding: '8px 10px', color: 'var(--color-neutral-muted)', fontWeight: 600, textAlign: 'right' }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {calc.allSlabs.map((slab, idx) => {
                  const isCurrent = idx === calc.matchedIndex;
                  return (
                    <tr
                      key={idx}
                      style={{
                        background: isCurrent ? 'var(--color-primary-surface)' : (idx % 2 === 0 ? 'var(--color-neutral-surface)' : '#FAFCFB'),
                        borderBottom: idx < calc.allSlabs.length - 1 ? '1px solid var(--color-neutral-border-subtle)' : 'none',
                        fontWeight: isCurrent ? 600 : 400,
                        color: isCurrent ? 'var(--color-primary)' : 'var(--color-neutral-text)',
                      }}
                    >
                      <td style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isCurrent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }} />}
                        <span>{slab.label}</span>
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

        {/* Quick Transfer to Assistant Action */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAskAssistant}
          style={{ width: '100%', marginTop: '4px' }}
        >
          <ChatIcon size={16} />
          <span>Ask Assistant About This Calculation</span>
        </button>
      </div>
    </div>
  );
}
