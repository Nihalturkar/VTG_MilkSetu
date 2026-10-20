import { RateMode, round2 } from './domain';

export interface AmountInput {
  quantityLitres: number;
  fatPercentage: number;
  rateMode: RateMode;
  appliedRate: number;
}

/**
 * Authoritative amount calculation. The client previews the same formula,
 * but the server value is the one that is stored.
 *
 *   perLitre     -> litres * rate
 *   perFatPoint  -> litres * fat * rate
 */
export function calculateAmount({
  quantityLitres,
  fatPercentage,
  rateMode,
  appliedRate,
}: AmountInput): number {
  const base =
    rateMode === 'perLitre'
      ? quantityLitres * appliedRate
      : quantityLitres * fatPercentage * appliedRate;
  return round2(base);
}
