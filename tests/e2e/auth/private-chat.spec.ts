import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginWithTestCredentials } from "../helpers/auth";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

test("private chat shows the giftee alias and delivers both ways before reveal", async ({ page, browser, baseURL }) => {
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

  try {
    for (const role of ["giver", "giftee", "peer"]) {
      const email = `chat-${role}-${runId}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw new Error("Could not create the local chat account.");
      accounts.push({ id: data.user.id, email, password });
    }
    const [giver, giftee, peer] = accounts;
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

    const { error: memberError } = await admin.from("group_members").insert([
      { group_id: groupId, user_id: giver.id, email: giver.email, nickname: "Gift Captain", role: "member", status: "accepted" },
      { group_id: groupId, user_id: giftee.id, email: giftee.email, nickname: "Ribbon Keeper", role: "member", status: "accepted" },
      { group_id: groupId, user_id: peer.id, email: peer.email, nickname: "Snow Riddle", role: "owner", status: "accepted" },
    ]);
    expect(memberError).toBeNull();
    const { error: assignmentError } = await admin.from("assignments").insert([
      { group_id: groupId, giver_id: giver.id, receiver_id: giftee.id },
      { group_id: groupId, giver_id: giftee.id, receiver_id: peer.id },
      { group_id: groupId, giver_id: peer.id, receiver_id: giver.id },
    ]);
    expect(assignmentError).toBeNull();

    const recipientPage = await recipientContext.newPage();
    await loginWithTestCredentials(page, giver);
    await loginWithTestCredentials(recipientPage, giftee);

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
    await page.getByRole("button", { name: /To Ribbon Keeper/ }).click({ timeout: 10_000 });
    await recipientPage.getByRole("button", { name: /From your Secret Santa/ }).click({ timeout: 10_000 });

    await page.getByRole("textbox", { name: /message composer/i }).fill(firstMessage);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(recipientPage.getByText(firstMessage, { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect.poll(() => safePayload).toContain(firstMessage);
    expect(safePayload).not.toContain(giver.id);
    expect(safePayload).not.toContain(giver.email);
    expect(safePayload).not.toContain("Gift Captain");

    await recipientPage.getByRole("textbox", { name: /message composer/i }).fill(replyMessage);
    await recipientPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(replyMessage, { exact: true })).toBeVisible({ timeout: 25_000 });

    const client = createClient(LOCAL_SUPABASE_URL, anonKey!, { auth });
    const { error: signInError } = await client.auth.signInWithPassword(giftee);
    expect(signInError).toBeNull();
    const rawIncoming = await client.from("messages").select("thread_giver_id")
      .eq("group_id", groupId).eq("thread_receiver_id", giftee.id);
    expect(rawIncoming.error).toBeNull();
    expect(rawIncoming.data).toEqual([]);

    await recipientPage.reload();
    await recipientPage.getByRole("button", { name: /From your Secret Santa/ }).click();
    await expect(recipientPage.getByText(firstMessage, { exact: true })).toBeVisible();
    await expect(recipientPage.getByText(replyMessage, { exact: true })).toBeVisible();

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
    if (groupId) await admin.from("groups").delete().eq("id", groupId).eq("owner_id", accounts[2].id);
    for (const account of accounts) await admin.auth.admin.deleteUser(account.id);
  }
});
