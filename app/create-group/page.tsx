"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");

    // Keep the browser responsive with basic validation, then let the server
    // action repeat the same checks before any privileged write happens.
    const cleanName = sanitize(groupName, 100);
    const cleanDesc = sanitize(description, 300);
    const cleanBudget = Math.min(Math.max(Math.floor(budget || 0), 0), 100000);

    if (!cleanName) {
      setErrorMsg("Group name is required.");
      setLoading(false);
      return;
    }

    if (!eventDate) {
      setErrorMsg("Event date is required.");
      setLoading(false);
      return;
    }

    if (new Date(eventDate) < new Date(new Date().toDateString())) {
      setErrorMsg("Event date can't be in the past.");
      setLoading(false);
      return;
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

    router.push("/dashboard");
  };

  const currencySymbol = CURRENCIES.find((item) => item.code === currency)?.symbol || "$";

  return (
    <main
      className="min-h-screen flex items-center justify-center relative"
      style={{
        background: "linear-gradient(180deg,#eef4fb,#dce8f5,#e8dce0)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka:wght@500;600;700&display=swap');`}</style>
      <div className="absolute inset-0 bg-[url('/snowflakes.png')] opacity-20 z-0" />

      <div
        className="relative z-10 w-full max-w-lg p-8 rounded-[20px] shadow-xl"
        style={{
          background: "rgba(255,255,255,.75)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,.6)",
        }}
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-1.5 text-sm font-bold mb-4 px-3 py-1.5 rounded-lg transition"
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
          className="text-[26px] font-bold text-center mb-6"
          style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a6b2a" }}
        >
          Create Your Secret Santa Group
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="text-[13px] font-extrabold mb-1.5 block"
              style={{ color: "#374151" }}
            >
              Group Name *
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
              Description / Rules{" "}
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
              Event Date *
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
              Gift Budget
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
              <div className="flex items-center gap-2 mt-2">
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
                  className="w-32 px-3 py-2 rounded-lg text-[14px] outline-none"
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
              Invite Members{" "}
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
              Separate multiple emails with commas
            </p>
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
            {loading ? "Creating Group..." : "Create Group"}
          </button>
        </form>
      </div>
    </main>
  );
}
