import { SiteType } from "@prisma/client";

// ──────────────────────────────────────────────
// CONSTANTS (exact replication of n8n workflow)
// ──────────────────────────────────────────────

const HOURLY_RATE = 17;
const WEEKS_PER_MONTH = 4.33;
const PILOT_DISCOUNT_PERCENT = 25;
const PILOT_PERIOD_DAYS = 30;
const FLOOR_RATE = 25;
const TARGET_RATE = 27;
const MIN_GROSS_MARGIN = 25;

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface QuoteInput {
  companyName: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  hoursPerDay: number;
  frequencyPerWeek: number;
  daysSelected: string[];
  siteType: SiteType;
  marginPercent: number;
  productCostWeekly?: number;
  overheadCostWeekly?: number;
  applyPilotPricing?: boolean;
}

export interface PilotPricing {
  pilotMonthlyTotal: number;
  pilotSavings: number;
  pilotStartDate: Date;
  pilotEndDate: Date;
  pilotReviewDate: Date;
  standardPricingStartDate: Date;
}

export interface QuoteCalculation {
  hourlyRate: number;
  weeklyLabourCost: number;
  totalWeeklySpend: number;
  weeklyCharge: number;
  monthlyTotal: number;
  annualTotal: number;
  weeklyProfit: number;
  monthlyProfit: number;
  impliedSellRate: number;
  grossMarginPercent: number;
  quoteRef: string;
  pilot: PilotPricing | null;
  warnings: string[];
  errors: string[];
  blocked: boolean;
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function generateQuoteRef(companyName: string): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const companyPrefix = companyName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  return `SC-${yyyy}${mm}${dd}-${companyPrefix}`;
}

/**
 * Subtract N business days from a date.
 * Business days = Mon-Fri (no bank holiday awareness).
 */
function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ──────────────────────────────────────────────
// MAIN CALCULATION
// ──────────────────────────────────────────────

export function calculateQuote(input: QuoteInput): QuoteCalculation {
  const warnings: string[] = [];
  const errors: string[] = [];

  const {
    companyName,
    hoursPerDay,
    frequencyPerWeek,
    marginPercent,
    productCostWeekly = 0,
    overheadCostWeekly = 0,
    applyPilotPricing = false,
  } = input;

  // Core calculations
  const weeklyLabourCost = hoursPerDay * HOURLY_RATE * frequencyPerWeek;
  const totalWeeklySpend = weeklyLabourCost + productCostWeekly + overheadCostWeekly;
  const weeklyCharge = totalWeeklySpend / (1 - marginPercent / 100);
  const monthlyTotal = Math.round(weeklyCharge * WEEKS_PER_MONTH);
  const annualTotal = monthlyTotal * 12;
  const weeklyProfit = weeklyCharge - totalWeeklySpend;
  const monthlyProfit = weeklyProfit * WEEKS_PER_MONTH;

  // Pricing guardrails
  const totalWeeklyHours = hoursPerDay * frequencyPerWeek;
  const impliedSellRate = totalWeeklyHours > 0 ? weeklyCharge / totalWeeklyHours : 0;
  const grossMarginPercent = weeklyCharge > 0
    ? ((weeklyCharge - totalWeeklySpend) / weeklyCharge) * 100
    : 0;

  let blocked = false;

  if (grossMarginPercent < MIN_GROSS_MARGIN) {
    errors.push(
      `Gross margin ${grossMarginPercent.toFixed(1)}% is below minimum ${MIN_GROSS_MARGIN}%. Quote blocked.`
    );
    blocked = true;
  }

  if (impliedSellRate < FLOOR_RATE) {
    errors.push("Rate below floor. Requires admin approval.");
    blocked = true;
  } else if (impliedSellRate < TARGET_RATE) {
    warnings.push(`Below target rate of \u00a327/hr (current: \u00a3${impliedSellRate.toFixed(2)}/hr)`);
  }

  // Quote reference
  const quoteRef = generateQuoteRef(companyName);

  // Pilot pricing
  let pilot: PilotPricing | null = null;
  if (applyPilotPricing) {
    const pilotMonthlyTotal = Math.round(monthlyTotal * (1 - PILOT_DISCOUNT_PERCENT / 100));
    const pilotSavings = monthlyTotal - pilotMonthlyTotal;
    const pilotStartDate = new Date();
    const pilotEndDate = addDays(pilotStartDate, PILOT_PERIOD_DAYS);
    const pilotReviewDate = subtractBusinessDays(pilotEndDate, 5);
    const standardPricingStartDate = addDays(pilotEndDate, 1);

    pilot = {
      pilotMonthlyTotal,
      pilotSavings,
      pilotStartDate,
      pilotEndDate,
      pilotReviewDate,
      standardPricingStartDate,
    };
  }

  return {
    hourlyRate: HOURLY_RATE,
    weeklyLabourCost: parseFloat(weeklyLabourCost.toFixed(2)),
    totalWeeklySpend: parseFloat(totalWeeklySpend.toFixed(2)),
    weeklyCharge: parseFloat(weeklyCharge.toFixed(2)),
    monthlyTotal,
    annualTotal,
    weeklyProfit: parseFloat(weeklyProfit.toFixed(2)),
    monthlyProfit: parseFloat(monthlyProfit.toFixed(2)),
    impliedSellRate: parseFloat(impliedSellRate.toFixed(2)),
    grossMarginPercent: parseFloat(grossMarginPercent.toFixed(2)),
    quoteRef,
    pilot,
    warnings,
    errors,
    blocked,
  };
}
