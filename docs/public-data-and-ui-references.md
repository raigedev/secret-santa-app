# Public Data And UI Reference Notes

<!-- cspell:ignore awesomedata Bpedia Databus frontends -->

This note captures useful external references for My Secret Santa. It is a research and planning document only. Do not import large public datasets, call new paid APIs, or wire third-party data into production without a fresh license, privacy, cost, and security review.

## Public Data Sources Worth Keeping

The `awesomedata/awesome-public-datasets` repo is an index of dataset links, not a package to install. Its list is MIT licensed, but the linked datasets each have their own terms.

Use these as candidates for offline enrichment, test fixtures, or small curated category maps:

| Source | Good Use In This App | Guardrails |
| --- | --- | --- |
| Wikidata | Interest taxonomy, hobby aliases, book/movie/game/person/entity lookup, wishlist keyword normalization. | Good candidate because Wikidata contributions are CC0, but verify source-specific fields before shipping derived data. |
| DBpedia Latest Core | Structured category context from Wikipedia topics, useful for broad hobby/category grouping. | Verify per-dataset license metadata on Databus before production use. Prefer small derived category maps, not full dumps. |
| Open Library Data Dumps | Book and author metadata for wishlist suggestions such as book lovers, genres, editions, and author interests. | Use catalog metadata only. Do not imply availability of copyrighted book content. |
| MovieLens | Local recommendation experiments and test fixtures for "people who liked X may like Y" logic. | GroupLens datasets have their own license/terms. Keep to local testing unless terms are explicitly approved. |
| Steam Co-Review Network | Game-interest clustering for gaming-related gift ideas and local recommendation experiments. | Verify repo license before use. Do not treat Steam data as product/pricing truth. |
| USDA FoodData Central | Food, baking, snack, coffee/tea, kitchen, wellness, and cooking-category enrichment. | Use as category/context data only. Do not make health or nutrition claims in gift UI. |
| OpenStreetMap | Future location-aware venue/store ideas or local meetup context. | ODbL attribution/share-alike requirements need review before any production use. Not urgent for current shopping flow. |
| Free Music Archive metadata | Music genre/category inspiration for music-related gift ideas. | Track licenses vary. Do not use audio, artwork, or direct media assets without item-level license checks. |
| Google Trends | Manual research for holiday/gift trend direction. | Treat as research only, not a stable production data source. |

## Sources To Avoid Or Hold

- Internet Product Code Database: marked as needing fixes in the awesome list and not reliable enough for product matching.
- Yelp dataset: review and business data terms are too specific for our current needs.
- Public product-price datasets: usually stale and weaker than Lazada/Shopee/Amazon/provider feeds.
- Medical, finance, social-network, email, and personal-data datasets: unnecessary for this app and higher privacy/compliance risk.
- Massive raw dumps: do not add to the repo, Supabase, or Vercel build context.

## Best App Uses

- Enrich deterministic AI fallbacks with safer gift categories and synonyms.
- Improve wishlist text parsing, for example mapping "coffee", "espresso", and "pour over" to one gift-interest group.
- Create local test fixtures for recommendation logic without using private user data.
- Build a small provider-neutral gift taxonomy that later supports Lazada, Shopee, and Amazon.
- Keep live shopping results, prices, affiliate links, and exact product claims sourced from approved provider feeds/postbacks.

## UI Workflow Notes From Reddit

The Reddit thread on making Codex frontends nicer mostly matches our current workflow. Adopt these points:

- Start UI work from a real visual reference when the screen is important: Stitch, an image mockup, screenshots, or a polished existing app reference.
- Keep `DESIGN.md` as the source of truth so UI changes share one language instead of drifting screen by screen.
- Use UI skills such as `impeccable`, Taste-family skills, and Stitch guidance before implementation.
- Work in slices: shell, header, primary content, cards/tables, mobile, then polish.
- Use browser screenshots or Playwright visual checks after each meaningful UI slice.
- Avoid generic AI UI tells: nested cards, same-color palettes, heavy gradients, vague hero layouts, excessive rounding, and random decoration.
- Copy patterns, not code: study spacing, type hierarchy, density, interaction states, and loading states from good apps.
- Small polish matters: hover, focus, loading, empty states, text wrapping, and responsive breakpoints make the app feel finished.
- Use higher reasoning or second-opinion review for alignment, responsiveness, and polish bugs after the rough screen exists.

## UI Copy Boundary Notes From Reddit

The Reddit thread about Codex leaking backend wording into frontends reinforces a permanent rule for this repo: UI copy should sound like the product, not the implementation.

Adopt these points:

- Put project-specific copy rules in `AGENTS.md` and keep them visible to every future Codex session.
- Treat every user-facing string as production copy unless the screen is explicitly an admin/developer surface.
- Keep implementation terms such as backend, API, provider, fallback, deterministic, taxonomy, RLS, Supabase, postback, and raw error names out of customer-facing screens.
- Keep data/source matching in utilities, services, server actions, or API routes so React components receive display-ready labels instead of assembling technical concepts.
- During UI polish passes, scan headings, empty states, loading states, errors, toasts, badges, and helper text for technical leakage.

## Current Decision

Do not download datasets or add dependencies now. Keep this as a curated source list until a specific feature needs one of the sources. For the current Secret Santa app, use a small hand-curated gift taxonomy derived from approved sources and normal product knowledge, with provider feeds still owning product availability and affiliate links.

## References

- Awesome Public Datasets: https://github.com/awesomedata/awesome-public-datasets
- Wikidata licensing: https://www.wikidata.org/wiki/Wikidata:Licensing
- DBpedia latest core: https://www.dbpedia.org/resources/latest-core/
- Open Library data dumps: https://openlibrary.org/developers/dumps
- MovieLens datasets: https://grouplens.org/datasets/movielens/
- USDA FoodData Central downloads: https://fdc.nal.usda.gov/download-datasets
- OpenStreetMap ODbL: https://wiki.openstreetmap.org/wiki/ODbL
- Free Music Archive dataset: https://github.com/mdeff/fma
- Reddit UI/frontend thread: https://www.reddit.com/r/codex/comments/1swbf35/how_to_make_a_nice_uifrontend/
- Reddit backend-wording thread: https://www.reddit.com/r/codex/comments/1sorx9a/how_to_stop_codex_writing_backend_stuff_in/
