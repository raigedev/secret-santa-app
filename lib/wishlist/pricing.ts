export function normalizeOptionalPriceValue(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value).trim());

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.round(numericValue * 100) / 100;
}

export function formatPriceRange(
  min: number | null,
  max: number | null,
  currency: string | null | undefined
): string | null {
  if (min === null && max === null) {
    return null;
  }

  const formatValue = (value: number) => {
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: value % 1 === 0 ? 0 : 2,
        }).format(value);
      } catch {
        // Fall through to plain number formatting when the currency code is invalid.
      }
    }

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  };

  if (min !== null && max !== null) {
    if (min === max) {
      return formatValue(min);
    }

    return `${formatValue(min)} - ${formatValue(max)}`;
  }

  if (min !== null) {
    return `From ${formatValue(min)}`;
  }

  return `Up to ${formatValue(max as number)}`;
}
