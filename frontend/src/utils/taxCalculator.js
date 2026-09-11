/**
 * Deterministic Salaried Income Tax Calculation Engine for Pakistan
 * Replicates FBR rates and rules from Finance Act 2025 and Finance Act 2026.
 */

export const TAX_SLABS = {
  '2025-26': [
    { lower: 0, upper: 600000, baseTax: 0, rate: 0.0, label: 'Up to PKR 600,000' },
    { lower: 600000, upper: 1200000, baseTax: 0, rate: 0.01, label: 'PKR 600,000 – 1,200,000' },
    { lower: 1200000, upper: 2200000, baseTax: 6000, rate: 0.11, label: 'PKR 1,200,000 – 2,200,000' },
    { lower: 2200000, upper: 3200000, baseTax: 116000, rate: 0.23, label: 'PKR 2,200,000 – 3,200,000' },
    { lower: 3200000, upper: 4100000, baseTax: 346000, rate: 0.30, label: 'PKR 3,200,000 – 4,100,000' },
    { lower: 4100000, upper: null, baseTax: 616000, rate: 0.35, label: 'Above PKR 4,100,000' },
  ],
  '2026-27': [
    { lower: 0, upper: 600000, baseTax: 0, rate: 0.0, label: 'Up to PKR 600,000' },
    { lower: 600000, upper: 1200000, baseTax: 0, rate: 0.01, label: 'PKR 600,000 – 1,200,000' },
    { lower: 1200000, upper: 2200000, baseTax: 6000, rate: 0.11, label: 'PKR 1,200,000 – 2,200,000' },
    { lower: 2200000, upper: 3200000, baseTax: 116000, rate: 0.20, label: 'PKR 2,200,000 – 3,200,000' },
    { lower: 3200000, upper: 4100000, baseTax: 316000, rate: 0.25, label: 'PKR 3,200,000 – 4,100,000' },
    { lower: 4100000, upper: 5600000, baseTax: 541000, rate: 0.29, label: 'PKR 4,100,000 – 5,600,000' },
    { lower: 5600000, upper: 7000000, baseTax: 976000, rate: 0.32, label: 'PKR 5,600,000 – 7,000,000' },
    { lower: 7000000, upper: null, baseTax: 1424000, rate: 0.35, label: 'Above PKR 7,000,000' },
  ],
};

export const SURCHARGE_THRESHOLD = 10000000;
export const SURCHARGE_RATES = {
  '2025-26': 0.09,
  '2026-27': 0.0,
};

export function calculateTax(annualIncome, taxYear = '2025-26') {
  const safeIncome = Math.max(0, Number(annualIncome) || 0);
  const slabs = TAX_SLABS[taxYear] || TAX_SLABS['2025-26'];

  let matchedSlab = slabs[0];
  let matchedIndex = 0;

  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i];
    if (slab.upper === null || safeIncome <= slab.upper) {
      if (safeIncome > slab.lower || slab.lower === 0) {
        matchedSlab = slab;
        matchedIndex = i;
        break;
      }
    }
  }

  const excess = Math.max(0, safeIncome - matchedSlab.lower);
  const marginalTax = excess * matchedSlab.rate;
  const baseTax = safeIncome > matchedSlab.lower ? matchedSlab.baseTax : 0;
  const totalBeforeSurcharge = Math.max(0, baseTax + marginalTax);

  let surcharge = 0;
  if (safeIncome > SURCHARGE_THRESHOLD) {
    const rate = SURCHARGE_RATES[taxYear] || 0;
    surcharge = totalBeforeSurcharge * rate;
  }

  const totalTax = Math.round(totalBeforeSurcharge + surcharge);
  const effectiveRateNum = safeIncome > 0 ? (totalTax / safeIncome) * 100 : 0;
  const monthlyWithholding = Math.round(totalTax / 12);

  const slabRange = matchedSlab.upper
    ? `PKR ${matchedSlab.lower.toLocaleString()} – ${matchedSlab.upper.toLocaleString()}`
    : `Above PKR ${matchedSlab.lower.toLocaleString()}`;

  return {
    taxYear,
    annualTaxableIncome: safeIncome,
    slabRange,
    baseTax: Math.round(baseTax),
    marginalRate: `${Math.round(matchedSlab.rate * 100)}%`,
    marginalRateDecimal: matchedSlab.rate,
    excessOverLower: Math.round(excess),
    marginalTaxAmount: Math.round(marginalTax),
    taxBeforeSurcharge: Math.round(totalBeforeSurcharge),
    surcharge: Math.round(surcharge),
    hasSurcharge: surcharge > 0,
    totalTax,
    effectiveRate: `${effectiveRateNum.toFixed(2)}%`,
    effectiveRateNum,
    monthlyWithholding,
    matchedIndex,
    allSlabs: slabs,
  };
}

export function formatPKR(val, includePrefix = true) {
  const num = Number(val) || 0;
  const formatted = Math.round(num).toLocaleString('en-US');
  return includePrefix ? `PKR ${formatted}` : formatted;
}
