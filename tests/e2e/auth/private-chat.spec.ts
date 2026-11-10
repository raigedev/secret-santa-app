import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  CHAT_ACTIVE_MESSAGE_POLL_MS,
  CHAT_EXCHANGE_POLL_MS,
  CHAT_IDLE_MESSAGE_POLL_MS,
  nextChatMessagePollDelay,
} from "../../../app/secret-santa-chat/chat-polling";
import { fetchMyAssignmentGiftPrep } from "../../../lib/assignments/gift-prep-client";
import { loginWithTestCredentials } from "../helpers/auth";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

// The local avatar image is intercepted over loopback HTTP; production photos use HTTPS.
test.use({ bypassCSP: true });

test("quiet chats back off without delaying active-message checks", () => {
  expect(nextChatMessagePollDelay(CHAT_ACTIVE_MESSAGE_POLL_MS, 59_999)).toBe(15_000);
  const firstIdleDelay = nextChatMessagePollDelay(CHAT_ACTIVE_MESSAGE_POLL_MS, 60_000);
  expect(firstIdleDelay).toBe(30_000);
  expect(nextChatMessagePollDelay(firstIdleDelay, 90_000)).toBe(CHAT_IDLE_MESSAGE_POLL_MS);
  expect(nextChatMessagePollDelay(CHAT_IDLE_MESSAGE_POLL_MS, 150_000)).toBe(60_000);
  expect(nextChatMessagePollDelay(CHAT_IDLE_MESSAGE_POLL_MS, 0)).toBe(15_000);
  expect(CHAT_EXCHANGE_POLL_MS).toBe(180_000);
});

