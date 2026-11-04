/**
 * Zakat calculation (pure, on-device). Nisab uses the gold standard
 * (80.18 g by default, as Diyanet publishes); the rate is 1/40 (2.5%).
 * Amounts the user enters never leave the device.
 */

export const ZAKAT_RATE = 0.025;

export interface ZakatInputs {
  /** Cash, bank and fund balances (TRY). */
  cash: string;
  /** Gold in grams of pure gold. */
  gold: string;
  /** Silver in grams. */
  silver: string;
  /** Foreign currency, already converted to TRY. */
  fx: string;
  /** Receivables likely to be paid back (TRY). */
  recv: string;
  /** Debts due within a year (TRY). */
  debt: string;
  /** Gram prices (TRY); prefilled from the API, editable. */
  goldPrice: string;
  silverPrice: string;
}

export const EMPTY_INPUTS: ZakatInputs = {
  cash: '',
  gold: '',
  silver: '',
  fx: '',
  recv: '',
  debt: '',
  goldPrice: '',
  silverPrice: '',
};

/**
 * Parses a Turkish-formatted amount: "120.000", "1.250,50", "40,5", "40.5".
 * A single dot followed by exactly three digits is a thousands separator;
 * otherwise a lone dot is a decimal point. Invalid / negative input → 0.
 */
export function parseAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  let s = String(raw).replace(/\s|₺|TL/gi, '');
  if (!s) return 0;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const dots = s.split('.').length - 1;
    if (dots > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** "1.234.567" (rounded, Turkish grouping) without relying on Intl. */
export function formatTry(n: number, decimals = 0): string {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [int, frac] = fixed.split('.') as [string, string | undefined];
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + grouped + (frac ? `,${frac}` : '');
}

export interface ZakatResult {
  parts: { cash: number; gold: number; silver: number; fx: number; recv: number; debt: number };
  /** Total assets minus debts (TRY). */
  net: number;
  /** Nisab in TRY; null when no gold price is known. */
  nisab: number | null;
  /** True when net ≥ nisab. */
  due: boolean;
  zakat: number;
}

export function computeZakat(inputs: ZakatInputs, nisabGrams: number): ZakatResult {
  const goldPrice = parseAmount(inputs.goldPrice);
  const silverPrice = parseAmount(inputs.silverPrice);
  const parts = {
    cash: parseAmount(inputs.cash),
    gold: parseAmount(inputs.gold) * goldPrice,
    silver: parseAmount(inputs.silver) * silverPrice,
    fx: parseAmount(inputs.fx),
    recv: parseAmount(inputs.recv),
    debt: parseAmount(inputs.debt),
  };
  const net = parts.cash + parts.gold + parts.silver + parts.fx + parts.recv - parts.debt;
  const nisab = goldPrice > 0 ? goldPrice * nisabGrams : null;
  const due = nisab !== null && net > 0 && net >= nisab;
  return { parts, net, nisab, due, zakat: due ? net * ZAKAT_RATE : 0 };
}
