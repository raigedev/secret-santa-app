import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { validateRevealName } from "../../../lib/groups/reveal-name";
import { loginWithTestCredentials } from "../helpers/auth";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

test("reveal names accept ordinary names but not empty values or email addresses", () => {
  expect(validateRevealName("  Ana   Reyes ")).toEqual({ name: "Ana Reyes", error: null });
  expect(validateRevealName(" ")).toMatchObject({ name: null });
  expect(validateRevealName("ana@example.com")).toMatchObject({ name: null });
  expect(validateRevealName({ name: "Ana" })).toMatchObject({ name: null });
});

async function openRevealAndReadPayload(page: Page, path: string) {
  const payloads: string[] = [];
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.text();
    if (response.ok() && body.includes('"aliasEntries"')) payloads.push(body);
    await route.fulfill({ response });
  });

  try {
    await page.goto(path);
    await expect.poll(() => payloads.length).toBeGreaterThan(0);
    return payloads[0];
  } finally {
    await page.unroute(`**${path}`);
  }
}

test("alias exchanges collect a private name from the organizer and both invite paths", async ({
  page, browser, baseURL,
}, testInfo) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(
    process.env.PLAYWRIGHT_LOCAL_FIXTURES !== "1" ||
      !baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname) ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL ||
      !serviceKey || !anonKey,
    "Writes disposable fixtures to local Supabase only.",
  );
  test.setTimeout(120_000);

  const auth = { persistSession: false, autoRefreshToken: false };
  const admin = createClient(LOCAL_SUPABASE_URL, serviceKey!, { auth });
  const tag = randomUUID();
  const name = `Reveal name test ${tag.slice(0, 8)}`;
  const accounts: Array<{ id: string; email: string; password: string }> = [];
  const guest = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined });
  const guestPage = await guest.newPage();
  let groupId: string | undefined;

  try {
    for (const role of ["host", "email", "link"]) {
      const email = `reveal-${role}-${tag}@example.com`;
      const password = randomUUID();
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(error).toBeNull();
      accounts.push({ id: data.user!.id, email, password });
    }
    const [host, emailGuest, linkGuest] = accounts;
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await loginWithTestCredentials(page, host);
    await page.goto("/create-group");
    await page.getByPlaceholder("e.g. Office Holiday Party").fill(name);
    await page.locator("#group-event-date").fill(future);
    await page.getByRole("button", { name: "Use Secret Santa aliases" }).click();
    const revealNameField = page.getByRole("textbox", { name: "Your name for the reveal" });
    await expect(revealNameField).toHaveAccessibleDescription(/real name.*private until the reveal/);
    await page.getByRole("textbox", { name: "Your Secret Santa alias" }).fill("Ribbon Keeper");
    await page.getByRole("button", { name: "Create exchange" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter your name for the reveal." })).toBeVisible();
    await revealNameField.fill("Robin Reyes");
    await revealNameField.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("create-exchange-reveal-name.png") });
    await page.getByRole("button", { name: "Create exchange" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const group = await admin.from("groups").select("id").eq("owner_id", host.id).eq("name", name).single();
    expect(group.error).toBeNull();
    groupId = group.data!.id as string;
    const pending = await admin.from("group_members").insert({
      group_id: groupId, user_id: emailGuest.id, email: emailGuest.email, role: "member", status: "pending",
    });
    expect(pending.error).toBeNull();

    await loginWithTestCredentials(guestPage, emailGuest);
    await guestPage.goto("/groups");
    const invitations = guestPage.getByRole("region", { name: "Pending invitations" });
    await invitations.getByRole("textbox", { name: "Your name for the reveal" }).fill("Ana Reyes");
    await invitations.getByRole("textbox", { name: "Secret Santa alias" }).fill("Snow Ribbon");
    await invitations.getByRole("button", { name: "Accept invite" }).click();
    await expect(invitations.getByRole("heading", { name })).toHaveCount(0);

    await guest.clearCookies();
    await loginWithTestCredentials(guestPage, linkGuest);
    const token = randomUUID().replaceAll("-", "");
    const invite = await admin.from("group_invite_links").insert({
      group_id: groupId,
      token_hash: createHash("sha256").update(token).digest("hex"),
      created_by: host.id,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(invite.error).toBeNull();
    await guestPage.goto(`/invite/${token}`);
    await guestPage.getByRole("textbox", { name: "Your name for the reveal" }).fill("Jamie Cruz");
    await guestPage.getByRole("textbox", { name: "Secret Santa alias" }).fill("Winter Star");
    await guestPage.getByRole("button", { name: "Join Group" }).click();
    await expect(guestPage).toHaveURL(new URL(`/group/${groupId}`, baseURL).href);

    const memberData = await admin.from("group_members").select("nickname, reveal_name").eq("group_id", groupId);
    expect(memberData.error).toBeNull();
    expect(memberData.data).toEqual(expect.arrayContaining([
      { nickname: "Ribbon Keeper", reveal_name: "Robin Reyes" },
      { nickname: "Snow Ribbon", reveal_name: "Ana Reyes" },
      { nickname: "Winter Star", reveal_name: "Jamie Cruz" },
    ]));

    const client = createClient(LOCAL_SUPABASE_URL, anonKey!, { auth });
    expect((await client.auth.signInWithPassword(linkGuest)).error).toBeNull();
    const privateColumn = await client.from("group_members").select("reveal_name").eq("group_id", groupId);
    expect(privateColumn.error?.code).toBe("42501");
    const readableColumns = await client.from("group_members").select("nickname").eq("group_id", groupId);
    expect(readableColumns.error).toBeNull();

    const draw = await admin.from("assignments").insert([
      { group_id: groupId, giver_id: host.id, receiver_id: emailGuest.id },
      { group_id: groupId, giver_id: emailGuest.id, receiver_id: linkGuest.id },
      { group_id: groupId, giver_id: linkGuest.id, receiver_id: host.id },
    ]);
    expect(draw.error).toBeNull();
    const path = `/group/${groupId}/reveal`;
    for (const viewer of [page, guestPage]) {
      const payload = await openRevealAndReadPayload(viewer, path);
      expect(payload).toContain('"realName":null');
      expect(payload).toContain("Ribbon Keeper");
      for (const row of memberData.data!) expect(payload).not.toContain(row.reveal_name);
    }

    const today = new Date().toISOString().slice(0, 10);
    const publish = await admin.from("groups").update({
      event_date: today, event_timezone: "UTC", revealed: true, revealed_at: new Date().toISOString(),
    }).eq("id", groupId);
    expect(publish.error).toBeNull();

    await guestPage.goto("/groups");
    const payload = await openRevealAndReadPayload(guestPage, path);
    for (const row of memberData.data!) expect(payload).toContain(`"realName":"${row.reveal_name}"`);
    await expect(guestPage.getByText("Robin Reyes", { exact: true }).first()).toBeVisible();
  } finally {
    await guest.close();
    if (groupId) await admin.from("groups").delete().eq("id", groupId);
    for (const account of accounts) await admin.auth.admin.deleteUser(account.id);
  }
});
