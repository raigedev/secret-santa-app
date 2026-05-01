"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  sanitizeGroupNickname,
  validateAnonymousGroupNickname,
} from "@/lib/groups/nickname";
import { sanitizePlainText } from "@/lib/validation/common";
import { createGroupWithInvites } from "./actions";

const BUDGET_OPTIONS = [10, 15, 25, 50, 100];
const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD - US Dollar" },
  { code: "EUR", symbol: "EUR", label: "EUR - Euro" },
  { code: "GBP", symbol: "GBP", label: "GBP - British Pound" },
  { code: "PHP", symbol: "PHP", label: "PHP - Philippine Peso" },
  { code: "JPY", symbol: "JPY", label: "JPY - Japanese Yen" },
  { code: "AUD", symbol: "AUD", label: "AUD - Australian Dollar" },
  { code: "CAD", symbol: "CAD", label: "CAD - Canadian Dollar" },
];

function sanitize(input: string, max: number): string {
  return sanitizePlainText(input, max);
}

function getInviteEmailCount(value: string): number {
  return value
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && email.includes("@")).length;
}

function ChecklistMark({ done }: { done: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-black ${
        done
          ? "border-[#48664e]/20 bg-[#48664e] text-white"
          : "border-[rgba(72,102,78,.18)] bg-white text-slate-400"
      }`}
      aria-hidden="true"
    >
      {done && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
          <path
            d="m3.5 8.2 3 3 6-6.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      )}
    </span>
  );
}

export default function CreateGroupPage() {
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [budget, setBudget] = useState(25);
  const [currency, setCurrency] = useState("USD");
  const [customBudget, setCustomBudget] = useState(false);
  const [requireAnonymousNickname, setRequireAnonymousNickname] = useState(false);
  const [ownerCodename, setOwnerCodename] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");

    // Run the fast checks in the browser for instant feedback, then let the
    // server action repeat them before any database write happens.
    const cleanName = sanitize(groupName, 100);
    const cleanDesc = sanitize(description, 300);
    const cleanBudget = Math.min(Math.max(Math.floor(budget || 0), 0), 100000);
    const cleanOwnerCodename = sanitizeGroupNickname(ownerCodename);

    if (!cleanName) {
      setErrorMsg("Enter a group name.");
      setLoading(false);
      return;
    }

    if (!eventDate) {
      setErrorMsg("Choose a gift exchange date.");
      setLoading(false);
      return;
    }

    if (new Date(eventDate) < new Date(new Date().toDateString())) {
      setErrorMsg("Event date can't be in the past.");
      setLoading(false);
      return;
    }

    if (requireAnonymousNickname) {
      const codenameMessage = validateAnonymousGroupNickname({
        nickname: cleanOwnerCodename,
      });

      if (codenameMessage) {
        setErrorMsg(codenameMessage);
        setLoading(false);
        return;
      }
    }

    const emailList = inviteEmails
      .split(",")
      .map((email) => sanitize(email, 100).toLowerCase())
      .filter((email) => email.length > 0 && email.includes("@"));

    const result = await createGroupWithInvites({
      name: cleanName,
      description: cleanDesc,
      eventDate,
      inviteEmails: emailList,
      budget: cleanBudget,
      currency,
      requireAnonymousNickname,
      ownerCodename: cleanOwnerCodename,
    });

    if (!result.success) {
      setErrorMsg(result.message);
      setLoading(false);
      return;
    }

    if (result.message !== "Group created!") {
      setStatusMsg(result.message);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    window.location.assign("/dashboard");
  };

  const currencySymbol = CURRENCIES.find((item) => item.code === currency)?.symbol || "$";
  const inviteEmailCount = getInviteEmailCount(inviteEmails);
  return (
    <main
      className="relative min-h-screen px-4 py-8 sm:px-6 lg:py-12"
      style={{
        background:
          "repeating-linear-gradient(135deg,rgba(72,102,78,.055) 0 1px,transparent 1px 34px), linear-gradient(180deg,#fffdf8 0%,#f8fbff 48%,#eef6ee 100%)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div className="absolute inset-0 z-0 bg-[url('/snowflakes.svg')] bg-size-[320px_320px] bg-repeat opacity-20" />

      <div className="relative z-10 mx-auto mb-5 flex w-full max-w-6xl flex-col gap-4 rounded-[28px] bg-white/82 px-5 py-4 shadow-[0_18px_44px_rgba(46,52,50,.06)]">
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#48664e] transition hover:-translate-y-0.5"
          style={{ fontFamily: "inherit" }}
        >
          Back
        </button>
        <div>
          <h1
            className="text-[28px] font-black leading-tight text-[#2e3432]"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            Create Group
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-slate-600">
            Set up your Secret Santa exchange in a few simple steps.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {([
            ["1", "Basics", groupName.trim().length > 0],
            ["2", "Budget", true],
            ["3", "Privacy", requireAnonymousNickname],
            ["4", "Invites", inviteEmailCount > 0],
            ["5", "Review", groupName.trim().length > 0 && eventDate.length > 0],
          ] as Array<[string, string, boolean]>).map(([step, label, done]) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black"
                style={{
                  background: done ? "#48664e" : "#ffffff",
                  border: "1px solid rgba(72,102,78,.16)",
                  color: done ? "#ffffff" : "#2e3432",
                }}
              >
                {step}
              </span>
              <span className="text-xs font-black text-[#2e3432]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.78fr)] lg:items-start">
        <aside
          className="rounded-[30px] p-6 shadow-[0_22px_54px_rgba(46,52,50,.07)] lg:sticky lg:top-8 lg:order-2"
          style={{
            background: "linear-gradient(135deg,rgba(255,255,255,.94),rgba(239,247,241,.9))",
            border: "1px solid rgba(72,102,78,.16)",
          }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#48664e]">
            Exchange preview
          </p>
          <h1
            className="mt-8 text-center text-[30px] font-black leading-tight text-[#48664e]"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            {groupName.trim() || "My Office Secret Santa"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-[13px] font-semibold leading-6 text-slate-600">
            {description.trim() || "A little joy, a lot of surprises."}
          </p>

          <div className="mx-auto mt-6 grid h-32 w-32 place-items-center rounded-[34px] bg-[#fff4df] text-[#48664e]">
            <ChecklistMark done />
          </div>

          <div className="mt-8 space-y-4 border-t border-[rgba(72,102,78,.12)] pt-5">
            {[
              ["Gift date", eventDate ? new Date(eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Choose date"],
              ["Group budget", `${currencySymbol}${budget || 0} per person`],
              ["Members", `${inviteEmailCount} invited`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 text-sm">
                <span className="font-bold text-[#64748b]">{label}</span>
                <span className="font-black text-[#2e3432]">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[18px] bg-[#eef3ef] px-4 py-3 text-xs font-bold leading-5 text-[#48664e]">
            Privacy and invite settings can be changed later.
          </div>
        </aside>

        <section
          className="rounded-[28px] p-6 shadow-[0_22px_54px_rgba(46,52,50,.07)] sm:p-8 lg:order-1"
          style={{
            background: "rgba(255,255,255,.84)",
            border: "1px solid rgba(72,102,78,.14)",
          }}
        >
        <button
          onClick={() => router.push("/dashboard")}
          className="hidden"
          style={{
            color: "#48664e",
            background: "rgba(255,255,255,.74)",
            border: "1px solid rgba(72,102,78,.14)",
            fontFamily: "inherit",
          }}
        >
          Back to dashboard
        </button>

        <h2
          className="mb-2 text-[24px] font-black leading-tight sm:text-[28px]"
          style={{ fontFamily: "'Fredoka', sans-serif", color: "#48664e" }}
        >
          Set your budget
        </h2>
        <p className="mb-6 text-[13px] font-semibold leading-6 text-slate-600">
          Add the key details about your exchange budget.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="text-[13px] font-extrabold mb-1.5 block"
              style={{ color: "#374151" }}
            >
              Group name *
            </label>
            <input
              type="text"
              placeholder="e.g. Office Holiday Party"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              required
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition"
              style={{
                border: "2px solid #e5e7eb",
                fontFamily: "inherit",
                color: "#1f2937",
              }}
            />
          </div>

          <div>
            <label
              className="text-[13px] font-extrabold mb-1.5 block"
              style={{ color: "#374151" }}
            >
              Group notes or rules{" "}
              <span className="text-[11px] font-semibold" style={{ color: "#9ca3af" }}>
                (optional)
              </span>
            </label>
            <textarea
              placeholder="e.g. Budget is $25. Gift cards are welcome."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition resize-y"
              style={{
                border: "2px solid #e5e7eb",
                fontFamily: "inherit",
                color: "#1f2937",
                minHeight: "70px",
              }}
            />
          </div>

          <div>
            <label
              className="text-[13px] font-extrabold mb-1.5 block"
              style={{ color: "#374151" }}
            >
              Gift exchange date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition"
              style={{
                border: "2px solid #e5e7eb",
                fontFamily: "inherit",
                color: "#1f2937",
              }}
            />
          </div>

          <div
            className="rounded-xl p-4"
            style={{
              background: "rgba(192,57,43,.04)",
              border: "1px solid rgba(192,57,43,.1)",
            }}
          >
            <label
              className="text-[13px] font-extrabold mb-2 block"
              style={{ color: "#c0392b" }}
            >
              Gift budget
            </label>
            <div className="flex gap-2 flex-wrap">
              {BUDGET_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setBudget(amount);
                    setCustomBudget(false);
                  }}
                  className="px-4 py-2 rounded-[10px] text-[13px] font-bold transition"
                  style={{
                    border: `2px solid ${
                      !customBudget && budget === amount ? "#c0392b" : "#e5e7eb"
                    }`,
                    background: !customBudget && budget === amount ? "#fef2f2" : "#fff",
                    color: !customBudget && budget === amount ? "#c0392b" : "#6b7280",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {currencySymbol}
                  {amount}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomBudget(true)}
                className="px-4 py-2 rounded-[10px] text-[13px] font-bold transition"
                style={{
                  border: `2px solid ${customBudget ? "#c0392b" : "#e5e7eb"}`,
                  background: customBudget ? "#fef2f2" : "#fff",
                  color: customBudget ? "#c0392b" : "#6b7280",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderStyle: customBudget ? "solid" : "dashed",
                }}
              >
                Custom
              </button>
            </div>
            {customBudget && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-[14px] font-bold" style={{ color: "#c0392b" }}>
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value, 10) || 0)}
                  min={0}
                  max={100000}
                  placeholder="Enter amount..."
                  className="w-full rounded-lg px-3 py-2 text-[14px] outline-none sm:w-32"
                  style={{
                    border: "2px solid #c0392b",
                    fontFamily: "inherit",
                    color: "#1f2937",
                  }}
                />
              </div>
            )}
            <p className="text-[11px] mt-2" style={{ color: "#9ca3af" }}>
              Members will see this budget when they join.
            </p>
          </div>

          <div>
            <label
              className="text-[13px] font-extrabold mb-1.5 block"
              style={{ color: "#374151" }}
            >
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
              style={{
                border: "2px solid #e5e7eb",
                fontFamily: "inherit",
                color: "#1f2937",
                cursor: "pointer",
                background: "#fff",
              }}
            >
              {CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.symbol} {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="text-[13px] font-extrabold mb-1.5 block"
              style={{ color: "#374151" }}
            >
              Invite members{" "}
              <span className="text-[11px] font-semibold" style={{ color: "#9ca3af" }}>
                (optional)
              </span>
            </label>
            <input
              type="text"
              placeholder="email1@example.com, email2@example.com"
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition"
              style={{
                border: "2px solid #e5e7eb",
                fontFamily: "inherit",
                color: "#1f2937",
              }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>
              Add more than one email by separating them with commas.
            </p>
          </div>

          <div
            className="rounded-xl p-4"
            style={{
              background: requireAnonymousNickname
                ? "rgba(37,99,235,.08)"
                : "rgba(15,23,42,.03)",
              border: requireAnonymousNickname
                ? "1px solid rgba(37,99,235,.18)"
                : "1px solid rgba(148,163,184,.16)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <label
                  className="text-[13px] font-extrabold block"
                  style={{ color: "#1f2937" }}
                >
                  Use nicknames in this group
                </label>
                <p className="mt-1 text-[12px] leading-5" style={{ color: "#64748b" }}>
                  Everyone in the event, including you as the organizer, joins with a
                  nickname so members do not see real names or emails inside this group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequireAnonymousNickname((current) => !current)}
                aria-pressed={requireAnonymousNickname}
                className="inline-flex shrink-0 items-center rounded-full p-1 transition"
                style={{
                  background: requireAnonymousNickname ? "#2563eb" : "#cbd5e1",
                  width: "52px",
                }}
              >
                <span
                  className="block h-5 w-5 rounded-full bg-white shadow-sm transition"
                  style={{
                    transform: requireAnonymousNickname ? "translateX(24px)" : "translateX(0)",
                  }}
                />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold"
                style={{
                  background: requireAnonymousNickname ? "#dbeafe" : "#e2e8f0",
                  color: requireAnonymousNickname ? "#1d4ed8" : "#475569",
                }}
              >
                {requireAnonymousNickname ? "Nicknames required" : "Names visible"}
              </span>
              <span
                className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold"
                style={{ background: "#ffffff", color: "#64748b", border: "1px solid rgba(148,163,184,.16)" }}
              >
                Members can still change it later
              </span>
            </div>

            {requireAnonymousNickname && (
              <div className="mt-4">
                <label
                  className="text-[13px] font-extrabold mb-1.5 block"
                  style={{ color: "#1f2937" }}
                >
                  Your organizer nickname *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Moonlight Fox"
                  value={ownerCodename}
                  onChange={(e) => setOwnerCodename(e.target.value)}
                  maxLength={30}
                  autoComplete="off"
                  className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition"
                  style={{
                    border: "2px solid rgba(37,99,235,.16)",
                    background: "#fff",
                    fontFamily: "inherit",
                    color: "#1f2937",
                  }}
                />
                <p className="mt-1 text-[11px]" style={{ color: "#64748b" }}>
                  This is the name other members will see for you inside this group.
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="text-[13px] font-bold text-center" style={{ color: "#dc2626" }}>
              {errorMsg}
            </p>
          )}
          {statusMsg && (
            <p className="text-[13px] font-bold text-center" style={{ color: "#2563eb" }}>
              {statusMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-3.5 text-[16px] font-extrabold text-white transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
            style={{
              background: loading ? "#9ca3af" : "linear-gradient(135deg,#48664e,#3c5a43)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 16px 30px rgba(72,102,78,.2)",
            }}
          >
            {loading ? "Creating group..." : "Create group"}
          </button>
        </form>
        </section>
      </div>
    </main>
  );
}
