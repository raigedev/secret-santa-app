import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function readDotEnv() {
  const values = new Map();

  for (const rawLine of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    values.set(key, value);
  }

  return values;
}

function readRequiredEnv(values, key) {
  const value = process.env[key] || values.get(key);

  if (!value) {
    throw new Error(`Missing ${key}. Set it in .env.local before seeding Playwright data.`);
  }

  return value;
}

function assertLocalSupabaseUrl(value) {
  const url = new URL(value);

  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      "Refusing to seed Playwright data because NEXT_PUBLIC_SUPABASE_URL is not local."
    );
  }

  return url.toString().replace(/\/$/, "");
}

function deriveRecipientEmail(email) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    throw new Error("PLAYWRIGHT_E2E_EMAIL must be a valid email address.");
  }

  const baseLocalPart = localPart.includes("+")
    ? localPart.slice(0, localPart.indexOf("+"))
    : localPart;

  return `${baseLocalPart}+recipient@${domain}`;
}

function getEventDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString().slice(0, 10);
}

async function failOnError(result, label) {
  const awaitedResult = await result;

  if (awaitedResult.error) {
    throw new Error(`${label}: ${awaitedResult.error.message}`);
  }

  return awaitedResult.data;
}

async function ensureUser(admin, { displayName, email, password }) {
  const users = [];
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw new Error(`List auth users: ${error.message}`);
    }

    users.push(...(data.users || []));

    if (!data.users || data.users.length < 200) {
      break;
    }

    page += 1;
  }

  const existingUser = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (error) {
      throw new Error(`Update auth user ${email}: ${error.message}`);
    }

    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (error || !data.user) {
    throw new Error(`Create auth user ${email}: ${error?.message || "No user returned."}`);
  }

  return data.user;
}

async function seed() {
  const values = readDotEnv();
  const supabaseUrl = assertLocalSupabaseUrl(
    readRequiredEnv(values, "NEXT_PUBLIC_SUPABASE_URL")
  );
  const serviceRoleKey = readRequiredEnv(values, "SUPABASE_SERVICE_ROLE_KEY");
  const giverEmail = readRequiredEnv(values, "PLAYWRIGHT_E2E_EMAIL");
  const password = readRequiredEnv(values, "PLAYWRIGHT_E2E_PASSWORD");
  const groupId = readRequiredEnv(values, "PLAYWRIGHT_E2E_GROUP_ID");
  const recipientEmail =
    process.env.PLAYWRIGHT_E2E_RECIPIENT_EMAIL ||
    values.get("PLAYWRIGHT_E2E_RECIPIENT_EMAIL") ||
    deriveRecipientEmail(giverEmail);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const giver = await ensureUser(admin, {
    displayName: "Playwright Giver",
    email: giverEmail,
    password,
  });
  const recipient = await ensureUser(admin, {
    displayName: "Playwright Recipient",
    email: recipientEmail,
    password,
  });

  await failOnError(
    admin.from("profiles").upsert(
      [
        {
          avatar_emoji: "\uD83C\uDF81",
          bio: "Seeded local Playwright account.",
          currency: "PHP",
          default_budget: 1000,
          display_name: "Playwright Giver",
          profile_setup_complete: true,
          user_id: giver.id,
        },
        {
          avatar_emoji: "\uD83C\uDF85",
          bio: "Seeded local Playwright recipient.",
          currency: "PHP",
          default_budget: 1000,
          display_name: "Playwright Recipient",
          profile_setup_complete: true,
          user_id: recipient.id,
        },
      ],
      { onConflict: "user_id" }
    ),
    "Upsert profiles"
  );

  await failOnError(admin.from("messages").delete().eq("group_id", groupId), "Clear messages");
  await failOnError(
    admin.from("thread_reads").delete().eq("group_id", groupId),
    "Clear thread reads"
  );
  await failOnError(
    admin.from("assignments").delete().eq("group_id", groupId),
    "Clear assignments"
  );
  await failOnError(admin.from("wishlists").delete().eq("group_id", groupId), "Clear wishlists");
  await failOnError(
    admin.from("group_members").delete().eq("group_id", groupId),
    "Clear group members"
  );

  await failOnError(
    admin.from("groups").upsert(
      {
        budget: 1000,
        currency: "PHP",
        description: "Local seeded exchange for authenticated Playwright coverage.",
        event_date: getEventDate(),
        id: groupId,
        invites: [],
        name: "Playwright Gift Lab",
        owner_id: giver.id,
        revealed: true,
        revealed_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    ),
    "Upsert group"
  );

  await failOnError(
    admin.from("group_members").insert([
      {
        email: giverEmail,
        group_id: groupId,
        nickname: "Giver",
        role: "owner",
        status: "accepted",
        user_id: giver.id,
      },
      {
        email: recipientEmail,
        group_id: groupId,
        nickname: "Recipient",
        role: "member",
        status: "accepted",
        user_id: recipient.id,
      },
    ]),
    "Insert group members"
  );

  await failOnError(
    admin.from("assignments").insert([
      {
        gift_prep_status: "planning",
        gift_prep_updated_at: new Date().toISOString(),
        gift_received: false,
        giver_id: giver.id,
        group_id: groupId,
        receiver_id: recipient.id,
      },
      {
        gift_prep_status: "planning",
        gift_prep_updated_at: new Date().toISOString(),
        gift_received: false,
        giver_id: recipient.id,
        group_id: groupId,
        receiver_id: giver.id,
      },
    ]),
    "Insert assignments"
  );

  await failOnError(
    admin.from("wishlists").insert([
      {
        group_id: groupId,
        item_category: "Tech",
        item_name: "Wireless earbuds",
        item_note: "Comfortable for calls and music.",
        preferred_price_max: 1000,
        preferred_price_min: 500,
        priority: 2,
        user_id: recipient.id,
      },
      {
        group_id: groupId,
        item_category: "Home",
        item_name: "Cozy mug",
        item_note: "Something sturdy for coffee.",
        preferred_price_max: 650,
        preferred_price_min: 250,
        priority: 1,
        user_id: giver.id,
      },
    ]),
    "Insert wishlist items"
  );

  await failOnError(
    admin.from("messages").insert([
      {
        content: "Any color you would avoid?",
        group_id: groupId,
        sender_id: giver.id,
        thread_giver_id: giver.id,
        thread_receiver_id: recipient.id,
      },
      {
        content: "Warm colors are perfect.",
        group_id: groupId,
        sender_id: recipient.id,
        thread_giver_id: giver.id,
        thread_receiver_id: recipient.id,
      },
    ]),
    "Insert chat messages"
  );

  console.log("Seeded local Playwright Supabase data.");
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
