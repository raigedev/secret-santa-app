/**
 * Repo-local context loader for Impeccable.
 *
 * The full Impeccable skill is installed globally, but its setup command expects
 * this repo path to exist. Keep this small loader here so future UI passes can
 * read PRODUCT.md and DESIGN.md without falling back to generic guidance.
 */

import fs from "node:fs";
import path from "node:path";

const PRODUCT_NAMES = ["PRODUCT.md", "Product.md", "product.md"];
const DESIGN_NAMES = ["DESIGN.md", "Design.md", "design.md"];
const LEGACY_NAMES = [".impeccable.md"];

export function loadContext(cwd = process.cwd()) {
  let migrated = false;
  let productPath = firstExisting(cwd, PRODUCT_NAMES);

  if (!productPath) {
    const legacyPath = firstExisting(cwd, LEGACY_NAMES);

    if (legacyPath) {
      const newPath = path.join(cwd, "PRODUCT.md");

      try {
        fs.renameSync(legacyPath, newPath);
        productPath = newPath;
        migrated = true;
      } catch {
        productPath = legacyPath;
      }
    }
  }

  const designPath = firstExisting(cwd, DESIGN_NAMES);
  const product = productPath ? safeRead(productPath) : null;
  const design = designPath ? safeRead(designPath) : null;

  return {
    hasProduct: Boolean(product),
    product,
    productPath: productPath ? path.relative(cwd, productPath) : null,
    hasDesign: Boolean(design),
    design,
    designPath: designPath ? path.relative(cwd, designPath) : null,
    migrated,
  };
}

function firstExisting(cwd, names) {
  for (const name of names) {
    const absolutePath = path.join(cwd, name);

    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return null;
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

const runningScript = process.argv[1];

if (runningScript?.endsWith("load-context.mjs") || runningScript?.endsWith("load-context.mjs/")) {
  console.log(JSON.stringify(loadContext(process.cwd()), null, 2));
}
