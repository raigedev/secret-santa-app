"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  sanitizeGroupNickname,
  validateAnonymousGroupNickname,
} from "@/lib/groups/nickname";
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
  return input.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
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

  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6"
      style={{
        background: "linear-gradient(180deg,#eef4fb,#dce8f5,#e8dce0)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div className="absolute inset-0 z-0 bg-[url('/snowflakes.svg')] bg-size-[320px_320px] bg-repeat opacity-20" />

      <div
        className="relative z-10 w-full max-w-lg rounded-[20px] p-6 shadow-xl sm:p-8"
        style={{
          background: "rgba(255,255,255,.75)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,.6)",
        }}
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition sm:w-auto"
          style={{
            color: "#4a6fa5",
            background: "rgba(255,255,255,.6)",
            border: "1px solid rgba(74,111,165,.15)",
            fontFamily: "inherit",
          }}
        >
          {"<-"} Back
        </button>

        <h1
          className="mb-6 text-center text-[22px] font-bold leading-tight sm:text-[26px]"
          style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a6b2a" }}
        >
          Create a Secret Santa Group
        </h1>

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
              placeholder="e.g. Budget is $25. No re-gifts!"
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
              Members will see this budget when they join
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
            className="w-full py-3.5 rounded-xl text-[16px] font-extrabold text-white transition"
            style={{
              background: loading ? "#9ca3af" : "linear-gradient(135deg,#1a6b2a,#22c55e)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: loading ? "none" : "0 4px 16px rgba(26,107,42,.25)",
            }}
          >
            {loading ? "Creating group..." : "Create Group"}
          </button>
        </form>
      </div>
    </main>
  );
}
