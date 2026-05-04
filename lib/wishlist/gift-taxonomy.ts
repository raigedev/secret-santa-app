type GiftTaxonomySuggestionTemplate = {
  title: string;
  subtitle: string;
  searchQuery: string;
  typicalMin: number | null;
  typicalMax: number | null;
};

type GiftTaxonomyRule = {
  keywords: string[];
  templates: GiftTaxonomySuggestionTemplate[];
};

const GIFT_TAXONOMY_RULES: GiftTaxonomyRule[] = [
  {
    keywords: [
      "coffee",
      "espresso",
      "latte",
      "cappuccino",
      "cold brew",
      "pour over",
      "french press",
      "matcha",
      "tea",
    ],
    templates: [
      {
        title: "Coffee and tea corner",
        subtitle: "A cozy pick for daily drinks at home or work.",
        searchQuery: "coffee tea gift set",
        typicalMin: 300,
        typicalMax: 1400,
      },
      {
        title: "Cafe-style drink kit",
        subtitle: "Good for someone who enjoys coffee, matcha, or warm drinks.",
        searchQuery: "coffee matcha drink kit",
        typicalMin: 350,
        typicalMax: 1600,
      },
      {
        title: "Desk mug and tumbler picks",
        subtitle: "Useful when you want a practical gift that still feels personal.",
        searchQuery: "coffee tumbler mug",
        typicalMin: 250,
        typicalMax: 1200,
      },
    ],
  },
  {
    keywords: ["book", "novel", "manga", "comic", "reading", "author", "journal"],
    templates: [
      {
        title: "Book lover picks",
        subtitle: "Easy add-ons for someone who likes reading or collecting books.",
        searchQuery: "book lover gift",
        typicalMin: 250,
        typicalMax: 1200,
      },
      {
        title: "Reading nook extras",
        subtitle: "Small comforts that make reading time feel nicer.",
        searchQuery: "reading nook gift",
        typicalMin: 300,
        typicalMax: 1500,
      },
    ],
  },
  {
    keywords: [
      "game",
      "gaming",
      "controller",
      "console",
      "steam",
      "nintendo",
      "playstation",
      "xbox",
    ],
    templates: [
      {
        title: "Cozy gamer setup",
        subtitle: "Accessories and small upgrades for play time.",
        searchQuery: "gaming setup accessories gift",
        typicalMin: 400,
        typicalMax: 2500,
      },
      {
        title: "Game night picks",
        subtitle: "Good when the gift can be fun, social, or low-pressure.",
        searchQuery: "game night gift",
        typicalMin: 500,
        typicalMax: 2000,
      },
    ],
  },
  {
    keywords: [
      "music",
      "guitar",
      "piano",
      "keyboard",
      "vinyl",
      "album",
      "headphones",
      "speaker",
      "microphone",
    ],
    templates: [
      {
        title: "Music lover picks",
        subtitle: "Simple accessories for listening, practicing, or collecting.",
        searchQuery: "music lover gift",
        typicalMin: 350,
        typicalMax: 2200,
      },
      {
        title: "Listening setup extras",
        subtitle: "Useful when they enjoy audio gear or a better desk setup.",
        searchQuery: "audio desk setup gift",
        typicalMin: 500,
        typicalMax: 2500,
      },
    ],
  },
  {
    keywords: ["baking", "cooking", "kitchen", "cookware", "snack", "food", "recipe"],
    templates: [
      {
        title: "Kitchen helper picks",
        subtitle: "Practical tools for someone who likes cooking or baking.",
        searchQuery: "kitchen helper gift",
        typicalMin: 300,
        typicalMax: 1800,
      },
      {
        title: "Snack basket ideas",
        subtitle: "A safe gift when something shareable or consumable feels right.",
        searchQuery: "snack basket gift",
        typicalMin: 300,
        typicalMax: 1500,
      },
    ],
  },
  {
    keywords: ["travel", "trip", "camping", "hiking", "outdoor", "luggage", "backpack"],
    templates: [
      {
        title: "Travel-ready picks",
        subtitle: "Handy organizers and comfort items for trips or commutes.",
        searchQuery: "travel organizer gift",
        typicalMin: 300,
        typicalMax: 1800,
      },
      {
        title: "Outdoor day kit",
        subtitle: "Small gear for hiking, camping, or time outside.",
        searchQuery: "outdoor day kit gift",
        typicalMin: 400,
        typicalMax: 2200,
      },
    ],
  },
  {
    keywords: ["art", "drawing", "paint", "painting", "sketch", "craft", "crochet", "sewing"],
    templates: [
      {
        title: "Creative supplies",
        subtitle: "A flexible pick for drawing, painting, or handmade hobbies.",
        searchQuery: "creative art supplies gift",
        typicalMin: 250,
        typicalMax: 1500,
      },
      {
        title: "Desk craft kit",
        subtitle: "Nice for someone who likes making things in small sessions.",
        searchQuery: "desk craft kit gift",
        typicalMin: 300,
        typicalMax: 1600,
      },
    ],
  },
  {
    keywords: ["fitness", "gym", "yoga", "running", "run", "workout", "exercise"],
    templates: [
      {
        title: "Active lifestyle picks",
        subtitle: "Useful accessories for workouts, walks, or daily movement.",
        searchQuery: "fitness accessories gift",
        typicalMin: 300,
        typicalMax: 1800,
      },
      {
        title: "Recovery and wellness kit",
        subtitle: "A softer option for rest days and post-workout care.",
        searchQuery: "recovery wellness gift",
        typicalMin: 350,
        typicalMax: 2000,
      },
    ],
  },
  {
    keywords: ["skincare", "skin care", "makeup", "fragrance", "perfume", "self care"],
    templates: [
      {
        title: "Self-care set",
        subtitle: "Gift-ready care items when the exact brand is flexible.",
        searchQuery: "self care gift set",
        typicalMin: 300,
        typicalMax: 1800,
      },
      {
        title: "Beauty organizer picks",
        subtitle: "A practical add-on for skincare, makeup, or fragrance lovers.",
        searchQuery: "beauty organizer gift",
        typicalMin: 250,
        typicalMax: 1400,
      },
    ],
  },
  {
    keywords: ["pet", "dog", "cat", "feline", "canine", "leash", "litter", "aquarium"],
    templates: [
      {
        title: "Pet parent picks",
        subtitle: "Useful or playful gifts for someone who loves their pet.",
        searchQuery: "pet parent gift",
        typicalMin: 300,
        typicalMax: 1500,
      },
      {
        title: "Pet care extras",
        subtitle: "A practical option when the gift can help with everyday pet care.",
        searchQuery: "pet care essentials gift",
        typicalMin: 300,
        typicalMax: 1600,
      },
    ],
  },
];

