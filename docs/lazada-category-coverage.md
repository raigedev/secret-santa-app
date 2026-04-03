# Lazada Category Coverage

## Snapshot

- Imported export files: `44`
- Current merged Lazada feed rows: `8,338`
- Search-backed Lazada cards: now try official tracked Lazada search/tag URLs before falling back
- Direct product cards: use feed promo links first, then Lazada `getlink(productId)` if needed

## Important note

The Lazada export field `categoryLv1` is currently `N/A` for all imported rows, so this checklist is based on:

1. the actual export filenames in `C:\Users\kenda\OneDrive\Documents\lazada-exports`
2. the app's current category-aware search templates in
   - `C:\Users\kenda\secret-santa-app\lib\affiliate\lazada-catalog.ts`
   - `C:\Users\kenda\secret-santa-app\lib\wishlist\suggestions.ts`
3. the direct-product matcher in
   - `C:\Users\kenda\secret-santa-app\lib\affiliate\lazada-feed.ts`

So this is the honest coverage view of the app today, not a guess based on Lazada's missing category metadata.

## What is global now

These behaviors already apply across all imported categories:

- all Lazada direct-product cards try official affiliate product links
- all Lazada search-backed cards now try official affiliate tracking on Lazada `catalog` or `tag` URLs
- all categories can use the same feed-based matcher

That means monetized click handling is broad now.

What still varies by category is the quality of:

- the fallback search phrases
- the direct product matching
- subtype precision, such as `tote bag` vs `backpack`

## Coverage levels

### A. Dedicated category-aware wording already exists

These categories already map cleanly to hand-tuned starter logic or keyword buckets:

- `Bags and Travel`
- `Fashion Accessories`
- `Mobiles and Tablets`
- `Media, Music and Books`
- `Beauty`
- `Beauty, Skincare & Wellness`
- `Tools and Home Improvements`
- `Toys and Games`
- `Gaming Devices and Software`
- `Groceries`
- `Furniture and Organization`
- `Kitchenware and Tableware`
- `Lighting and Decor`
- `Bedding and Bath`
- `House Hold Supplies`
- `Laundry And Cleaning Equipments`
- `Men's Clothing`
- `Women's Clothing`
- `Kid's Fashion`
- `Sports, Shoes and Clothing`
- `Lingerie, Sleep, Lounge and Thermal Wear`
- `Men's Shoes`
- `Women's Shoes`

### Why these are stronger

- they already have category-aware search wording
- several of them also have better item-type logic
- bags are the most tuned right now because we added subtype handling for:
  - `tote`
  - `backpack`
  - `wallet`
  - `crossbody`

## B. Indirectly covered by broader tech or home logic

These categories benefit from the global matcher and broader keyword buckets, but they do not yet have their own dedicated fallback phrasing:

- `Audio`
- `Cameras and Drones`
- `Computers and Components`
- `Data Storage`
- `Electronic Parts and Accessories`
- `Mobile accessories`
- `Printers and Scanners`
- `Smart Devices`
- `Televisions and Videos`
- `Home Appliances`
- `Outdoor and Garden`
- `Health`

### What this means in practice

- monetized click handling still works
- direct product matches can still work if the wishlist text is specific enough
- but the backup search suggestions may feel more generic than the tuned categories above

## C. Search-monetized, but still weakly tuned

These categories currently rely mostly on the global matcher and generic fallback behavior:

- `Automotive`
- `Digital Goods`
- `Digital Utilities`
- `Mother And Baby`
- `Pet Supplies`
- `Services`
- `Special Digital Products`
- `Stationery, Craft and Gift Cards`

### What this means in practice

- the click path can still be affiliate-tracked
- direct product matches may still appear if the item text is strong enough
- but the app does not yet have category-specific language or ranking rules for these groups

## Best-covered examples right now

These are the areas where the app should feel the most coherent today:

- bags and bag subtypes
- books and reading items
- tablets and related tech asks
- clothing basics
- beauty gifts
- home and organizer items
- tools
- games and collectibles
- food and snack gifts

## Next tuning priorities

If we want the biggest quality jump next, these are the best categories to tune:

1. `Stationery, Craft and Gift Cards`
2. `Mother And Baby`
3. `Pet Supplies`
4. `Audio`
5. `Cameras and Drones`
6. `Computers and Components`
7. `Mobile accessories`
8. `Home Appliances`
9. `Automotive`
10. `Services`

## Good next improvement

If we want a more exact category report later, we should preserve the export filename on each imported feed row during import.

That would let us answer questions like:

- which matched products came from which Lazada export file
- which export categories actually produce direct product cards
- which files mostly end up as search fallbacks

Right now we can still tune the system well, but the feed itself is not preserving that source-category metadata.
