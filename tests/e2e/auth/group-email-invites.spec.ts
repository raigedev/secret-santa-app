import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { parseGroupInviteEmails } from "../../../lib/groups/invite-addresses";
import { loginWithTestCredentials } from "../helpers/auth";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

test("group invite email lists normalize, deduplicate, and reject invalid submissions", () => {
  expect(parseGroupInviteEmails(" ONE@example.com, two@example.com , one@EXAMPLE.com ")).toEqual({
    addresses: ["one@example.com", "two@example.com"], error: null,
  });
  expect(parseGroupInviteEmails(" ")).toMatchObject({ addresses: [], error: expect.any(String) });
  expect(parseGroupInviteEmails("one@example.com, not-an-email")).toMatchObject({ addresses: [], error: expect.any(String) });
  expect(parseGroupInviteEmails("one@example.com;two@example.com")).toMatchObject({ addresses: [], error: expect.any(String) });
  expect(parseGroupInviteEmails(Array.from({ length: 6 }, (_, i) => `member${i}@example.com`).join(",")))
    .toMatchObject({ addresses: [], error: "Enter up to 5 email addresses at a time." });
});

test("the group invite form saves multiple addresses and preserves quota on rejection", async ({
  page, baseURL,
}, testInfo) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(
    process.env.PLAYWRIGHT_LOCAL_FIXTURES !== "1" ||
      !baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname) ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== LOCAL_SUPABASE_URL || !key || Boolean(process.env.SMTP_HOST),
    "Only runs against local Supabase without external SMTP.",
  );
  test.setTimeout(90_000);

  const admin = createClient(LOCAL_SUPABASE_URL, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tag = randomUUID().slice(0, 8);
  const password = randomUUID();
  const accounts = ["host", "one", "two", "three", "four"].map((role) => ({
    email: `group-invite-${role}-${tag}@example.com`, password,
  }));
  const users: string[] = [];
  let groupId: string | undefined;
  try {
    for (const account of accounts) {
      const { data, error } = await admin.auth.admin.createUser({ ...account, email_confirm: true });
      expect(error).toBeNull();
      users.push(data.user!.id);
    }
    const [host, first, second, third, fourth] = accounts;
    const group = await admin.from("groups").insert({
      owner_id: users[0],
      name: "Group email invitations",
      event_date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      event_timezone: "UTC",
    }).select("id").single();
    expect(group.error).toBeNull();
    groupId = group.data!.id as string;
    const hostMembership = await admin.from("group_members").insert({
      group_id: groupId, user_id: users[0], email: host.email, status: "accepted", role: "owner",
    });
    expect(hostMembership.error).toBeNull();

    await loginWithTestCredentials(page, host);
    await page.goto(`/group/${groupId}`);
    const emails = page.getByRole("textbox", { name: "Member email addresses" });
    await expect(emails).toHaveAccessibleDescription("Separate email addresses with commas.");
    await emails.fill(`${first.email}, ${second.email}, ${first.email.toUpperCase()}, ${host.email}`);
    const invite = page.getByRole("button", { name: "Invite", exact: true });
    await invite.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("group-invite-emails.png") });
    await invite.click();
    await expect(page.getByText(/2 invitations saved\./)).toBeVisible();
    await expect(emails).toHaveValue("");

    const saved = await admin.from("group_members").select("email, status").eq("group_id", groupId);
    expect(saved.error).toBeNull();
    expect(saved.data).toHaveLength(3);
    expect(saved.data).toEqual(expect.arrayContaining([
      { email: first.email, status: "pending" },
      { email: second.email, status: "pending" },
    ]));

    await emails.fill(`${first.email}, ${second.email}`);
    await invite.click();
    await expect(page.getByText(/no new invitations/i)).toBeVisible();
    await expect.poll(async () => (await emails.inputValue()).split(",").map((email) => email.trim()))
      .toEqual([first.email, second.email]);
    const afterRetry = await admin.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId);
    expect(afterRetry.count).toBe(3);

    // Two submissions of two addresses used four attempts. Set up exactly two remaining.
    const usage = await admin.from("security_rate_limits").insert(
      Array.from({ length: 9 }, () => ({ action: "group.invite_user", subject: `${users[0]}:${groupId}` })),
    );
    expect(usage.error).toBeNull();
    await emails.fill(`${third.email}, ${fourth.email}, extra-${tag}@example.com`);
    await invite.click();
    await expect(page.getByRole("alert").filter({ hasText: "You can send 2 more invites right now." })).toBeVisible();
    const afterRejection = await admin.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId);
    expect(afterRejection.count).toBe(3);

    await emails.fill(`${third.email}, ${fourth.email}`);
    await invite.click();
    await expect(page.getByText(/2 invitations saved\./)).toBeVisible();
    const quota = await admin.from("security_rate_limits").select("id", { count: "exact", head: true })
      .eq("action", "group.invite_user").eq("subject", `${users[0]}:${groupId}`);
    expect(quota.count).toBe(15);
  } finally {
    if (groupId) {
      await admin.from("security_rate_limits").delete().eq("action", "group.invite_user").eq("subject", `${users[0]}:${groupId}`);
      await admin.from("groups").delete().eq("id", groupId);
    }
    for (const userId of users) await admin.auth.admin.deleteUser(userId);
  }
});