function normalizeSearchText(value: string): string {
  let normalized = "";
  let previousWasSpace = true;

  for (const character of value.toLowerCase()) {
    const code = character.charCodeAt(0);
    const isAsciiNumber = code >= 48 && code <= 57;
    const isAsciiLetter = code >= 97 && code <= 122;

    if (isAsciiNumber || isAsciiLetter) {
      normalized += character;
      previousWasSpace = false;
      continue;
    }

    if (!previousWasSpace) {
      normalized += " ";
      previousWasSpace = true;
    }
  }

  return normalized.trim();
}

function hasKeyword(haystack: string, keyword: string): boolean {
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  return ` ${haystack} `.includes(` ${normalizedKeyword} `);
}

function dedupeTemplates(
  templates: GiftTaxonomySuggestionTemplate[]
): GiftTaxonomySuggestionTemplate[] {
  const seenQueries = new Set<string>();

  return templates.filter((template) => {
    const query = normalizeSearchText(template.searchQuery);

    if (!query || seenQueries.has(query)) {
      return false;
    }

    seenQueries.add(query);
    return true;
  });
}

export function buildGiftTaxonomySuggestionTemplates(
  itemName: string,
  itemNote: string,
  limit = 4
): GiftTaxonomySuggestionTemplate[] {
  const haystack = normalizeSearchText(`${itemName} ${itemNote}`);
  const matchedTemplates: GiftTaxonomySuggestionTemplate[] = [];

  for (const rule of GIFT_TAXONOMY_RULES) {
    if (rule.keywords.some((keyword) => hasKeyword(haystack, keyword))) {
      matchedTemplates.push(...rule.templates);
    }

    if (matchedTemplates.length >= limit) {
      break;
    }
  }

  return dedupeTemplates(matchedTemplates).slice(0, limit);
}
