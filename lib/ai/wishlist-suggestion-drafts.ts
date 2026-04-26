import "server-only";

import type { AiWishlistSuggestionDraft, SuggestionInput } from "@/lib/wishlist/suggestions";

export function buildWishlistBudgetContext(input: SuggestionInput): string {
  if (input.preferredPriceMin !== null || input.preferredPriceMax !== null) {
    const min = input.preferredPriceMin ?? "none";
    const max = input.preferredPriceMax ?? "none";
    return `Preferred price range: ${min} to ${max} ${input.currency || "PHP"}.`;
  }

  if (input.groupBudget !== null) {
    return `Budget target: ${input.groupBudget} ${input.currency || "PHP"}.`;
  }

  return "No strict budget target was provided.";
}

function sanitizeDraftValue(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export function parseWishlistSuggestionDraftsFromJson(
  jsonText: string
): AiWishlistSuggestionDraft[] {
  if (!jsonText) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonText) as {
      suggestions?: Array<{
        searchQuery?: unknown;
        subtitle?: unknown;
        title?: unknown;
      }>;
    };

    return (parsed.suggestions || [])
      .map((suggestion) => ({
        title: sanitizeDraftValue(suggestion.title, 48),
        subtitle: sanitizeDraftValue(suggestion.subtitle, 140),
        searchQuery: sanitizeDraftValue(suggestion.searchQuery, 64),
      }))
      .filter(
        (suggestion) =>
          suggestion.title.length > 0 &&
          suggestion.subtitle.length > 0 &&
          suggestion.searchQuery.length > 0
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}