test("assignment lookups preserve the group after the first batch", async () => {
  const ids: string[] = Array.from({ length: 51 }, () => randomUUID());
  const assignedGroupIds = [ids[0], ids[50]];
  const requests: string[][] = [];
  const originalFetch = globalThis.fetch;
  let rejectLastBatch = false;

  globalThis.fetch = async (_input, init) => {
    const { groupIds } = JSON.parse(String(init?.body)) as { groupIds: string[] };
    requests.push(groupIds);
    if (rejectLastBatch && groupIds.includes(ids[50])) return new Response(null, { status: 503 });
    return Response.json({
      rows: groupIds.slice(0, 50).filter((id) => assignedGroupIds.includes(id)).map((group_id) => ({
        group_id,
        receiver_id: randomUUID(),
        receiver_nickname: "Ribbon Keeper",
        gift_prep_status: null,
        gift_prep_updated_at: null,
        gift_received: false,
        gift_received_at: null,
      })),
    });
  };

  try {
    const result = await fetchMyAssignmentGiftPrep([...ids, ids[0], "invalid"]);
    expect(requests).toEqual([ids.slice(0, 50), ids.slice(50)]);
    expect(result.error).toBeNull();
    expect(result.data.map((row) => row.group_id)).toEqual(assignedGroupIds);

    rejectLastBatch = true;
    const failed = await fetchMyAssignmentGiftPrep(ids);
    expect(failed.error?.message).toBe("Failed to load gift progress.");
    expect(failed.data).toEqual([]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("separate chats deliver both ways and stay scoped to the selected exchange", async ({ page, browser, baseURL }, testInfo) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(
    process.env.PLAYWRIGHT_LOCAL_FIXTURES !== "1" ||
      !baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname) ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL ||
      !serviceRoleKey || !anonKey,
    "This test writes disposable fixtures to local Supabase only."
  );
  test.setTimeout(90_000);

  const auth = { persistSession: false, autoRefreshToken: false };
  const admin = createClient(LOCAL_SUPABASE_URL, serviceRoleKey!, { auth });
  const accounts: Array<{ id: string; email: string; password: string }> = [];
  const password = randomUUID();
  const runId = randomUUID();
  const recipientContext = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined });
  let groupId: string | undefined;
  let otherGroupId: string | undefined;
  let historicalGroupIds: string[] = [];

  try {
    for (const role of ["giver", "giftee", "peer"]) {
      const email = `chat-${role}-${runId}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw new Error("Could not create the local chat account.");
      accounts.push({ id: data.user.id, email, password });
    }
    const [giver, giftee, peer] = accounts;
    const profiles = await admin.from("profiles").upsert([
      { user_id: giftee.id, display_name: "Private fixture profile" },
      { user_id: peer.id, display_name: "Visible fixture profile" },
    ], { onConflict: "user_id" });
    expect(profiles.error).toBeNull();
    const { data: group, error: groupError } = await admin.from("groups").insert({
      owner_id: peer.id,
      name: "Private chat check",
      event_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      event_timezone: "UTC",
      require_anonymous_nickname: true,
      revealed: false,
    }).select("id").single();
    if (groupError || !group) throw new Error("Could not create the local chat group.");
    groupId = group.id;
    const otherGroup = await admin.from("groups").insert({
      owner_id: peer.id,
      name: "Second exchange",
      event_date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
      event_timezone: "UTC",
      require_anonymous_nickname: false,
      revealed: false,
    }).select("id").single();
    if (otherGroup.error || !otherGroup.data) throw new Error("Could not create the second chat group.");
    otherGroupId = otherGroup.data.id;

    const historicalDate = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const historical = await admin.from("groups").insert(
      Array.from({ length: 50 }, (_, index) => ({
        owner_id: peer.id,
        name: `Older exchange ${index + 1}`,
        event_date: historicalDate,
        event_timezone: "UTC",
        require_anonymous_nickname: true,
      }))
    ).select("id");
    expect(historical.error).toBeNull();
    historicalGroupIds = (historical.data || []).map((row) => row.id);
    expect(historicalGroupIds).toHaveLength(50);

    const { error: memberError } = await admin.from("group_members").insert([
      { group_id: groupId, user_id: giver.id, email: giver.email, nickname: "Gift Captain", role: "member", status: "accepted" },
      { group_id: groupId, user_id: giftee.id, email: giftee.email, nickname: "Ribbon Keeper", role: "member", status: "accepted" },
      { group_id: groupId, user_id: peer.id, email: peer.email, nickname: "Snow Riddle", role: "owner", status: "accepted" },
      { group_id: otherGroupId, user_id: giver.id, email: giver.email, nickname: "Gift Captain", role: "member", status: "accepted" },
      { group_id: otherGroupId, user_id: peer.id, email: peer.email, nickname: "Holly", role: "owner", status: "accepted" },
      ...historicalGroupIds.map((oldGroupId) => ({
        group_id: oldGroupId, user_id: giver.id, email: giver.email,
        nickname: "Gift Captain", role: "member", status: "accepted",
      })),
    ]);
    expect(memberError).toBeNull();
    const { error: assignmentError } = await admin.from("assignments").insert([
      { group_id: groupId, giver_id: giver.id, receiver_id: giftee.id },
      { group_id: groupId, giver_id: giftee.id, receiver_id: peer.id },
      { group_id: groupId, giver_id: peer.id, receiver_id: giver.id },
      { group_id: otherGroupId, giver_id: giver.id, receiver_id: peer.id },
      { group_id: otherGroupId, giver_id: peer.id, receiver_id: giver.id },
    ]);
    expect(assignmentError).toBeNull();
    const otherMessage = "Do you prefer books or snacks?";
    const followUpMessage = "Any allergies I should know about?";
    const yesterday = new Date(Date.now() - 86_400_000);
    yesterday.setHours(12, 0, 0, 0);
    const { error: fixtureMessageError } = await admin.from("messages").insert(
      [otherMessage, followUpMessage].map((content, index) => ({
        group_id: groupId, sender_id: peer.id, thread_giver_id: peer.id,
        thread_receiver_id: giver.id, content,
        created_at: new Date(yesterday.getTime() + index * 60_000).toISOString(),
      }))
    );
    expect(fixtureMessageError).toBeNull();
    const { error: visibleMessageError } = await admin.from("messages").insert([
      {
        group_id: otherGroupId, sender_id: peer.id, thread_giver_id: giver.id,
        thread_receiver_id: peer.id, content: "I would love a board game.",
      },
      {
        group_id: otherGroupId, sender_id: peer.id, thread_giver_id: peer.id,
        thread_receiver_id: giver.id, content: "What games do you like?",
      },
    ]);
    expect(visibleMessageError).toBeNull();

    const recipientPage = await recipientContext.newPage();
    await loginWithTestCredentials(page, giver);
    await loginWithTestCredentials(recipientPage, giftee);

    const profileResponse = await page.request.post("/api/groups/peer-profiles", {
      data: { groupIds: [groupId, otherGroupId] },
      headers: { origin: baseURL! },
    });
    expect(profileResponse.ok()).toBeTruthy();
    const { profilesByGroup } = await profileResponse.json() as { profilesByGroup: Record<string, unknown> };
    expect(profilesByGroup[groupId!]).toBeUndefined();
    expect(profilesByGroup[otherGroupId!]).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: peer.id }),
    ]));

    const fixturePhoto = `${LOCAL_SUPABASE_URL}/storage/v1/object/public/profile-avatars/${peer.id}/avatar-fixture-chat.png`;
    await page.route(fixturePhoto, (route) => route.fulfill({ path: "public/gifts.png", contentType: "image/png" }));
    await page.route("**/api/groups/peer-profiles", (route) => route.fulfill({
      json: { profilesByGroup: { [otherGroupId!]: [{ user_id: peer.id, avatar_url: fixturePhoto }] } },
    }));

    const chatLookups: string[][] = [];
    const avatarLookups: string[][] = [];
    page.on("request", (request) => {
      if (request.method() !== "POST" || new URL(page.url()).pathname !== "/secret-santa-chat") return;
      const path = new URL(request.url()).pathname;
      if (path !== "/api/assignments/gift-prep" && path !== "/api/groups/peer-profiles") return;
      const { groupIds } = request.postDataJSON() as { groupIds: string[] };
      (path === "/api/assignments/gift-prep" ? chatLookups : avatarLookups).push(groupIds);
    });

    const firstMessage = "Any favorite colors for wrapping?";
    const replyMessage = "Forest green, please!";
    let safePayload = "";
    let replyActionId: string | undefined;
    await recipientPage.route("**/secret-santa-chat", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      if (request.postData()?.includes(replyMessage)) replyActionId = request.headers()["next-action"];
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(firstMessage)) safePayload = body;
      await route.fulfill({ response });
    });

    await page.goto("/secret-santa-chat");
    await recipientPage.goto("/secret-santa-chat");
    const giverBox = page.getByRole("region", { name: "The person you're gifting" });
    const santaBox = page.getByRole("region", { name: "The person gifting you" });
    const recipientSantaBox = recipientPage.getByRole("region", { name: "The person gifting you" });
    await expect(giverBox.getByRole("heading", { name: "Ribbon Keeper" })).toBeVisible({ timeout: 10_000 });
    await expect(santaBox.getByRole("heading", { name: "Your Secret Santa" })).toBeVisible();
    await expect(santaBox.getByText(otherMessage, { exact: true })).toBeVisible();
    await expect(santaBox.getByText(followUpMessage, { exact: true })).toBeVisible();
    const santaLabels = santaBox.getByRole("log").getByText("Your Secret Santa", { exact: true });
    await expect(santaLabels).toHaveCount(1);
    await expect(santaLabels).toBeVisible();
    await expect(santaBox.getByRole("log").getByText("Snow Riddle", { exact: true })).toHaveCount(0);
    await expect(santaBox.getByTestId("chat-sender-avatar")).toHaveCount(1);
    expect(chatLookups[0]).toEqual([groupId, otherGroupId]);
    const [giverBounds, santaBounds] = await Promise.all([giverBox.boundingBox(), santaBox.boundingBox()]);
    expect(giverBounds).not.toBeNull();
    expect(santaBounds).not.toBeNull();
    const stacked = (page.viewportSize()?.width ?? 0) < 680;
    if (stacked) {
      expect(santaBounds!.y).toBeGreaterThanOrEqual(giverBounds!.y + giverBounds!.height);
    } else {
      expect(santaBounds!.x).toBeGreaterThanOrEqual(giverBounds!.x + giverBounds!.width);
      expect(santaBounds!.y).toBe(giverBounds!.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(recipientSantaBox.getByRole("textbox", { name: "Reply to your Santa" })).toBeVisible();
    if (stacked) await recipientPage.setViewportSize({ width: 390, height: 680 });

    const santaDraft = santaBox.getByRole("textbox", { name: "Reply to your Santa" });
    await santaDraft.fill("A separate draft");
    const viewControl = page.getByRole("group", { name: "Chat view" });
    await expect(viewControl.getByRole("button", { name: "Both" })).toHaveAttribute("aria-pressed", "true");
    await viewControl.getByRole("button", { name: /^My giftee/ }).click();
    await expect(santaBox).toBeHidden();
    if (!stacked) expect((await giverBox.boundingBox())!.width).toBeGreaterThan(giverBounds!.width);
    await page.screenshot({ path: testInfo.outputPath("giftee-focus.png"), fullPage: true });
    await viewControl.getByRole("button", { name: /^My Santa/ }).click();
    await expect(giverBox).toBeHidden();
    await expect(santaDraft).toHaveValue("A separate draft");
    await viewControl.getByRole("button", { name: "Both" }).click();

    const giverDraft = giverBox.getByRole("textbox", { name: "Message Ribbon Keeper" });
    const send = giverBox.getByRole("button", { name: "Send", exact: true });
    const failedMessage = "Keep this draft if sending fails.";
    const heldSend = Promise.withResolvers<void>();
    await page.route("**/secret-santa-chat", async (route) => {
      const body = route.request().postData();
      if (body?.includes(failedMessage)) {
        await route.abort();
        return;
      }
      if (body?.includes(firstMessage)) await heldSend.promise;
      await route.continue();
    });
    await giverDraft.fill(failedMessage);
    await send.click();
    await expect(giverBox.getByRole("alert")).toHaveText(/could not send/);
    await expect(giverDraft).toHaveValue(failedMessage);
    await expect(giverBox.getByRole("log").getByText(failedMessage, { exact: true })).toHaveCount(0);

    try {
      await giverDraft.fill(firstMessage);
      await send.click();
      await expect(giverBox.getByText(firstMessage, { exact: true })).toBeVisible();
      await expect(giverBox.getByText("Sending...", { exact: true })).toBeVisible();
      await expect(send).toBeDisabled();
    } finally {
      heldSend.resolve();
    }
    await expect(giverBox.getByText("Sending...", { exact: true })).toHaveCount(0);
    await expect(giverBox.getByText(firstMessage, { exact: true })).toHaveCount(1);
    await expect(giverDraft).toHaveValue("");
    await expect(santaDraft).toHaveValue("A separate draft");
    await expect(santaBox.getByText(firstMessage, { exact: true })).toHaveCount(0);
    await expect(recipientSantaBox.getByText(firstMessage, { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(recipientSantaBox.getByRole("log").getByText("Your Secret Santa", { exact: true })).toBeVisible();
    await expect(giverBox.getByRole("log").getByText("Ribbon Keeper", { exact: true })).toHaveCount(0);
    if (stacked) {
      await expect(recipientSantaBox.getByText(firstMessage, { exact: true })).not.toBeInViewport();
      await recipientPage.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(recipientSantaBox.getByText("1 new", { exact: true })).toBeVisible();
    }
    await expect.poll(() => safePayload).toContain(firstMessage);
    expect(safePayload).not.toContain(giver.id);
    expect(safePayload).not.toContain(giver.email);
    expect(safePayload).not.toContain("Gift Captain");

    await recipientSantaBox.getByRole("textbox", { name: "Reply to your Santa" }).fill(replyMessage);
    await recipientSantaBox.getByRole("button", { name: "Send", exact: true }).click();
    await expect(giverBox.getByText(replyMessage, { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(giverBox.getByRole("log").getByText("Ribbon Keeper", { exact: true })).toBeVisible();
    await expect(giverBox.getByTestId("chat-sender-avatar")).toHaveText("R");
    expect(avatarLookups).toEqual([]);
    await expect(recipientSantaBox.getByText("1 new", { exact: true })).toHaveCount(0);
    await santaDraft.clear();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("two-chat-boxes.png"), fullPage: true });
    await page.getByRole("button", { name: /^Second exchange(?: New messages)?$/ }).click({ timeout: 10_000 });
    await expect(giverBox.getByRole("heading", { name: "Holly" })).toBeVisible();
    await expect(giverBox.getByText(replyMessage, { exact: true })).toHaveCount(0);
    const gifteePhoto = giverBox.getByTestId("chat-sender-avatar").locator("img");
    await expect(gifteePhoto).toHaveAttribute("src", fixturePhoto);
    await expect.poll(() => gifteePhoto.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(santaBox.getByTestId("chat-sender-avatar").locator("img")).toHaveAttribute("src", /secret-santa-logo\.png/);
    expect(avatarLookups.length).toBeGreaterThan(0);
    expect(avatarLookups.every((ids) => ids.length === 1 && ids[0] === otherGroupId)).toBeTruthy();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("profile-photo-chat.png"), fullPage: true });
    await page.getByRole("button", { name: /^Private chat check(?: New messages)?$/ }).click({ timeout: 10_000 });
    await expect(giverBox.getByText(replyMessage, { exact: true })).toBeVisible();

    const client = createClient(LOCAL_SUPABASE_URL, anonKey!, { auth });
    const { error: signInError } = await client.auth.signInWithPassword(giftee);
    expect(signInError).toBeNull();
    const rawIncoming = await client.from("messages").select("thread_giver_id")
      .eq("group_id", groupId).eq("thread_receiver_id", giftee.id);
    expect(rawIncoming.error).toBeNull();
    expect(rawIncoming.data).toEqual([]);

    await recipientPage.reload();
    await expect(recipientSantaBox.getByText(firstMessage, { exact: true })).toBeVisible();
    await expect(recipientSantaBox.getByText(replyMessage, { exact: true })).toBeVisible();

    const { error: membershipError } = await admin.from("group_members")
      .update({ status: "declined" }).eq("group_id", groupId).eq("user_id", giftee.id);
    expect(membershipError).toBeNull();
    expect(replyActionId).toBeTruthy();
    const blockedReply = "This reply must not be saved.";
    const rejected = await recipientPage.request.post("/secret-santa-chat", {
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Next-Action": replyActionId!,
        Origin: new URL(recipientPage.url()).origin,
      },
      data: JSON.stringify([`receiver:${groupId}`, blockedReply]),
    });
    expect(await rejected.text()).toContain("This chat is no longer available.");
    const saved = await admin.from("messages").select("id").eq("group_id", groupId).eq("content", blockedReply);
    expect(saved.error).toBeNull();
    expect(saved.data).toEqual([]);
  } finally {
    await recipientContext.close();
    const fixtureGroupIds = [...historicalGroupIds, groupId, otherGroupId].filter((id) => id !== undefined);
    if (fixtureGroupIds.length > 0) {
      await admin.from("groups").delete().in("id", fixtureGroupIds).eq("owner_id", accounts[2].id);
    }
    for (const account of accounts) await admin.auth.admin.deleteUser(account.id);
  }
});
