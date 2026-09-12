import React, { useState, useRef } from 'react';
import {
  UploadCloudIcon,
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  TrashIcon,
  RefreshIcon,
  ShieldIcon,
  CalculatorIcon,
  ChatIcon,
  CopyIcon,
  CheckIcon,
} from './Icons';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE_MB = 10;

export function SalarySlipAuditor({
  taxYear,
  setTaxYear,
  onLoadIntoCalculator,
  onSendToAssistant,
}) {
  const [file, setFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [copiedHR, setCopiedHR] = useState(false);

  const fileInputRef = useRef(null);

  const loadingSteps = [
    'Scanning document text layers & OCR preprocessing...',
    'Extracting gross pay, allowances, and withholding deductions...',
    'Reconciling monthly deduction against FBR Section 149 schedule...',
  ];

  const validateAndSelectFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return;

    const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Allowed types: PDF, JPG, PNG.`);
      return;
    }

    const sizeMb = selectedFile.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      setError(`File size (${sizeMb.toFixed(1)}MB) exceeds the 10MB limit.`);
      return;
    }

    setFile(selectedFile);
    setResult(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  // Load sample slips for instantaneous testing
  const handleLoadSample = async (samplePath, filename) => {
    setError(null);
    setResult(null);
    try {
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error('Failed to load sample slip file');
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], filename, { type: 'application/pdf' });
      setFile(sampleFile);
    } catch (err) {
      setError('Unable to load sample slip. Please upload a file manually.');
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setLoadingStepIndex(0);

    // Step cycle timer for realistic institutional progress feedback
    const stepInterval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 2200);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tax_year', taxYear);

    try {
      const response = await fetch('/api/salary-slip/analyze', {
        method: 'POST',
        body: formData,
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Analysis failed with status ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.message || 'An unexpected error occurred during salary slip analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Format currency with tabular clarity
  const formatAmount = (val) => {
    if (val === null || val === undefined) return '—';
    return `PKR ${Number(val).toLocaleString('en-US')}`;
  };

  // Consultation trigger: send findings to ChatAssistant
  const handleConsultAssistant = () => {
    if (!result || !result.reconciliation) return;
    const { extraction, reconciliation } = result;
    const isMismatch = reconciliation.is_mismatch;
    const gross = extraction.gross_salary ? `PKR ${Number(extraction.gross_salary).toLocaleString()}` : 'unspecified';
    const withheld = extraction.income_tax_deducted ? `PKR ${Number(extraction.income_tax_deducted).toLocaleString()}` : 'unspecified';
    const expected = reconciliation.correct_monthly_tax ? `PKR ${Math.round(reconciliation.correct_monthly_tax).toLocaleString()}` : 'unspecified';

    let prompt = '';
    if (isMismatch) {
      prompt = `I audited my salary slip for Tax Year ${taxYear}. My monthly gross salary is ${gross}, and my employer withheld ${withheld} in monthly income tax. However, the expected FBR monthly withholding is ${expected}, resulting in an annual discrepancy of PKR ${Math.abs(reconciliation.difference_annual).toLocaleString()} (${reconciliation.difference_annual < 0 ? 'under-withheld' : 'over-withheld'}). What does Section 149 of the Income Tax Ordinance say about employer withholding adjustments, and what steps should I take with my payroll department or Iris filing?`;
    } else {
      prompt = `My salary slip for Tax Year ${taxYear} shows a monthly gross salary of ${gross} and monthly withholding tax of ${withheld}, which reconciles with expected FBR rates. Can you confirm if I still need to obtain an annual tax deduction certificate (Section 164) from my employer before filing on Iris?`;
    }

    if (onSendToAssistant) {
      onSendToAssistant(prompt);
    }
  };

  // Generate and copy a formal audit note for HR / Payroll division
  const handleCopyHRMemo = () => {
    if (!result || !result.reconciliation) return;
    const { extraction, reconciliation } = result;
    const gross = extraction.gross_salary ? `PKR ${Number(extraction.gross_salary).toLocaleString()}` : 'N/A';
    const withheld = extraction.income_tax_deducted ? `PKR ${Number(extraction.income_tax_deducted).toLocaleString()}` : 'N/A';
    const expected = reconciliation.correct_monthly_tax ? `PKR ${Math.round(reconciliation.correct_monthly_tax).toLocaleString()}` : 'N/A';
    const varianceAnnual = reconciliation.difference_annual
      ? `${reconciliation.difference_annual < 0 ? '-' : '+'}PKR ${Math.abs(Math.round(reconciliation.difference_annual)).toLocaleString()}`
      : 'PKR 0';
    const statusText = reconciliation.is_mismatch
      ? (reconciliation.difference_annual < 0 ? 'Under-withheld' : 'Over-withheld')
      : 'Reconciled & Compliant';

    const memo = `Subject: Inquiry Regarding Monthly Tax Withholding Calculation (TY ${taxYear})

Dear Payroll & Finance Team,

I am writing to request verification of the monthly tax withholding calculation on my salary statement for the pay period: ${extraction.pay_period || 'Current Pay Period'}.

Based on the official FBR salaried individual tax slabs for Tax Year ${taxYear}:
• Monthly Gross Salary: ${gross}
• Actual Monthly Tax Deducted on Slip: ${withheld}
• Prescribed FBR Monthly Tax Deduction: ${expected}
• Estimated Annual Variance: ${varianceAnnual} (${statusText})

Statutory Note: Under Section 149 of the Income Tax Ordinance 2001, withholding tax from salary is required to be deducted at the average rate calculated on total estimated annual income, with adjustments made across remaining salary periods before June 30.

Could you please review my payroll tax deduction to ensure alignment with FBR Schedule I?

Employee Name: ${extraction.employee_name || 'Employee'}
Employer: ${extraction.employer_name || 'Employer'}
Generated via TaxSense PK Statutory Ledger`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(memo);
      setCopiedHR(true);
      setTimeout(() => setCopiedHR(false), 2500);
    }
  };

  const extraction = result?.extraction;
  const reconciliation = result?.reconciliation;
  const isMismatch = reconciliation?.is_mismatch;
  const isUnderWithheld = isMismatch && reconciliation?.difference_annual < 0;

  return (
    <div className="ledger-card" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <FileTextIcon size={20} className="text-primary" />
          <span>Salary Slip Audit & Withholding Reconciler</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-primary">FBR Section 149</span>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tax Year & Mode Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--color-neutral-border-subtle)',
        }}>
          <div>
            <span className="form-label" style={{ marginBottom: '2px' }}>Applicable Filing Year</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-muted)' }}>
              Reconciliation evaluates withholding against this year's official slabs
            </span>
          </div>

          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-option ${taxYear === '2025-26' ? 'active' : ''}`}
              onClick={() => setTaxYear('2025-26')}
              disabled={isAnalyzing}
            >
              TY 2025-26
            </button>
            <button
              type="button"
              className={`segmented-option ${taxYear === '2026-27' ? 'active' : ''}`}
              onClick={() => setTaxYear('2026-27')}
              disabled={isAnalyzing}
            >
              TY 2026-27
            </button>
          </div>
        </div>

        {/* Upload Zone (Visible when no result or when changing file) */}
        {!result && (
          <>
            {!file ? (
              <div
                className={`salary-dropzone ${isDragActive ? 'drag-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
                aria-label="Upload salary slip PDF or image"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />
                <div className="dropzone-icon-box">
                  <UploadCloudIcon size={22} />
                </div>
                <div>
                  <p className="dropzone-text-primary">
                    Drop your salary slip here, or <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>browse</span>
                  </p>
                  <p className="dropzone-text-secondary">
                    Supports PDF, JPG, PNG · Max 10MB · Privacy protected (cleaned immediately after analysis)
                  </p>
                </div>
              </div>
            ) : (
              <div className="salary-file-preview">
                <div className="salary-file-info">
                  <div className="salary-file-icon">
                    <FileTextIcon size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="salary-file-name">{file.name}</p>
                    <p className="salary-file-meta">
                      {(file.size / 1024).toFixed(1)} KB · Ready for statutory audit
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleReset}
                    disabled={isAnalyzing}
                    title="Remove selected file"
                    style={{ padding: '6px 8px' }}
                  >
                    <TrashIcon size={15} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '10px 14px',
                background: '#FCE8E8',
                border: '1px solid #F4BEBE',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-semantic-surcharge)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <AlertTriangleIcon size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Sample Slips for Testing */}
            <div className="sample-presets-bar">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: 'var(--color-neutral-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>
                  Or test with verified sample payslips
                </span>
              </div>
              <div className="sample-chips-row">
                <button
                  type="button"
                  className="sample-chip-btn"
                  onClick={() => handleLoadSample('/samples/s2.pdf', 's2_meridian_bank_underwithheld.pdf')}
                  disabled={isAnalyzing}
                  title="Meridian Bank slip with under-withheld tax (generates Fiscal Ochre alert)"
                >
                  <AlertTriangleIcon size={13} style={{ color: 'var(--color-accent)' }} />
                  <span>Sample 1: Meridian Bank (Under-withheld Alert)</span>
                </button>
                <button
                  type="button"
                  className="sample-chip-btn"
                  onClick={() => handleLoadSample('/samples/s1.pdf', 's1_vertex_systems_matched.pdf')}
                  disabled={isAnalyzing}
                  title="Vertex Systems slip with exact withholding (generates Calm Confirmation)"
                >
                  <CheckCircleIcon size={13} style={{ color: 'var(--color-semantic-deduction)' }} />
                  <span>Sample 2: Vertex Systems (Reconciled Match)</span>
                </button>
                <button
                  type="button"
                  className="sample-chip-btn"
                  onClick={() => handleLoadSample('/samples/s3.pdf', 's3_alfalah_traders_matched.pdf')}
                  disabled={isAnalyzing}
                  title="Al-Falah Traders slip with exact match"
                >
                  <CheckCircleIcon size={13} style={{ color: 'var(--color-semantic-deduction)' }} />
                  <span>Sample 3: Al-Falah Traders (Exact Match)</span>
                </button>
              </div>
            </div>

            {/* Action Bar */}
            {file && !isAnalyzing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAnalyze}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Audit Salary Slip for TY {taxYear}</span>
                  <ArrowRightIcon size={16} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Clear Loading State */}
        {isAnalyzing && (
          <div className="salary-loading-state">
            <div className="statutory-loader-spinner" />
            <div>
              <h3 className="loading-step-title">Analyzing Salary Slip</h3>
              <p className="loading-step-sub">{loadingSteps[loadingStepIndex]}</p>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.6875rem',
              color: 'var(--color-neutral-muted)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
            }}>
              <span>OCR Pipeline · Groq LLM · Deterministic Tax Engine</span>
            </div>
          </div>
        )}

        {/* Analysis Results Display */}
        {result && extraction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Top Identity & Confidence Bar */}
            <div style={{
              background: '#F8FAF9',
              border: '1px solid var(--color-neutral-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <span style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  color: 'var(--color-neutral-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  Document Subject
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  color: 'var(--color-neutral-text)',
                }}>
                  {extraction.employee_name || 'Employee (Name not detected)'}
                </span>
                <span style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--color-neutral-muted)',
                }}>
                  {extraction.employer_name || 'Employer not detected'} · {extraction.pay_period || 'Period not detected'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{
                  fontSize: '0.6875rem',
                  color: 'var(--color-neutral-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  OCR Confidence
                </span>
                {extraction.extraction_confidence === 'high' && (
                  <span className="badge badge-relief">
                    <CheckCircleIcon size={12} />
                    <span>High Confidence</span>
                  </span>
                )}
                {extraction.extraction_confidence === 'medium' && (
                  <span className="badge badge-ochre">
                    <span>Medium Confidence</span>
                  </span>
                )}
                {extraction.extraction_confidence === 'low' && (
                  <span className="badge badge-surcharge">
                    <AlertTriangleIcon size={12} />
                    <span>Low Confidence (Verify)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Reconciliation Verdict Callout */}
            {reconciliation && reconciliation.status === 'reconciled' && (
              <>
                {isMismatch ? (
                  /* Statutory Callout in Fiscal Ochre (Mandated Pattern for Under/Over-withholding) */
                  <div className="callout-ochre-statutory">
                    <div className="callout-ochre-header">
                      <span className="callout-ochre-badge">
                        <AlertTriangleIcon size={14} />
                        <span>Statutory Alert · FBR Section 149 Withholding Mismatch</span>
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: '#7B5200',
                      }}>
                        {reconciliation.pct_difference}% Variance
                      </span>
                    </div>

                    <h4 className="callout-ochre-title">
                      {isUnderWithheld
                        ? 'Potential Under-Withholding Detected'
                        : 'Potential Over-Withholding Detected'}
                    </h4>

                    <p className="callout-ochre-message">
                      {reconciliation.message}
                    </p>

                    {/* Comparative Breakdown Grid */}
                    <div className="reconciliation-comparison-grid">
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Slip Monthly Deduction</span>
                        <span className="reconciliation-tile-val">
                          {formatAmount(reconciliation.slip_monthly_tax_withheld)}
                        </span>
                      </div>
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Required Monthly Tax</span>
                        <span className="reconciliation-tile-val" style={{ color: 'var(--color-primary)' }}>
                          {formatAmount(reconciliation.correct_monthly_tax)}
                        </span>
                      </div>
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Annual Variance</span>
                        <span className="reconciliation-tile-val" style={{ color: '#8C2626' }}>
                          {reconciliation.difference_annual < 0 ? '-' : '+'}
                          {formatAmount(Math.abs(reconciliation.difference_annual))}
                        </span>
                      </div>
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Deterministic Tax (TY {taxYear})</span>
                        <span className="reconciliation-tile-val">
                          {formatAmount(reconciliation.correct_annual_tax)}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      fontSize: '0.6875rem',
                      color: '#5C4101',
                      borderTop: '1px dashed #D8C388',
                      paddingTop: '8px',
                      marginTop: '4px',
                      fontFamily: 'var(--font-body)',
                    }}>
                      <strong>Statutory Action:</strong> Under Section 149 of the Income Tax Ordinance 2001, your employer is legally obligated to adjust tax deductions across remaining salary payments before June 30 to avert year-end liabilities.
                    </div>
                  </div>
                ) : (
                  /* Calm Confirmation (Mandated Pattern when Withholding Matches) */
                  <div className="callout-reconciled-calm">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="callout-calm-badge">
                        <CheckCircleIcon size={14} />
                        <span>Withholding Reconciled & Accurate</span>
                      </span>
                      <span className="badge badge-relief" style={{ fontSize: '0.625rem' }}>
                        100% Compliant
                      </span>
                    </div>

                    <h4 className="callout-calm-title">
                      Monthly Tax Withholding Aligns with FBR Schedule
                    </h4>

                    <p className="callout-calm-message">
                      {reconciliation.message}
                    </p>

                    <div className="reconciliation-comparison-grid">
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Monthly Withheld</span>
                        <span className="reconciliation-tile-val">
                          {formatAmount(reconciliation.slip_monthly_tax_withheld)}
                        </span>
                      </div>
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Expected Monthly</span>
                        <span className="reconciliation-tile-val" style={{ color: 'var(--color-primary)' }}>
                          {formatAmount(reconciliation.correct_monthly_tax)}
                        </span>
                      </div>
                      <div className="reconciliation-tile">
                        <span className="reconciliation-tile-label">Annualized Liability</span>
                        <span className="reconciliation-tile-val">
                          {formatAmount(reconciliation.correct_annual_tax)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Extracted Fields Table Ledger */}
            <div style={{
              background: 'var(--color-neutral-surface)',
              border: '1px solid var(--color-neutral-border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                background: '#FAFCFB',
                borderBottom: '1px solid var(--color-neutral-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-neutral-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  Extracted Payroll Figures (Monthly)
                </span>
                <span style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-neutral-muted)',
                }}>
                  All values in PKR
                </span>
              </div>

              <table className="extracted-ledger-table">
                <tbody>
                  <tr>
                    <td className="row-label">Basic Salary</td>
                    <td className="row-value">{formatAmount(extraction.basic_salary)}</td>
                  </tr>
                  <tr>
                    <td className="row-label">Allowances Total (House, Medical, Utilities)</td>
                    <td className="row-value">{formatAmount(extraction.allowances_total)}</td>
                  </tr>
                  <tr className="row-highlight">
                    <td className="row-label">Gross Monthly Salary</td>
                    <td className="row-value">{formatAmount(extraction.gross_salary)}</td>
                  </tr>
                  <tr className="row-tax">
                    <td className="row-label">Income Tax Deducted (Withholding)</td>
                    <td className="row-value">{formatAmount(extraction.income_tax_deducted)}</td>
                  </tr>
                  {extraction.other_deductions !== null && (
                    <tr>
                      <td className="row-label">Other Deductions (Provident Fund, EOBI)</td>
                      <td className="row-value">{formatAmount(extraction.other_deductions)}</td>
                    </tr>
                  )}
                  <tr className="row-highlight" style={{ borderTop: '2px solid var(--color-neutral-border)' }}>
                    <td className="row-label" style={{ fontWeight: 700 }}>Net Take-Home Salary</td>
                    <td className="row-value" style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                      {formatAmount(extraction.net_salary)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Transparency: Raw OCR Inspection Accordion */}
            {extraction._raw_ocr_text && (
              <div style={{
                border: '1px solid var(--color-neutral-border-subtle)',
                borderRadius: 'var(--radius-xs)',
                overflow: 'hidden',
              }}>
                <button
                  type="button"
                  onClick={() => setShowRawOcr(!showRawOcr)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#FAFCFB',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: 'var(--color-neutral-muted)',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{showRawOcr ? '▼ Hide Raw OCR Text' : '► Inspect Raw Extracted OCR Text'}</span>
                  <span>{extraction._raw_ocr_text.length} chars</span>
                </button>
                {showRawOcr && (
                  <pre style={{
                    padding: '12px',
                    background: '#F3F6F4',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: '#2B3934',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    margin: 0,
                    borderTop: '1px solid var(--color-neutral-border-subtle)',
                  }}>
                    {extraction._raw_ocr_text}
                  </pre>
                )}
              </div>
            )}

            {/* Cross-System Actions */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              paddingTop: '6px',
            }}>
              {extraction.gross_salary && onLoadIntoCalculator && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onLoadIntoCalculator(extraction.gross_salary * 12)}
                  title="Transfer this salary to the Tax Calculator Ledger"
                  style={{ flex: '1 1 180px', fontSize: '0.8125rem' }}
                >
                  <CalculatorIcon size={14} />
                  <span>Transfer to Calculator Ledger</span>
                </button>
              )}

              {onSendToAssistant && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConsultAssistant}
                  title="Ask the Statutory Assistant to explain this reconciliation"
                  style={{ flex: '1 1 180px', fontSize: '0.8125rem' }}
                >
                  <ChatIcon size={14} />
                  <span>Consult Assistant on this Slip</span>
                </button>
              )}

              {reconciliation && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopyHRMemo}
                  title="Copy a polite, formal tax audit inquiry note to send to your HR payroll division"
                  style={{ flex: '1 1 180px', fontSize: '0.8125rem' }}
                >
                  {copiedHR ? <CheckIcon size={14} style={{ color: 'var(--color-semantic-deduction)' }} /> : <CopyIcon size={14} />}
                  <span>{copiedHR ? 'Copied HR Note!' : 'Copy Audit Note for HR'}</span>
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleReset}
                title="Upload and audit another salary slip"
                style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
              >
                <RefreshIcon size={14} />
                <span>Audit Another Slip</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
