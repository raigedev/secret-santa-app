"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  sanitizeGroupNickname,
  validateAnonymousGroupNickname,
} from "@/lib/groups/nickname";
import { sanitizePlainText } from "@/lib/validation/common";
import { createGroupWithInvitesFromFormData } from "./actions";

const BUDGET_OPTIONS = [10, 15, 25, 50, 100];
const MAX_GROUP_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_GROUP_IMAGE_DECODED_SIDE = 6000;
const MAX_GROUP_IMAGE_DECODED_PIXELS = 12_000_000;
const GROUP_IMAGE_PREVIEW_SIZE = 384;
const GROUP_IMAGE_PREVIEW_MAX_PIXEL_RATIO = 2;
const ALLOWED_GROUP_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
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

function validateGroupImageFile(file: File): string | null {
  if (!ALLOWED_GROUP_IMAGE_TYPES.has(file.type)) {
    return "Upload a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_GROUP_IMAGE_BYTES) {
    return "Keep the group picture under 2 MB.";
  }

  return null;
}

function imageBitmapExceedsPreviewLimits(bitmap: ImageBitmap): boolean {
  return (
    bitmap.width > MAX_GROUP_IMAGE_DECODED_SIDE ||
    bitmap.height > MAX_GROUP_IMAGE_DECODED_SIDE ||
    bitmap.width * bitmap.height > MAX_GROUP_IMAGE_DECODED_PIXELS
  );
}

