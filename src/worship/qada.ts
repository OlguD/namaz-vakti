export const QADA_KEYS = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi', 'vitir'] as const;
export type QadaKey = (typeof QADA_KEYS)[number];

export interface QadaEstimateInput {
  birthYear: number;
  /** Age at puberty, from which prayer is obligatory. */
  pubertyAge: number;
  /** Year the user started praying regularly. */
  regularSince: number;
  /** Rough share (0–100) of prayers performed during the missed period. */
  prayedPercent: number;
}

/**
 * Estimate used by the kaza wizard: every day between puberty and the year of
 * regular prayer counts, minus the share already prayed. Same number per vakit;
 * vitir is included (Hanafi). It is an estimate — the app says so and suggests
 * consulting a scholar.
 */
export function estimateQada(input: QadaEstimateInput): {
  perVakit: number;
  total: number;
  fromYear: number;
  years: number;
} {
  const fromYear = input.birthYear + input.pubertyAge;
  const years = Math.max(0, input.regularSince - fromYear);
  const perVakit = Math.round(years * 365 * (1 - input.prayedPercent / 100));
  return { perVakit, total: perVakit * QADA_KEYS.length, fromYear, years };
}
