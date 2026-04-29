import { getLazadaStarterProducts, type LazadaStarterCatalogProduct } from "@/lib/affiliate/lazada-catalog";
import { formatPriceRange } from "@/lib/wishlist/pricing";
import type { ShoppingRegion, WishlistFeaturedProductCard } from "@/lib/wishlist/suggestions";

type PriceWindow = {
  typicalMin: number | null;
  typicalMax: number | null;
};

type SearchFallbackPresentation = {
  fitLabel: string;
  recommendationCaption: string;
  recommendationLabel: string;
  recommendationTone: "berry" | "forest" | "gold" | "ink";
  trackingLabel: string;
};

export type LazadaDirectMatchRole = "closest" | "premium" | "step-up";

type BuildTrackedHref = (input: {
  fitLabel: string;
  product: LazadaStarterCatalogProduct;
  trackingLabel: string;
}) => string;

type BuildLazadaSearchFallbackCardsInput = {
  currency: string | null;
  groupBudget: number | null;
  groupId: string;
  itemCategory: string;
  itemName: string;
  itemNote: string;
  limit: number;
  preferredPriceMax: number | null;
  preferredPriceMin: number | null;
  region: ShoppingRegion;
  searchQuery: string;
  wishlistItemId: string;
  buildHref: BuildTrackedHref;
  excludeSearchQueries?: string[];
};

function normalizeAngleQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeStarterProducts(
  products: LazadaStarterCatalogProduct[]
): LazadaStarterCatalogProduct[] {
  const seenQueries = new Set<string>();

  return products.filter((product) => {
    const key = normalizeAngleQuery(product.searchQuery);

    if (seenQueries.has(key)) {
      return false;
    }

    seenQueries.add(key);
    return true;
  });
}

export function getLazadaBudgetFitLabel(
  template: PriceWindow,
  preferredMin: number | null,
  preferredMax: number | null,
  groupBudget: number | null
): string {
  const effectiveMax = preferredMax ?? groupBudget;

  if (template.typicalMin === null && template.typicalMax === null) {
    return effectiveMax !== null ? "Budget guided" : "Flexible price";
  }

  if (effectiveMax !== null && template.typicalMin !== null && template.typicalMin > effectiveMax) {
    return "Above budget";
  }

  if (
    effectiveMax !== null &&
    template.typicalMax !== null &&
    template.typicalMax <= effectiveMax
  ) {
    return "Within budget";
  }

  if (preferredMin !== null && template.typicalMax !== null && template.typicalMax < preferredMin) {
    return "Under budget";
  }

  return "Flexible price";
}

export function getLazadaSuggestionPriceLabel(
  template: PriceWindow,
  preferredMin: number | null,
  preferredMax: number | null,
  groupBudget: number | null,
  currency: string | null
): string | null {
  if (preferredMin !== null || preferredMax !== null) {
    const preferredLabel = formatPriceRange(preferredMin, preferredMax, currency);
    return preferredLabel ? `Target: ${preferredLabel}` : null;
  }

  if (groupBudget !== null) {
    const groupBudgetLabel = formatPriceRange(groupBudget, groupBudget, currency);
    return groupBudgetLabel ? `Group budget: ${groupBudgetLabel}` : null;
  }

  const typicalLabel = formatPriceRange(template.typicalMin, template.typicalMax, currency);
  return typicalLabel ? `Typical spend: ${typicalLabel}` : null;
}

export function getDirectMatchRecommendationMetadata(role: LazadaDirectMatchRole): {
  recommendationCaption: string;
  recommendationLabel: string;
  recommendationTone: "berry" | "forest" | "gold" | "ink";
} {
  if (role === "closest") {
    return {
      recommendationLabel: "Best match",
      recommendationCaption: "Ready on Lazada",
      recommendationTone: "forest",
    };
  }

  if (role === "step-up") {
    return {
      recommendationLabel: "Step-up pick",
      recommendationCaption: "Ready on Lazada",
      recommendationTone: "gold",
    };
  }

  return {
    recommendationLabel: "Premium option",
    recommendationCaption: "Ready on Lazada",
    recommendationTone: "berry",
  };
}

