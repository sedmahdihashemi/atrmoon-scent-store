// Single source of truth for the optional pricing formula. BOTH the live
// preview in the seller UI and the server-side recompute that writes to
// product_variants.price import from here, so the number a seller sees while
// typing is exactly the number that gets saved — no SQL/JS formula drift.
//
// Decisions (confirmed with the store owner):
//   * cost_per_gram is in Toman (no USD term in the formula).
//   * density is assumed 1 g/ml (intentional simplification).
//   * final price rounds to the nearest 1000 Toman.
//   * the result is written only to price; discount_price stays manual.

export const PRICE_ROUND_STEP = 1000;

export function roundToStep(value: number, step: number = PRICE_ROUND_STEP): number {
  if (!Number.isFinite(value) || step <= 0) return 0;
  return Math.round(value / step) * step;
}

export type VariantPriceInputs = {
  volumeMl: number;
  concentrationPercent: number; // e.g. 50
  costPerGramToman: number | null | undefined;
  oilProfitPercent: number; // e.g. 20, can be 0
  bottleCostToman: number | null | undefined;
  bottleProfitPercent: number; // can be 0
};

export type VariantPriceBreakdown = {
  gramsNeeded: number;
  oilSalePrice: number;
  bottleSalePrice: number;
  rawTotal: number;
  finalPrice: number; // rawTotal rounded to PRICE_ROUND_STEP
};

// Returns the full breakdown, or null when a required input is missing
// (no cost-per-gram, or no bottle cost for this bottle type) so the caller
// can skip that variant and tell the seller which inputs are incomplete.
export function computeVariantPrice(inp: VariantPriceInputs): VariantPriceBreakdown | null {
  const cost = inp.costPerGramToman;
  const bottleCost = inp.bottleCostToman;
  if (cost == null || !Number.isFinite(cost) || cost < 0) return null;
  if (bottleCost == null || !Number.isFinite(bottleCost) || bottleCost < 0) return null;
  if (!Number.isFinite(inp.volumeMl) || inp.volumeMl <= 0) return null;
  if (!Number.isFinite(inp.concentrationPercent) || inp.concentrationPercent <= 0) return null;

  const gramsNeeded = (inp.volumeMl * inp.concentrationPercent) / 100; // density 1 g/ml
  const oilSalePrice = gramsNeeded * cost * (1 + (inp.oilProfitPercent || 0) / 100);
  const bottleSalePrice = bottleCost * (1 + (inp.bottleProfitPercent || 0) / 100);
  const rawTotal = oilSalePrice + bottleSalePrice;
  return {
    gramsNeeded,
    oilSalePrice,
    bottleSalePrice,
    rawTotal,
    finalPrice: roundToStep(rawTotal),
  };
}

// Small helper for the "live example" boxes next to the profit fields:
// given a raw cost and a profit percent, what is the sale price and the
// profit amount? Pure, no rounding (the example box is illustrative).
export function saleFromCost(costToman: number, profitPercent: number): { sale: number; profit: number } {
  const safeCost = Number.isFinite(costToman) ? costToman : 0;
  const safePct = Number.isFinite(profitPercent) ? profitPercent : 0;
  const sale = safeCost * (1 + safePct / 100);
  return { sale, profit: sale - safeCost };
}
