import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginWithTestCredentials } from "../helpers/auth";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

test("joined members see private aliases and only their own draw result", async ({ page, browser, baseURL }) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const localApp = baseURL && ["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname);
  test.skip(
    process.env.PLAYWRIGHT_LOCAL_FIXTURES !== "1" ||
      !localApp ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL ||
      !serviceRoleKey ||
      !anonKey,
    "This test writes disposable fixtures to local Supabase only."
  );
  test.setTimeout(60_000);

  const auth = { persistSession: false, autoRefreshToken: false };
  const admin = createClient(LOCAL_SUPABASE_URL, serviceRoleKey!, { auth });
  const runId = randomUUID();
  const password = randomUUID();
  const userIds: string[] = [];
  let groupId: string | undefined;

  async function createUser(role: string) {
    const email = `${role}-${runId}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Could not create the local test account.");
    userIds.push(data.user.id);
    return { id: data.user.id, email, password };
  }

  try {
    const owner = await createUser("organizer");
    const member = await createUser("participant");
    const other = await createUser("other");
    const invitee = await createUser("invitee");
    const groupName = "Private roster check";
    const { data: group, error: groupError } = await admin
      .from("groups")
      .insert({
        owner_id: owner.id,
        name: groupName,
        event_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
        event_timezone: "UTC",
        require_anonymous_nickname: true,
      })
      .select("id")
      .single();
    if (groupError || !group) throw new Error("Could not create the local test group.");
    groupId = group.id;

    const { error: memberError } = await admin.from("group_members").insert([
      { group_id: groupId, user_id: owner.id, email: owner.email, nickname: "Gift Captain", role: "owner", status: "accepted" },
      { group_id: groupId, user_id: member.id, email: member.email, nickname: "Snow Riddle", role: "member", status: "accepted" },
      { group_id: groupId, user_id: other.id, email: other.email, nickname: "Ribbon Keeper", role: "member", status: "accepted" },
      { group_id: groupId, user_id: invitee.id, email: invitee.email, role: "member", status: "pending" },
    ]);
    expect(memberError).toBeNull();

    const memberClient = createClient(LOCAL_SUPABASE_URL, anonKey!, { auth });
    const { error: signInError } = await memberClient.auth.signInWithPassword(member);
    expect(signInError).toBeNull();
    const { data: directRows, error: directError } = await memberClient
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);
    expect(directError).toBeNull();
    expect(directRows).toEqual([{ user_id: member.id }]);

    await loginWithTestCredentials(page, member);
    const groupPath = `/group/${groupId}`;
    let rosterPayload = "";
    await page.route(`**${groupPath}`, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      const response = await route.fetch();
      const body = await response.text();
      if (body.includes("participant-")) rosterPayload = body;
      await route.fulfill({ response });
    });
    await page.goto(groupPath);
    const roster = page.getByRole("region", { name: "Members" });
    await expect(roster.getByRole("heading", { name: "Members (3)" })).toBeVisible();
    await expect(roster.getByText("Gift Captain", { exact: true })).toBeVisible();
    await expect(roster.getByText("Snow Riddle", { exact: true })).toBeVisible();
    await roster.getByRole("button", { name: "Change alias", exact: true }).click();
    await expect(roster.getByRole("textbox", { name: "Secret Santa alias" })).toHaveValue("Snow Riddle");
    await roster.getByRole("button", { name: "Cancel", exact: true }).click();
    const summary = page.getByRole("region", { name: "Event summary" });
    await expect(summary.getByText("Joined members", { exact: true })).toBeVisible();
    await expect(summary.getByText("3", { exact: true })).toBeVisible();

    expect(rosterPayload).toContain("Gift Captain");
    expect(rosterPayload).not.toContain(owner.id);
    expect(rosterPayload).not.toContain(owner.email);
    expect(rosterPayload).not.toContain(invitee.id);
    expect(rosterPayload).not.toContain(invitee.email);

    const { error: assignmentError } = await admin.from("assignments").insert([
      { group_id: groupId, giver_id: owner.id, receiver_id: member.id },
      { group_id: groupId, giver_id: member.id, receiver_id: other.id },
      { group_id: groupId, giver_id: other.id, receiver_id: owner.id },
    ]);
    expect(assignmentError).toBeNull();

    await page.reload();
    const draw = page.locator("#draw-controls");
    await expect(draw.getByText("Names have been drawn", { exact: true })).toBeVisible();
    await expect(draw.getByText("Ribbon Keeper", { exact: true })).toBeVisible();
    await expect(draw.getByText("Gift Captain", { exact: true })).toHaveCount(0);

    const giftPrepRequest = {
      data: { groupIds: [groupId], giverId: owner.id, receiverId: owner.id },
      headers: { Origin: new URL(page.url()).origin },
    };
    const giftPrep = await page.request.post("/api/assignments/gift-prep", giftPrepRequest);
    expect(giftPrep.ok()).toBeTruthy();
    expect(await giftPrep.json()).toEqual({
      rows: [expect.objectContaining({ group_id: groupId, receiver_id: other.id, receiver_nickname: "Ribbon Keeper" })],
    });
    const giftPrepBody = await giftPrep.text();
    expect(giftPrepBody).not.toContain(owner.id);
    expect(giftPrepBody).not.toContain(other.email);

    await page.goto("/my-giftee");
    await expect(page.getByText("Ribbon Keeper", { exact: true }).first()).toBeVisible();

    const pendingContext = await browser.newContext({ baseURL });
    try {
      const pendingPage = await pendingContext.newPage();
      await loginWithTestCredentials(pendingPage, invitee);
      await pendingPage.goto(groupPath);
      await expect(pendingPage.getByText("Accept your invitation in My Groups to see the members.")).toBeVisible();
      await expect(pendingPage.getByText("Gift Captain", { exact: true })).toHaveCount(0);
      const pendingGiftPrep = await pendingPage.request.post("/api/assignments/gift-prep", giftPrepRequest);
      expect(pendingGiftPrep.ok()).toBeTruthy();
      expect(await pendingGiftPrep.json()).toEqual({ rows: [] });
      await pendingPage.goto("/groups");
      const invitations = pendingPage.getByRole("region", { name: "Pending invitations" });
      await expect(invitations.getByRole("heading", { name: groupName })).toBeVisible();
    } finally {
      await pendingContext.close();
    }

    const { error: historyError } = await admin
      .from("groups")
      .update({ event_date: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10) })
      .eq("id", groupId);
    expect(historyError).toBeNull();
    await page.goto("/history");
    await expect(page.getByText("For Ribbon Keeper", { exact: true })).toBeVisible();

    const emailAlias = other.email.split("@")[0].slice(0, 30);
    const { error: unsafeAliasError } = await admin.from("group_members")
      .update({ nickname: emailAlias }).eq("group_id", groupId).eq("user_id", other.id);
    expect(unsafeAliasError).toBeNull();
    const unsafeGiftPrep = await page.request.post("/api/assignments/gift-prep", giftPrepRequest);
    expect(unsafeGiftPrep.ok()).toBeTruthy();
    expect(await unsafeGiftPrep.json()).toEqual({
      rows: [expect.objectContaining({ group_id: groupId, receiver_nickname: null })],
    });
    expect(await unsafeGiftPrep.text()).not.toContain(emailAlias);

    const { error: membershipError } = await admin.from("group_members")
      .update({ status: "declined" }).eq("group_id", groupId).eq("user_id", member.id);
    expect(membershipError).toBeNull();
    const staleGiftPrep = await page.request.post("/api/assignments/gift-prep", giftPrepRequest);
    expect(staleGiftPrep.ok()).toBeTruthy();
    expect(await staleGiftPrep.json()).toEqual({ rows: [] });
  } finally {
    if (groupId) {
      await admin.from("groups").delete().eq("id", groupId).eq("owner_id", userIds[0]);
    }
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
  }
});
