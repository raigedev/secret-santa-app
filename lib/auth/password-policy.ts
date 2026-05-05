export const PASSWORD_POLICY_MIN_LENGTH = 12;

export const PASSWORD_POLICY_HELP_TEXT =
  "Use at least 12 characters with uppercase and lowercase letters, a number, and a symbol.";

const PASSWORD_SYMBOL_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

type PasswordPolicyTarget = "password" | "new password";

function joinRequirementList(items: string[]): string {
  if (items.length === 1) {
    return items[0];
  }

  const lastItem = items[items.length - 1];
  return `${items.slice(0, -1).join(", ")}, and ${lastItem}`;
}

export function getPasswordPolicyMessage(
  password: string,
  target: PasswordPolicyTarget = "password"
): string | null {
  if (password.length < PASSWORD_POLICY_MIN_LENGTH) {
    return `Use at least ${PASSWORD_POLICY_MIN_LENGTH} characters for your ${target}.`;
  }

  const missingRequirements: string[] = [];

  if (!/[a-z]/.test(password)) {
    missingRequirements.push("a lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    missingRequirements.push("an uppercase letter");
  }

  if (!/\d/.test(password)) {
    missingRequirements.push("a number");
  }

  if (!PASSWORD_SYMBOL_PATTERN.test(password)) {
    missingRequirements.push("a symbol");
  }

  if (missingRequirements.length === 0) {
    return null;
  }

  return `Add ${joinRequirementList(missingRequirements)} to your ${target}.`;
}
