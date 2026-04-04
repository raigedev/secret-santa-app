import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AffiliateClickRow = {
  id: string;
  catalog_source: string | null;
  created_at: string;
  fit_label: string | null;
  merchant: string;
  resolution_mode: string | null;
  search_query: string;
  suggestion_title: string;
  tracking_label: string | null;
  user_id: string | null;
};

type ProfileRow = {
  display_name: string | null;
  user_id: string;
};

type AffiliateConversionRow = {
  affiliate_click_id: string | null;
  id: string;
  amount: number | string | null;
  click_token: string | null;
  conversion_status: string | null;
  payout: number | string | null;
  received_at: string;
};

type AffiliatePerformanceRow = {
  affiliate_click_id: string;
  affiliate_conversion_id: string | null;
  amount: number | string | null;
  actor_label: string;
  catalog_source: string | null;
  clicked_at: string;
  conversion_status: string | null;
  converted_at: string | null;
  currency: string | null;
  fit_label: string | null;
  merchant: string;
  payout: number | string | null;
  resolution_mode: string | null;
  search_query: string;
  suggestion_title: string;
  tracking_label: string | null;
};

function parseNumericValue(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatPesoAmount(value: number): string {
  return `P ${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not converted yet";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-PH", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function summarizeSearchQuery(value: string): string {
  const firstPart = value.split(" | ")[0] || value;
  return firstPart.length > 70 ? `${firstPart.slice(0, 67)}...` : firstPart;
}

function buildActorLabel(userId: string | null, profilesByUserId: Map<string, ProfileRow>): string {
  if (!userId) {
    return "Unknown user";
  }

  const profile = profilesByUserId.get(userId);
  const displayName = profile?.display_name?.trim();

  if (displayName) {
    return displayName;
  }

  return `User ${userId.slice(0, 8)}`;
}

function buildPerformanceRows(
  clicks: AffiliateClickRow[],
  conversions: AffiliateConversionRow[],
  profilesByUserId: Map<string, ProfileRow>
): AffiliatePerformanceRow[] {
  const conversionsByClickId = new Map<string, AffiliateConversionRow>();

  for (const conversion of conversions) {
    if (!conversion.affiliate_click_id) {
      continue;
    }

    const existing = conversionsByClickId.get(conversion.affiliate_click_id);

    if (!existing || new Date(conversion.received_at).getTime() > new Date(existing.received_at).getTime()) {
      conversionsByClickId.set(conversion.affiliate_click_id, conversion);
    }
  }

  return clicks.map((click) => {
    const matchingConversion = conversionsByClickId.get(click.id) || null;

    return {
      affiliate_click_id: click.id,
      affiliate_conversion_id: matchingConversion?.id || null,
      amount: matchingConversion?.amount || null,
      actor_label: buildActorLabel(click.user_id, profilesByUserId),
      catalog_source: click.catalog_source,
      clicked_at: click.created_at,
      conversion_status: matchingConversion?.conversion_status || null,
      converted_at: matchingConversion?.received_at || null,
      currency: "PHP",
      fit_label: click.fit_label,
      merchant: click.merchant,
      payout: matchingConversion?.payout || null,
      resolution_mode: click.resolution_mode,
      search_query: click.search_query,
      suggestion_title: click.suggestion_title,
      tracking_label: click.tracking_label,
    };
  });
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </section>
  );
}

export default async function AffiliateReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowedEmails = (
    process.env.AFFILIATE_REPORT_ALLOWED_EMAILS ||
    process.env.AFFILIATE_REPORT_OWNER_EMAIL ||
    ""
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (
    allowedEmails.length === 0 ||
    !user.email ||
    !allowedEmails.includes(user.email.toLowerCase())
  ) {
    redirect("/dashboard");
  }

  const [
    { count: totalClicksCount, error: totalClicksError },
    { count: totalSearchClicksCount, error: totalSearchClicksError },
    { count: totalDirectClicksCount, error: totalDirectClicksError },
    { count: totalConversionsCount, error: totalConversionsError },
    { data: clicks, error: clicksError },
  ] = await Promise.all([
    supabaseAdmin
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("merchant", "lazada"),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("merchant", "lazada")
      .eq("catalog_source", "search-backed"),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("merchant", "lazada")
      .in("catalog_source", ["catalog-product", "wishlist-product"]),
    supabaseAdmin
      .from("affiliate_conversions")
      .select("*", { count: "exact", head: true })
      .eq("merchant", "lazada"),
    supabaseAdmin
      .from("affiliate_clicks")
      .select(
        "id, catalog_source, created_at, fit_label, merchant, resolution_mode, search_query, suggestion_title, tracking_label, user_id"
      )
      .eq("merchant", "lazada")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  if (
    totalClicksError ||
    totalSearchClicksError ||
    totalDirectClicksError ||
    totalConversionsError ||
    clicksError
  ) {
    throw new Error("Failed to load affiliate clicks.");
  }

  const clickRows = (clicks || []) as AffiliateClickRow[];
  const clickIds = clickRows.map((row) => row.id);
  const uniqueUserIds = Array.from(
    new Set(clickRows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
  );

  let profilesByUserId = new Map<string, ProfileRow>();

  if (uniqueUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", uniqueUserIds);

    if (profilesError) {
      throw new Error("Failed to load affiliate user profiles.");
    }

    profilesByUserId = new Map(
      ((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile])
    );
  }

  let conversionRows: AffiliateConversionRow[] = [];

  if (clickIds.length > 0) {
    const { data: conversions, error: conversionsError } = await supabaseAdmin
      .from("affiliate_conversions")
      .select("id, affiliate_click_id, amount, click_token, conversion_status, payout, received_at")
      .in("affiliate_click_id", clickIds)
      .order("received_at", { ascending: false })
      .limit(250);

    if (conversionsError) {
      throw new Error("Failed to load affiliate conversions.");
    }

    conversionRows = (conversions || []) as AffiliateConversionRow[];
  }

  const reportRows = buildPerformanceRows(clickRows, conversionRows, profilesByUserId).slice(0, 50);

  const totalClicks = totalClicksCount || 0;
  const totalSearchClicks = totalSearchClicksCount || 0;
  const totalDirectClicks = totalDirectClicksCount || 0;
  const totalConversions = totalConversionsCount || 0;
  const totalSales = conversionRows.reduce((sum, row) => sum + parseNumericValue(row.amount), 0);
  const totalPayout = conversionRows.reduce((sum, row) => sum + parseNumericValue(row.payout), 0);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#edf6ff_0%,#f8fbff_45%,#eef5ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600">
              Affiliate Performance
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Lazada affiliate report
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              This owner-only page combines tracked Lazada affiliate clicks and mapped conversions
              across your app so you can see what users clicked, what converted, and which paths
              are actually working.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_18px_50px_rgba(148,163,184,0.14)] transition hover:-translate-y-0.5"
            >
              Back to dashboard
            </Link>
            <Link
              href="/secret-santa"
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2f80ff,#1f66e5)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5"
            >
              Open shopping flow
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Total clicks"
            value={String(totalClicks)}
            helper="All tracked Lazada affiliate clicks across your app."
          />
          <SummaryCard
            label="Direct clicks"
            value={String(totalDirectClicks)}
            helper="App-wide clicks that opened a direct Lazada product or wishlist product route."
          />
          <SummaryCard
            label="Search clicks"
            value={String(totalSearchClicks)}
            helper="App-wide tracked search-backed Lazada clicks that open broader catalog or tag routes."
          />
          <SummaryCard
            label="Conversions"
            value={String(totalConversions)}
            helper="All stored Lazada postback events currently tracked in the system."
          />
          <SummaryCard
            label="Recent payout"
            value={formatPesoAmount(totalPayout)}
            helper={`From the latest tracked conversions loaded below. Recent tested sale amount: ${formatPesoAmount(totalSales)}.`}
          />
        </section>

        <section className="mt-8 rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_70px_rgba(148,163,184,0.14)] backdrop-blur-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Latest activity
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">
                Clicks and conversions
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              The Supabase view name is <span className="font-semibold text-slate-700">affiliate_performance</span>.
            </p>
          </div>

          {reportRows.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center text-sm font-medium text-slate-500">
              No affiliate clicks or conversions yet. Click a Lazada card first, then check back here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Suggestion</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Resolution</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Payout</th>
                    <th className="px-3 py-2">Clicked</th>
                    <th className="px-3 py-2">Converted</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row) => (
                    <tr
                      key={`${row.affiliate_click_id}-${row.affiliate_conversion_id || "pending"}`}
                      className="rounded-[22px] bg-slate-50/80 text-sm text-slate-700 shadow-[0_10px_25px_rgba(148,163,184,0.08)]"
                    >
                      <td className="rounded-l-[22px] px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">{row.actor_label}</div>
                        <div className="mt-1 text-xs text-slate-500">Owner-only visibility</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-900">{row.suggestion_title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {summarizeSearchQuery(row.search_query)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-800">
                          {row.fit_label || row.tracking_label || "Affiliate click"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.catalog_source || "unknown"}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-semibold text-slate-800">
                          {row.resolution_mode || "pending"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.merchant.toUpperCase()}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            row.affiliate_conversion_id
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.conversion_status || (row.affiliate_conversion_id ? "tracked" : "clicked")}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-slate-900">
                        {row.amount !== null ? formatPesoAmount(parseNumericValue(row.amount)) : "—"}
                      </td>
                      <td className="px-3 py-3 align-top font-semibold text-slate-900">
                        {row.payout !== null ? formatPesoAmount(parseNumericValue(row.payout)) : "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        {formatDateTime(row.clicked_at)}
                      </td>
                      <td className="rounded-r-[22px] px-3 py-3 align-top text-xs text-slate-500">
                        {formatDateTime(row.converted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