function GroupImagePreviewCanvas({
  bitmap,
  className,
}: {
  bitmap: ImageBitmap;
  className: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const previewSize = GROUP_IMAGE_PREVIEW_SIZE;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, GROUP_IMAGE_PREVIEW_MAX_PIXEL_RATIO);
    canvas.width = Math.round(previewSize * pixelRatio);
    canvas.height = Math.round(previewSize * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, previewSize, previewSize);

    const scale = Math.max(previewSize / bitmap.width, previewSize / bitmap.height);
    const sourceWidth = previewSize / scale;
    const sourceHeight = previewSize / scale;
    const sourceX = Math.max(0, (bitmap.width - sourceWidth) / 2);
    const sourceY = Math.max(0, (bitmap.height - sourceHeight) / 2);

    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      previewSize,
      previewSize
    );
  }, [bitmap]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="Exchange picture preview"
    />
  );
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const groupImagePreviewBitmapRef = useRef<ImageBitmap | null>(null);
  const imageDecodeRequestRef = useRef(0);
  const mountedRef = useRef(true);

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [budget, setBudget] = useState(25);
  const [currency, setCurrency] = useState("USD");
  const [customBudget, setCustomBudget] = useState(false);
  const [requireAnonymousNickname, setRequireAnonymousNickname] = useState(false);
  const [ownerCodename, setOwnerCodename] = useState("");
  const [groupImageFile, setGroupImageFile] = useState<File | null>(null);
  const [groupImagePreviewBitmap, setGroupImagePreviewBitmap] = useState<ImageBitmap | null>(null);
  const [imageDecodePending, setImageDecodePending] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);

  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    setIsHydrated(true);

    return () => {
      mountedRef.current = false;
      imageDecodeRequestRef.current += 1;
      groupImagePreviewBitmapRef.current?.close();
      groupImagePreviewBitmapRef.current = null;
    };
  }, []);

  const replaceGroupImagePreviewBitmap = (bitmap: ImageBitmap | null) => {
    groupImagePreviewBitmapRef.current?.close();
    groupImagePreviewBitmapRef.current = bitmap;
    setGroupImagePreviewBitmap(bitmap);
  };

  const applyGroupImageFile = async (file: File) => {
    const requestId = imageDecodeRequestRef.current + 1;
    imageDecodeRequestRef.current = requestId;
    const validationMessage = validateGroupImageFile(file);

    if (validationMessage) {
      setGroupImageFile(null);
      replaceGroupImagePreviewBitmap(null);
      setImageDecodePending(false);
      setErrorMsg(validationMessage);
      setStatusMsg("");
      return;
    }

    setErrorMsg("");
    setStatusMsg("");
    setGroupImageFile(file);
    setImageDecodePending(true);

    try {
      const previewBitmap = await createImageBitmap(file);

      if (!mountedRef.current || requestId !== imageDecodeRequestRef.current) {
        previewBitmap.close();
        return;
      }

      if (imageBitmapExceedsPreviewLimits(previewBitmap)) {
        previewBitmap.close();
        setGroupImageFile(null);
        replaceGroupImagePreviewBitmap(null);
        setErrorMsg("Choose a smaller picture, under 6000 pixels on each side.");
        return;
      }

      replaceGroupImagePreviewBitmap(previewBitmap);
    } catch {
      if (!mountedRef.current || requestId !== imageDecodeRequestRef.current) {
        return;
      }

      setGroupImageFile(null);
      replaceGroupImagePreviewBitmap(null);
      setErrorMsg("We could not preview that picture. Try another JPG, PNG, or WebP image.");
    } finally {
      if (mountedRef.current && requestId === imageDecodeRequestRef.current) {
        setImageDecodePending(false);
      }
    }
  };

  const handleGroupImageInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      await applyGroupImageFile(file);
    }

    event.target.value = "";
  };

  const handleGroupImageDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setImageDragActive(false);
    const file = event.dataTransfer.files?.[0];

    if (file) {
      await applyGroupImageFile(file);
    }
  };

  const removeGroupImage = () => {
    imageDecodeRequestRef.current += 1;
    setGroupImageFile(null);
    setImageDecodePending(false);
    replaceGroupImagePreviewBitmap(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setStatusMsg("");

    if (imageDecodePending) {
      setErrorMsg("Wait for the group picture to finish previewing.");
      setLoading(false);
      return;
    }

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

    const formData = new FormData();
    formData.set("name", cleanName);
    formData.set("description", cleanDesc);
    formData.set("eventDate", eventDate);
    formData.set("inviteEmailsJson", JSON.stringify(emailList));
    formData.set("budget", cleanBudget.toString());
    formData.set("currency", currency);
    formData.set("requireAnonymousNickname", String(requireAnonymousNickname));
    formData.set("ownerCodename", cleanOwnerCodename);

    if (groupImageFile) {
      formData.set("groupImage", groupImageFile);
    }

    const result = await createGroupWithInvitesFromFormData(formData);

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
  const formActionDisabled = !isHydrated || loading || imageDecodePending;
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

      <div className="holiday-panel relative z-10 mx-auto mb-5 flex w-full max-w-6xl flex-col gap-4 rounded-[28px] px-5 py-4">
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
          className="holiday-panel rounded-[30px] p-6 lg:sticky lg:top-8 lg:order-2"
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

          <div className="mx-auto mt-6 grid h-40 w-40 overflow-hidden rounded-[38px] bg-[#fff4df] text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)] sm:h-44 sm:w-44 sm:rounded-[42px]">
            {groupImagePreviewBitmap ? (
              <GroupImagePreviewCanvas
                bitmap={groupImagePreviewBitmap}
                className="h-full w-full object-cover"
              />
            ) : (
              <ChecklistMark done />
            )}
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
          className="holiday-panel-strong rounded-[28px] p-6 sm:p-8 lg:order-1"
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
              Exchange picture{" "}
              <span className="text-[11px] font-semibold" style={{ color: "#9ca3af" }}>
                (optional)
              </span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleGroupImageInput}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setImageDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setImageDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setImageDragActive(false);
              }}
              onDrop={handleGroupImageDrop}
              className="flex w-full flex-col gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:p-5"
              style={{
                background: imageDragActive ? "#eef6ee" : "rgba(72,102,78,.045)",
                border: imageDragActive
                  ? "2px solid rgba(72,102,78,.42)"
                  : "2px dashed rgba(72,102,78,.2)",
                color: "#2e3432",
                fontFamily: "inherit",
              }}
            >
              <span className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-3xl bg-white text-[#48664e] shadow-[inset_0_0_0_1px_rgba(72,102,78,.1)] sm:h-32 sm:w-32 sm:rounded-[28px]">
                {groupImagePreviewBitmap ? (
                  <GroupImagePreviewCanvas
                    bitmap={groupImagePreviewBitmap}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg viewBox="0 0 28 28" className="h-8 w-8" fill="none" aria-hidden="true">
                    <path
                      d="M6 11.5h16v9.2c0 1-.8 1.8-1.8 1.8H7.8c-1 0-1.8-.8-1.8-1.8v-9.2Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M9 11.5V9.8A3.8 3.8 0 0 1 16.2 8M14 11.5V9.8a3.8 3.8 0 0 1 7.3-1.4M5 14h18"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M14 4.5v5M11.5 7h5"
                      stroke="#c0392b"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-black">
                  {groupImageFile ? groupImageFile.name : "Drop a group picture or browse"}
                </span>
                <span className="mt-1 block text-[12px] font-semibold leading-5 text-slate-500">
                  JPG, PNG, or WebP. Keep it under 2 MB. The picture appears on your group card.
                </span>
              </span>
            </button>
            {groupImageFile && (
              <button
                type="button"
                onClick={removeGroupImage}
                className="mt-2 rounded-full px-3 py-1.5 text-[12px] font-bold text-[#a43c3f] transition hover:bg-[#fff1f2]"
              >
                Remove picture
              </button>
            )}
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
                disabled={!isHydrated}
                onClick={() => setRequireAnonymousNickname((current) => !current)}
                aria-pressed={requireAnonymousNickname}
                aria-label={
                  requireAnonymousNickname
                    ? "Allow real names in this group"
                    : "Use nicknames in this group"
                }
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
            disabled={formActionDisabled}
            className="w-full rounded-full py-3.5 text-[16px] font-extrabold text-white transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
            style={{
              background:
                formActionDisabled ? "#9ca3af" : "linear-gradient(135deg,#48664e,#3c5a43)",
              border: "none",
              cursor: formActionDisabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: formActionDisabled ? "none" : "0 16px 30px rgba(72,102,78,.2)",
            }}
          >
            {loading ? "Creating group..." : imageDecodePending ? "Checking picture..." : "Create group"}
          </button>
        </form>
        </section>
      </div>
    </main>
  );
}
