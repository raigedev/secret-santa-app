function hasUnsafePathControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function isSafeAppPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !hasUnsafePathControlCharacter(value)
  );
}

export function normalizeSafeAppPath(
  candidate: string | null | undefined,
  fallback = "/"
): string {
  const normalized = candidate?.trim() || fallback;

  if (isSafeAppPath(normalized)) {
    return normalized;
  }

  return isSafeAppPath(fallback) ? fallback : "/";
}
