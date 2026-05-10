import { expect, test } from "@playwright/test";

import {
  isLazadaPromotionShortLinkHostname,
  normalizeLazadaPromotionLinkUrl,
} from "../../lib/affiliate/lazada-url";
import { buildWishlistSuggestionOptions, type SuggestionInput } from "../../lib/wishlist/suggestions";
import { buildGiftTaxonomySuggestionTemplates } from "../../lib/wishlist/gift-taxonomy";

const BASE_INPUT: SuggestionInput = {
  groupId: "11111111-1111-1111-1111-111111111111",
  wishlistItemId: "22222222-2222-2222-2222-222222222222",
  itemName: "Pour over coffee kit",
  itemCategory: "Other",
  itemNote: "They love espresso and cozy cafe drinks.",
  preferredPriceMin: null,
  preferredPriceMax: null,
  groupBudget: 1500,
  currency: "PHP",
};

test.describe("wishlist suggestion options", () => {
  test("maps wishlist text to provider-neutral gift ideas", () => {
    const templates = buildGiftTaxonomySuggestionTemplates(
      BASE_INPUT.itemName,
      BASE_INPUT.itemNote
    );

    expect(templates.map((template) => template.searchQuery)).toContain(
      "coffee tea gift set"
    );
  });

  test("keeps the exact wishlist wording first before broader gift ideas", () => {
    const options = buildWishlistSuggestionOptions(BASE_INPUT);

    expect(options[0]).toMatchObject({
      title: "Pour over coffee kit",
      searchQuery: "Pour over coffee kit",
      source: "base",
    });
    expect(options.some((option) => option.title === "Coffee and tea corner")).toBe(true);
  });

  test("recognizes Lazada short-link hosts used for promotion redirects", () => {
    expect(isLazadaPromotionShortLinkHostname("c.lazada.com.ph")).toBe(true);
    expect(isLazadaPromotionShortLinkHostname("s.lazada.com.ph")).toBe(true);
    expect(isLazadaPromotionShortLinkHostname("www.lazada.com.ph")).toBe(false);
    expect(isLazadaPromotionShortLinkHostname("example.com")).toBe(false);
  });

  test("only accepts Lazada promotion links as redirect-ready targets", () => {
    expect(
      normalizeLazadaPromotionLinkUrl("https://c.lazada.com.ph/t/c.sample?subId1=existing#frag")
    ).toBe("https://c.lazada.com.ph/t/c.sample?subId1=existing");
    expect(
      normalizeLazadaPromotionLinkUrl(
        "https://pages.lazada.com.ph/products/pdp-i123-s456.html?exlaz=promo#reviews"
      )
    ).toBe("https://pages.lazada.com.ph/products/pdp-i123-s456.html?exlaz=promo");
    expect(normalizeLazadaPromotionLinkUrl("https://www.lazada.com.ph/catalog/?q=coffee")).toBeNull();
    expect(normalizeLazadaPromotionLinkUrl("lazada://ph/pdp?itemId=123")).toBeNull();
    expect(normalizeLazadaPromotionLinkUrl("https://lazada.com.ph.evil.example/t/c.sample")).toBeNull();
  });
});
