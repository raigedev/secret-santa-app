import "server-only";

import type { AiWishlistSuggestionDraft, SuggestionInput, WishlistSuggestionOption } from "@/lib/wishlist/suggestions";

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_WISHLIST_MODEL = "gemini-2.5-flash-lite";
const GEMINI_REQUEST_TIMEOUT_MS = 9000;

function sanitizeDraftValue(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function extractJsonText(payload: GeminiGenerateContentResponse): string {
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

function buildBudgetContext(input: SuggestionInput): string {
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

function buildPrompt(input: SuggestionInput, baseOptions: WishlistSuggestionOption[]): string {
  const starterAngles = baseOptions
    .map((option, index) => `${index + 1}. ${option.title} -> ${option.searchQuery}`)
    .join("\n");

  return [
    "You are helping a Secret Santa shopping assistant for Lazada in the Philippines.",
    "Return up to 3 shopping angle suggestions as strict JSON.",
    "Each angle must stay close to the original wishlist idea, remain gift-safe, and be phrased as a Lazada-friendly search query.",
    "Avoid inventing brands or exact specs unless the user already implied them.",
    "Do not repeat the same query with minor wording changes.",
    "",
    `Wishlist item: ${input.itemName}`,
    `Category: ${input.itemCategory || "Other"}`,
    `Note: ${input.itemNote || "None"}`,
    buildBudgetContext(input),
    "",
    "Current rule-based starter angles:",
    starterAngles || "None",
    "",
    'Respond as JSON in this shape: {"suggestions":[{"title":"...","subtitle":"...","searchQuery":"..."}]}',
    "Make the title short, the subtitle one sentence, and the searchQuery concise.",
  ].join("\n");
}

export function isGeminiWishlistConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateGeminiWishlistSuggestionDrafts(input: {
  suggestionInput: SuggestionInput;
  baseOptions: WishlistSuggestionOption[];
}): Promise<AiWishlistSuggestionDraft[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return [];
  }

  const model = process.env.GEMINI_WISHLIST_MODEL || DEFAULT_GEMINI_WISHLIST_MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(
      `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildPrompt(input.suggestionInput, input.baseOptions),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.45,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                suggestions: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING" },
                      subtitle: { type: "STRING" },
                      searchQuery: { type: "STRING" },
                    },
                    required: ["title", "subtitle", "searchQuery"],
                  },
                },
              },
              required: ["suggestions"],
            },
          },
        }),
      }
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  const jsonText = extractJsonText(payload);

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
