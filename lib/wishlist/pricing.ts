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