function getSearchFallbackPresentation(input: {
  budgetFitLabel: string;
  itemName: string;
  product: LazadaStarterCatalogProduct;
  searchQuery: string;
}): SearchFallbackPresentation {
  const normalizedSelectedQuery = normalizeAngleQuery(input.searchQuery);
  const normalizedProductQuery = normalizeAngleQuery(input.product.searchQuery);
  const normalizedItemName = normalizeAngleQuery(input.itemName);
  const isSelectedAngle = normalizedProductQuery === normalizedSelectedQuery;
  const isExactWishlist = normalizedProductQuery === normalizedItemName;

  if (isSelectedAngle) {
    return {
      fitLabel: normalizedSelectedQuery === normalizedItemName ? "Closest match" : "Chosen option",
      recommendationLabel:
        normalizedSelectedQuery === normalizedItemName ? "Wishlist wording" : "Chosen option",
      recommendationCaption: "Browse similar items",
      recommendationTone: "forest",
      trackingLabel:
        normalizedSelectedQuery === normalizedItemName ? "Wishlist wording" : "Chosen option",
    };
  }

  if (isExactWishlist) {
    return {
      fitLabel: "Closest match",
      recommendationLabel: "Wishlist wording",
      recommendationCaption: "Browse similar items",
      recommendationTone: "berry",
      trackingLabel: "Wishlist wording",
    };
  }

  if (
    input.budgetFitLabel === "Within budget" ||
    input.budgetFitLabel === "Under budget"
  ) {
    return {
      fitLabel: input.budgetFitLabel,
      recommendationLabel: "Budget pick",
      recommendationCaption: "Browse similar items",
      recommendationTone: "gold",
      trackingLabel: "Search route",
    };
  }

  if (input.budgetFitLabel === "Above budget") {
    return {
      fitLabel: input.budgetFitLabel,
      recommendationLabel: "Stretch option",
      recommendationCaption: "Browse similar items",
      recommendationTone: "ink",
      trackingLabel: "Search route",
    };
  }

  return {
    fitLabel: input.budgetFitLabel,
    recommendationLabel: "Similar ideas",
    recommendationCaption: "Browse similar items",
    recommendationTone: "forest",
    trackingLabel: "Search route",
  };
}

export function buildLazadaSearchFallbackCards(
  input: BuildLazadaSearchFallbackCardsInput
): WishlistFeaturedProductCard[] {
  const normalizedSelectedQuery = normalizeAngleQuery(input.searchQuery);
  const normalizedItemName = normalizeAngleQuery(input.itemName);
  const excludedQueries = new Set(
    (input.excludeSearchQueries || []).map((query) => normalizeAngleQuery(query))
  );
  const fallbackProducts = dedupeStarterProducts(
    getLazadaStarterProducts({
      itemName: input.itemName,
      itemCategory: input.itemCategory,
      itemNote: input.itemNote,
      searchQuery: input.searchQuery,
      preferredPriceMin: input.preferredPriceMin,
      preferredPriceMax: input.preferredPriceMax,
      groupBudget: input.groupBudget,
    }).filter((product) => product.source === "search-backed")
  )
    .sort((left, right) => {
      const leftQuery = normalizeAngleQuery(left.searchQuery);
      const rightQuery = normalizeAngleQuery(right.searchQuery);
      const leftSelected = leftQuery === normalizedSelectedQuery ? 0 : 1;
      const rightSelected = rightQuery === normalizedSelectedQuery ? 0 : 1;

      if (leftSelected !== rightSelected) {
        return leftSelected - rightSelected;
      }

      const leftExact = leftQuery === normalizedItemName ? 0 : 1;
      const rightExact = rightQuery === normalizedItemName ? 0 : 1;

      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }

      return 0;
    })
    .filter((product) => !excludedQueries.has(normalizeAngleQuery(product.searchQuery)))
    .slice(0, input.limit);

  return fallbackProducts.map((product, index) => {
    const budgetFitLabel = getLazadaBudgetFitLabel(
      product,
      input.preferredPriceMin,
      input.preferredPriceMax,
      input.groupBudget
    );
    const presentation = getSearchFallbackPresentation({
      budgetFitLabel,
      itemName: input.itemName,
      product,
      searchQuery: input.searchQuery,
    });

    return {
      id: `fallback-lazada-${input.wishlistItemId}-${product.id}-${index}`,
      merchant: "lazada",
      merchantLabel: "Lazada",
      catalogSource: "search-backed",
      imageUrl: null,
      productId: null,
      skuId: null,
      title: product.title,
      subtitle: product.subtitle,
      href: input.buildHref({
        fitLabel: presentation.fitLabel,
        product,
        trackingLabel: presentation.trackingLabel,
      }),
      searchQuery: product.searchQuery,
      priceLabel: getLazadaSuggestionPriceLabel(
        product,
        input.preferredPriceMin,
        input.preferredPriceMax,
        input.groupBudget,
        input.currency
      ),
      fitLabel: presentation.fitLabel,
      whyItFits: product.whyItFits,
      trackingLabel: presentation.trackingLabel,
      recommendationLabel: presentation.recommendationLabel,
      recommendationCaption: presentation.recommendationCaption,
      recommendationTone: presentation.recommendationTone,
    };
  });
}
