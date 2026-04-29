import { expect, test } from "@playwright/test";

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
});
