const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

export function sanitizeTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeCompactString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function isBlockedPlainTextCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;

  return (
    character === ">" ||
    codePoint <= 8 ||
    codePoint === 11 ||
    codePoint === 12 ||
    (codePoint >= 14 && codePoint <= 31) ||
    codePoint === 127
  );
}

function appendPlainTextCharacter(target: string[], character: string, maxLength: number): void {
  if (target.length < maxLength && !isBlockedPlainTextCharacter(character)) {
    target.push(character);
  }
}

export function sanitizePlainText(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || maxLength <= 0) {
    return "";
  }

  const characters: string[] = [];
  let possibleTagCharacters: string[] | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "<") {
      if (possibleTagCharacters !== null) {
        for (const possibleTextCharacter of possibleTagCharacters) {
          appendPlainTextCharacter(characters, possibleTextCharacter, maxLength);
        }
      }

      possibleTagCharacters = [];
      continue;
    }

    if (possibleTagCharacters !== null) {
      if (character === ">") {
        possibleTagCharacters = null;
      } else if (
        characters.length + possibleTagCharacters.length < maxLength &&
        !isBlockedPlainTextCharacter(character)
      ) {
        possibleTagCharacters.push(character);
      }

      continue;
    }

    appendPlainTextCharacter(characters, character, maxLength);

    if (characters.length >= maxLength) {
      break;
    }
  }

  if (possibleTagCharacters !== null) {
    for (const possibleTextCharacter of possibleTagCharacters) {
      appendPlainTextCharacter(characters, possibleTextCharacter, maxLength);
    }
  }

  return characters.join("").trim().slice(0, maxLength);
}

export function slugifyAsciiIdentifier(
  value: string | null | undefined,
  options: { fallback?: string; maxLength?: number } = {}
): string {
  const maxLength = options.maxLength ?? Number.POSITIVE_INFINITY;
  const fallback = options.fallback ?? "";
  let slug = "";
  let needsSeparator = false;

  if (maxLength <= 0) {
    return fallback;
  }

  for (const character of (value || "").toLowerCase()) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isAsciiDigit = codePoint >= 48 && codePoint <= 57;
    const isAsciiLetter = codePoint >= 97 && codePoint <= 122;

    if (isAsciiDigit || isAsciiLetter) {
      if (needsSeparator && slug.length > 0 && slug.length < maxLength) {
        slug += "-";
      }

      if (slug.length >= maxLength) {
        break;
      }

      slug += character;
      needsSeparator = false;
      continue;
    }

    needsSeparator = slug.length > 0;
  }

  if (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }

  return slug || fallback;
}

export function sanitizeOptionalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const SUPPORTED_SHOPPING_REGIONS = ["AU", "CA", "GLOBAL", "JP", "PH", "UK", "US"] as const;

type SupportedShoppingRegion = (typeof SUPPORTED_SHOPPING_REGIONS)[number];

export function isSupportedShoppingRegion(
  value: string | null | undefined
): value is SupportedShoppingRegion {
  return SUPPORTED_SHOPPING_REGIONS.includes(value as SupportedShoppingRegion);
}
