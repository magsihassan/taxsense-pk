import React, { useEffect, useRef } from 'react';
import { ShieldIcon, XIcon, CheckIcon, AlertTriangleIcon } from './Icons';

export function TermsModal({
  isOpen,
  onAccept,
  onClose,
  isFirstTime = false,
  acceptedAt = null,
}) {
  const modalRef = useRef(null);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle ESC key (allowed only if not first-time mandatory gate)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isFirstTime) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirstTime, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="terms-modal-overlay"
      role="presentation"
      onClick={(e) => {
        // Prevent backdrop dismiss if first-time mandatory acknowledgment
        if (e.target === e.currentTarget && !isFirstTime) {
          onClose();
        }
      }}
    >
      <div
        className="terms-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        ref={modalRef}
      >
        {/* Header Bar */}
        <header className="terms-modal-header">
          <div className="terms-modal-header-info">
            <div className="terms-header-icon-wrap" aria-hidden="true">
              <ShieldIcon size={20} />
            </div>
            <div>
              <h2 id="terms-modal-title" className="terms-modal-title">
                TaxSense PK — Terms of Use & Disclaimer
              </h2>
              <div className="terms-modal-meta">
                <span className="terms-badge">Statutory Notice</span>
                <span className="terms-date">Last updated: September 2026</span>
              </div>
            </div>
          </div>

          {!isFirstTime && (
            <button
              type="button"
              className="terms-modal-close-btn"
              onClick={onClose}
              aria-label="Close Terms and Disclaimer"
            >
              <XIcon size={18} />
            </button>
          )}
        </header>

        {/* Scrollable Document Content */}
        <div className="terms-modal-body">
          {/* Top Statutory Advisory Callout */}
          <div className="terms-alert-box">
            <div className="terms-alert-icon" aria-hidden="true">
              <AlertTriangleIcon size={18} />
            </div>
            <div className="terms-alert-text">
              <strong>Mandatory Notice:</strong> TaxSense PK is an independent, non-governmental educational tool.
              Please read and acknowledge these terms regarding statutory calculations, limitation of liability, and privacy safeguards before utilizing this platform.
            </div>
          </div>

          {/* Section 1 */}
          <section className="terms-section">
            <h3 className="terms-section-title">1. Nature of this Tool</h3>
            <p className="terms-paragraph">
              TaxSense PK is an independent, educational software project. It is not affiliated with, endorsed by,
              sponsored by, or connected in any way to the Federal Board of Revenue (FBR), the Government of Pakistan,
              or any government body. Any resemblance in name, terminology, or branding to official FBR systems
              (such as IRIS) is purely descriptive and does not imply any official relationship.
            </p>
          </section>

          {/* Section 2 */}
          <section className="terms-section">
            <h3 className="terms-section-title">2. Not Tax, Legal, or Financial Advice</h3>
            <p className="terms-paragraph">
              This tool is provided strictly for informational and educational purposes. It does not constitute tax advice,
              legal advice, financial advice, or a substitute for consultation with a qualified tax consultant, chartered
              accountant, or legal professional. Tax laws are complex, subject to interpretation, and vary based on individual
              circumstances that this tool cannot fully account for.
            </p>
            <p className="terms-paragraph terms-paragraph-subsequent">
              You should independently verify all information, calculations, and guidance provided by this tool before making
              any tax filing decisions, financial commitments, or submissions to the FBR.
            </p>
          </section>

          {/* Section 3 */}
          <section className="terms-section">
            <h3 className="terms-section-title">3. No Guarantee of Accuracy</h3>
            <p className="terms-paragraph">
              While this tool references official documents (including the Income Tax Ordinance 2001 and the Finance Act 2026)
              and uses a calculation engine designed to reflect current tax slabs, we make no warranties or
              representations — express or implied — regarding:
            </p>
            <ul className="terms-list">
              <li>The accuracy, completeness, or currentness of any information provided</li>
              <li>The correctness of any tax calculation, slab determination, or reconciliation result</li>
              <li>The suitability of this tool for your specific tax situation</li>
            </ul>
            <p className="terms-paragraph terms-paragraph-subsequent">
              Tax rates, thresholds, and rules may change through amendments, SROs, or notifications not yet reflected in this
              tool's knowledge base.
            </p>
          </section>

          {/* Section 4 */}
          <section className="terms-section">
            <h3 className="terms-section-title">4. Limitation of Liability</h3>
            <p className="terms-paragraph">
              To the fullest extent permitted by law, the creator(s) of TaxSense PK shall not be liable for any direct, indirect,
              incidental, or consequential damages, losses, penalties, or liabilities arising from:
            </p>
            <ul className="terms-list">
              <li>Reliance on information, calculations, or guidance provided by this tool</li>
              <li>Errors, omissions, or inaccuracies in the tool's output</li>
              <li>Any tax filing, payment, or decision made based on this tool's output</li>
              <li>Technical issues, downtime, or data processing errors</li>
            </ul>
            <p className="terms-paragraph terms-paragraph-subsequent terms-strong-note">
              This tool is provided "as is," without warranty of any kind.
            </p>
          </section>

          {/* Section 5 */}
          <section className="terms-section">
            <h3 className="terms-section-title">5. Your Responsibility</h3>
            <p className="terms-paragraph">
              By using this tool, you acknowledge and agree that:
            </p>
            <ul className="terms-list">
              <li>You are using this tool voluntarily and at your own discretion</li>
              <li>You will independently verify any figures before filing your tax return or relying on them for financial decisions</li>
              <li>Final responsibility for accurate and timely tax filing rests solely with you</li>
              <li>For your specific tax situation, you should consult a qualified tax professional or contact the FBR directly</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="terms-section">
            <h3 className="terms-section-title">6. Salary Slip Uploads & Data Handling</h3>
            <p className="terms-paragraph">
              If you use the Salary Slip Audit feature:
            </p>
            <ul className="terms-list">
              <li>
                <strong>Ephemeral In-Memory Processing:</strong> Uploaded documents are processed temporarily in memory/temporary storage
                solely to extract and analyze the information you've provided.
              </li>
              <li>
                <strong>Zero Retention Guarantee:</strong> Uploaded files are automatically and permanently deleted immediately after
                processing — we do not store, retain, or share your salary slip, extracted data, or any personal/financial
                information contained within it.
              </li>
              <li>
                <strong>Sensitive Information Redaction:</strong> You should avoid uploading documents containing sensitive identifiers
                (CNIC, full bank account numbers) where possible, and are responsible for ensuring you have the right to upload any document you submit.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="terms-section">
            <h3 className="terms-section-title">7. No Attorney-Client or Advisory Relationship</h3>
            <p className="terms-paragraph">
              Use of this tool does not create any advisory, fiduciary, or professional relationship between you and the
              creator(s) of TaxSense PK.
            </p>
          </section>

          {/* Section 8 */}
          <section className="terms-section">
            <h3 className="terms-section-title">8. Changes to This Tool</h3>
            <p className="terms-paragraph">
              This tool may be updated, modified, or discontinued at any time without notice. Tax-related content may not
              reflect the most recent legal changes.
            </p>
          </section>

          {/* Concluding Acknowledgment Banner */}
          <div className="terms-agreement-banner">
            <CheckIcon size={18} className="terms-agreement-icon" />
            <span>
              By using TaxSense PK, you acknowledge that you have read, understood, and agree to this disclaimer.
            </span>
          </div>
        </div>

        {/* Footer Action Controls */}
        <footer className="terms-modal-footer">
          <div className="terms-footer-status">
            {isFirstTime ? (
              <span className="terms-status-hint">
                One-time acknowledgment required before proceeding to the statutory ledger.
              </span>
            ) : acceptedAt ? (
              <span className="terms-status-accepted">
                ✓ Acknowledged and active for this browser session.
              </span>
            ) : null}
          </div>

          <div className="terms-footer-actions">
            {!isFirstTime && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary terms-accept-btn"
              onClick={onAccept}
              autoFocus
            >
              <CheckIcon size={16} />
              <span>{isFirstTime ? 'I Understand & Agree' : 'Acknowledge & Close'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default TermsModal;
