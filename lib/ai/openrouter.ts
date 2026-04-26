import "server-only";

import {
  buildWishlistBudgetContext,
  parseWishlistSuggestionDraftsFromJson,
} from "@/lib/ai/wishlist-suggestion-drafts";
import type {
  AiWishlistSuggestionDraft,
  SuggestionInput,
  WishlistSuggestionOption,
} from "@/lib/wishlist/suggestions";

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>;
    };
  }>;
  error?: {
    code?: number | string;
    message?: string;
  };
};

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_WISHLIST_MODEL = "openrouter/free";
const OPENROUTER_REQUEST_TIMEOUT_MS = 10000;

function buildPrompt(
  input: SuggestionInput,
  baseOptions: WishlistSuggestionOption[]
): string {
  const starterOptions = baseOptions
    .map((option, index) => `${index + 1}. ${option.title} -> ${option.searchQuery}`)
    .join("\n");

  return [
    "You are helping a Secret Santa shopping assistant for Lazada in the Philippines.",
    "Return up to 3 shopping suggestions as strict JSON only.",
    "Each suggestion must stay close to the original wishlist item, be safe as a gift, and work well as a Lazada search query.",
    "Avoid inventing brands, specs, sizes, or exact models unless the wishlist already implies them.",
    "Do not repeat the same query with tiny wording changes.",
    "",
    `Wishlist item: ${input.itemName}`,
    `Category: ${input.itemCategory || "Other"}`,
    `Note: ${input.itemNote || "None"}`,
    buildWishlistBudgetContext(input),
    "",
    "Current rule-based options:",
    starterOptions || "None",
    "",
    'Respond only as JSON in this shape: {"suggestions":[{"title":"...","subtitle":"...","searchQuery":"..."}]}',
    "Keep titles short, subtitles one sentence, and searchQuery concise.",
  ].join("\n");
}

function extractMessageText(payload: OpenRouterChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text || "")
      .join("")
      .trim();
  }

  return "";
}

function extractJsonObjectText(value: string): string {
  const withoutFence = value
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const startIndex = withoutFence.indexOf("{");
  const endIndex = withoutFence.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return withoutFence;
  }

  return withoutFence.slice(startIndex, endIndex + 1);
}

function buildOpenRouterHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const siteUrl =
    process.env.OPENROUTER_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  const appName = process.env.OPENROUTER_APP_NAME || "Secret Santa";

  if (siteUrl) {
    headers["HTTP-Referer"] = siteUrl;
  }

  if (appName) {
    headers["X-OpenRouter-Title"] = appName;
  }

  return headers;
}

export function isOpenRouterWishlistConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function generateOpenRouterWishlistSuggestionDrafts(input: {
  suggestionInput: SuggestionInput;
  baseOptions: WishlistSuggestionOption[];
}): Promise<AiWishlistSuggestionDraft[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return [];
  }

  const model =
    process.env.OPENROUTER_WISHLIST_MODEL || DEFAULT_OPENROUTER_WISHLIST_MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You generate compact JSON for a shopping assistant. Never include markdown, prose, comments, or code fences.",
          },
          {
            role: "user",
            content: buildPrompt(input.suggestionInput, input.baseOptions),
          },
        ],
        max_completion_tokens: 500,
        temperature: 0.35,
      }),
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as OpenRouterChatCompletionResponse;
  const jsonText = extractJsonObjectText(extractMessageText(payload));

  if (!jsonText) {
    return [];
  }

  return parseWishlistSuggestionDraftsFromJson(jsonText);
}
