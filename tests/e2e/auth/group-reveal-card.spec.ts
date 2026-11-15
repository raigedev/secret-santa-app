import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginWithTestCredentials } from "../helpers/auth";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";

test("reveal replay shows one name with a separate alias only when revealed", async ({
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
  const groupId = randomUUID();
  const tag = groupId.slice(0, 8);
  const now = new Date().toISOString();
  const participants = [
    {
      email: `reveal-host-${tag}@example.com`,
      alias: "Frost Lantern",
      realName: "Alexandra Montgomery Fitzgerald",
    },
    {
      email: `reveal-member-${tag}@example.com`,
      alias: "Ribbon Keeper",
      realName: "Ribbon Keeper",
    },
  ];
  const password = randomUUID();
  const users: string[] = [];
  try {
    for (const { email } of participants) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(error).toBeNull();
      users.push(data.user!.id);
    }
    const group = await admin.from("groups").insert({
      id: groupId,
      owner_id: users[0],
      name: "Winter Gift Exchange",
      event_date: now.slice(0, 10),
      event_timezone: "UTC",
      revealed: true,
      revealed_at: now,
      require_anonymous_nickname: true,
    });
    expect(group.error).toBeNull();
    const membership = await admin.from("group_members").insert(
      participants.map(({ alias, email, realName }, index) => ({
        group_id: groupId,
        user_id: users[index],
        email,
        status: "accepted",
        role: index === 0 ? "owner" : "member",
        nickname: alias,
        reveal_name: realName,
      })),
    );
    expect(membership.error).toBeNull();
    const assignments = await admin.from("assignments").insert(
      users.map((userId, index) => ({
        group_id: groupId,
        giver_id: userId,
        receiver_id: users[1 - index],
      })),
    );
    expect(assignments.error).toBeNull();
    const session = await admin.from("group_reveal_sessions").insert({
      group_id: groupId,
      status: "published",
      current_index: 0,
      card_revealed: false,
      started_by: users[0],
      started_at: now,
      published_at: now,
    });
    expect(session.error).toBeNull();

    const [host, member] = participants;
    await loginWithTestCredentials(page, { email: host.email, password });
    await page.goto(`/group/${groupId}/reveal`);
    const stage = page.getByTestId("reveal-stage");
    const heading = stage.getByRole("heading", { level: 2 });
    await expect(heading).toHaveText(host.alias);
    await expect(stage.getByText(host.realName, { exact: true })).toHaveCount(0);
    await expect(stage.getByText("Alias", { exact: true })).toHaveCount(0);

    await stage.getByRole("button", { name: "Reveal name", exact: true }).click();
    await expect(heading).toHaveText(host.realName);
    await expect(stage.getByText(`Alias: ${host.alias}`, { exact: true })).toBeVisible();
    await expect(stage.getByText("Name", { exact: true })).toHaveCount(0);
    await expect.poll(() => heading.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
    await stage.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await stage.screenshot({ path: testInfo.outputPath("reveal-identity.png") });

    await stage.getByRole("button", { name: "Show alias again" }).click();
    await expect(heading).toHaveText(host.alias);
    await expect(stage.getByText(host.realName, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(heading).toHaveText(member.alias);
    await stage.getByRole("button", { name: "Reveal name", exact: true }).click();
    await expect(stage.getByText("Identity revealed", { exact: true })).toBeVisible();
    await expect(heading).toHaveText(member.realName);
    await expect(stage.getByText(`Alias: ${member.alias}`, { exact: true })).toHaveCount(0);

    await test.step("published match cards can align or stack without clipping long names", async () => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(`/group/${groupId}`);
      const board = page.getByTestId("revealed-match-board");
      const cards = board.getByTestId("revealed-match-card");
      await expect(cards).toHaveCount(2);
      for (const width of [320, 393]) {
        await page.setViewportSize({ width, height: 740 });
        for (const card of await cards.all()) {
          const giver = card.getByText("Giver", { exact: true });
          const receiver = card.getByText("Receiver", { exact: true });
          const connector = card.getByText("gives", { exact: true });
          await expect.poll(async () => {
            const [cardBox, giverBox, receiverBox, connectorBox] = await Promise.all([
              card.boundingBox(), giver.boundingBox(), receiver.boundingBox(), connector.boundingBox(),
            ]);
            if (!cardBox || !giverBox || !receiverBox || !connectorBox) {
              return false;
            }
            if (width === 320) {
              return giverBox.y < connectorBox.y && connectorBox.y < receiverBox.y;
            }
            const center = connectorBox.x + connectorBox.width / 2;
            return Math.abs(center - (cardBox.x + cardBox.width / 2)) <= 1
              && Math.abs(giverBox.y - receiverBox.y) <= 1;
          }).toBe(true);
          const longName = card.getByText(host.realName, { exact: true });
          await expect.poll(() => longName.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
            .toBe(true);
        }
        await board.evaluate((element) => element.scrollIntoView({ block: "center" }));
        await board.screenshot({ path: testInfo.outputPath(`mobile-revealed-matches-${width}.png`) });
      }
    });
  } finally {
    await admin.from("groups").delete().eq("id", groupId);
    for (const userId of users) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
});
