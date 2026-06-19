export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20ac", name: "Euro" },
  { code: "GBP", symbol: "\u00a3", name: "British Pound" },
  { code: "PHP", symbol: "\u20b1", name: "Philippine Peso" },
  { code: "JPY", symbol: "\u00a5", name: "Japanese Yen" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export type SupportedCurrencyCode = SupportedCurrency["code"];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map(
  (currency) => currency.code
) as readonly SupportedCurrencyCode[];

const SUPPORTED_CURRENCY_CODE_SET = new Set<string>(SUPPORTED_CURRENCY_CODES);

export function isSupportedCurrencyCode(code: string): code is SupportedCurrencyCode {
  return SUPPORTED_CURRENCY_CODE_SET.has(code.toUpperCase());
}

export function getSupportedCurrency(
  code: string | null | undefined
): SupportedCurrency | null {
  const normalizedCode = (code || "").toUpperCase();

  return SUPPORTED_CURRENCIES.find((currency) => currency.code === normalizedCode) || null;
}

export function getCurrencySymbol(
  code: string | null | undefined,
  fallback = "$"
): string {
  return getSupportedCurrency(code)?.symbol || fallback;
}

export function formatCurrencyOptionLabel(currency: SupportedCurrency): string {
  return `${currency.symbol} ${currency.code} - ${currency.name}`;
}
