export const BUDGET_OPTIONS: readonly number[] = [10, 15, 25, 50, 100];
export const HISTORY_PAGE_SIZE = 5;

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "EUR", symbol: "\u20ac", label: "EUR" },
  { code: "GBP", symbol: "\u00a3", label: "GBP" },
  { code: "PHP", symbol: "\u20b1", label: "PHP" },
  { code: "JPY", symbol: "\u00a5", label: "JPY" },
  { code: "AUD", symbol: "A$", label: "AUD" },
  { code: "CAD", symbol: "C$", label: "CAD" },
] as const;
