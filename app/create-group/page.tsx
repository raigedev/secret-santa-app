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

function StepCompleteIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="m3.5 8.2 3 3 6-6.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M9.8 3.5 5.3 8l4.5 4.5M5.8 8h6.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M8 1.8 9.5 6l4.2 1.5L9.5 9 8 13.2 6.5 9 2.3 7.5 6.5 6 8 1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GiftBoxPlaceholder() {
  return (
    <span
      className="relative grid h-full w-full place-items-center overflow-hidden rounded-[inherit]"
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(252,206,114,.34),transparent_34%),linear-gradient(135deg,#fff7e6,#f4faf4)]" />
      <svg viewBox="0 0 112 112" className="relative h-24 w-24 drop-shadow-[0_18px_24px_rgba(72,102,78,.12)]">
        <rect x="23" y="46" width="66" height="47" rx="11" fill="#ed4a54" />
        <rect x="53" y="46" width="10" height="47" fill="#fcce72" />
        <rect x="18" y="36" width="76" height="20" rx="9" fill="#ff7a7f" />
        <rect x="53" y="36" width="10" height="20" fill="#ffe29a" />
        <path
          d="M52 36c-11-14-24-13-27-5-3 9 11 11 27 5ZM60 36c11-14 24-13 27-5 3 9-11 11-27 5Z"
          fill="#48664e"
        />
        <circle cx="25" cy="37" r="3" fill="#fcce72" />
        <circle cx="91" cy="57" r="2.5" fill="#a43c3f" />
        <path d="M16 68c5 2 7 2 12 0" stroke="#fcce72" strokeLinecap="round" strokeWidth="3" />
      </svg>
    </span>
  );
}

type SetupStep = {
  id: string;
  label: string;
  helper: string;
  ready: boolean;
};

type SetupStepStatus = "complete" | "current" | "upcoming";

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
  const [budgetReviewed, setBudgetReviewed] = useState(false);
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
  const basicsReady = groupName.trim().length > 0 && eventDate.length > 0;
  const rawBudgetReady = budget > 0 && currency.length > 0;
  const budgetStepReady = budgetReviewed && rawBudgetReady;
  const ownerNicknameMessage = requireAnonymousNickname
    ? validateAnonymousGroupNickname({ nickname: sanitizeGroupNickname(ownerCodename) })
    : null;
  const privacyReady = ownerNicknameMessage === null;
  const setupSteps: SetupStep[] = [
    {
      id: "1",
      label: "Basics",
      helper: basicsReady ? "Name and gift day set" : "Start here",
      ready: basicsReady,
    },
    {
      id: "2",
      label: "Budget",
      helper: budgetStepReady ? `${currencySymbol}${budget || 0} per person` : "Confirm the amount",
      ready: budgetStepReady,
    },
    {
      id: "3",
      label: "Privacy",
      helper: requireAnonymousNickname ? "Nicknames on" : "Names visible",
      ready: privacyReady,
    },
    {
      id: "4",
      label: "Invites",
      helper: inviteEmailCount > 0 ? `${inviteEmailCount} invited` : "Optional",
      ready: inviteEmailCount > 0,
    },
    {
      id: "5",
      label: "Review",
      helper: "Create exchange",
      ready: basicsReady && rawBudgetReady && privacyReady,
    },
  ];
  const nextIncompleteStepIndex = setupSteps.findIndex(
    (step, index) => index < setupSteps.length - 1 && !step.ready
  );
  const activeStepIndex =
    nextIncompleteStepIndex === -1 ? setupSteps.length - 1 : nextIncompleteStepIndex;
  const getStepStatus = (index: number): SetupStepStatus => {
    if (index < activeStepIndex) {
      return "complete";
    }

    if (index === activeStepIndex) {
      return "current";
    }

    return "upcoming";
  };
  const fieldClassName =
    "w-full rounded-[18px] border border-[rgba(72,102,78,.18)] bg-white/90 px-4 py-3.5 text-[14px] font-semibold text-[#1f2937] shadow-[inset_0_1px_0_rgba(255,255,255,.75)] outline-none transition focus:border-[#d9ae56] focus:bg-white focus:ring-4 focus:ring-[#d9ae56]/20";
  const labelClassName =
    "mb-2 block text-[12px] font-black uppercase tracking-[0.08em] text-[#48664e]";

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
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-[rgba(72,102,78,.14)] bg-white/75 px-4 text-sm font-black text-[#48664e] shadow-[0_10px_24px_rgba(72,102,78,.08)] transition hover:-translate-y-0.5 hover:bg-[#eef6ee] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9ae56]/25"
          style={{ fontFamily: "inherit" }}
        >
          <BackArrowIcon />
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
          {setupSteps.map((step, index) => {
            const status = getStepStatus(index);
            const isComplete = status === "complete";
            const isCurrent = status === "current";

            return (
              <div
                key={step.label}
                className={`flex min-h-16 items-center gap-3 rounded-[22px] border px-3 py-2 transition ${
                  isCurrent
                    ? "border-[#48664e]/25 bg-[#eef6ee] shadow-[0_14px_30px_rgba(72,102,78,.1)]"
                    : isComplete
                      ? "border-[#48664e]/12 bg-white/70"
                      : "border-transparent bg-transparent"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black"
                  style={{
                    background: isComplete || isCurrent ? "#48664e" : "#ffffff",
                    border: isCurrent
                      ? "2px solid rgba(217,174,86,.72)"
                      : "1px solid rgba(72,102,78,.16)",
                    color: isComplete || isCurrent ? "#ffffff" : "#2e3432",
                  }}
                >
                  {isComplete ? <StepCompleteIcon /> : step.id}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-black text-[#2e3432]">{step.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500">
                    {step.helper}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.78fr)] lg:items-start">
        <aside
          className="holiday-panel rounded-[30px] p-6 lg:sticky lg:top-8 lg:order-2"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#48664e]">
            Exchange preview
          </p>
          <p
            aria-label="Group name preview"
            aria-live="polite"
            className="mt-8 text-center text-[30px] font-black leading-tight text-[#48664e]"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            {groupName.trim() || "My Office Secret Santa"}
          </p>
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
              <GiftBoxPlaceholder />
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
        <h2
          className="mb-2 text-[24px] font-black leading-tight sm:text-[28px]"
          style={{ fontFamily: "'Fredoka', sans-serif", color: "#48664e" }}
        >
          Start with the basics
        </h2>
        <p className="mb-6 text-[13px] font-semibold leading-6 text-slate-600">
          Name the exchange, choose the gift day, then confirm budget, privacy, and invites.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClassName}>
              Group name *
            </label>
            <input
              type="text"
              placeholder="e.g. Office Holiday Party"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              required
              className={fieldClassName}
              style={{ fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label className={labelClassName}>
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
              className="flex w-full flex-col gap-4 rounded-3xl p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9ae56]/25 sm:flex-row sm:items-center sm:p-5"
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
                  <SparkIcon />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-black">
                  {groupImageFile ? groupImageFile.name : "Add an exchange picture"}
                </span>
                <span className="mt-1 block text-[12px] font-semibold leading-5 text-slate-500">
                  Drop an image here, or choose a file. JPG, PNG, or WebP under 2 MB.
                </span>
              </span>
            </button>
            {groupImageFile && (
              <button
                type="button"
                onClick={removeGroupImage}
                className="mt-2 min-h-10 rounded-full px-4 text-[12px] font-black text-[#a43c3f] transition hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a43c3f]/15"
              >
                Remove picture
              </button>
            )}
          </div>

          <div>
            <label className={labelClassName}>
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
              className={`${fieldClassName} resize-y`}
              style={{
                fontFamily: "inherit",
                minHeight: "70px",
              }}
            />
          </div>

          <div>
            <label className={labelClassName}>
              Gift exchange date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
              className={fieldClassName}
              style={{ fontFamily: "inherit" }}
            />
          </div>

          <div
            className="rounded-3xl p-4 sm:p-5"
            style={{
              background: "linear-gradient(135deg,rgba(72,102,78,.06),rgba(217,174,86,.1))",
              border: "1px solid rgba(72,102,78,.12)",
            }}
          >
            <label
              className={labelClassName}
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
                    setBudgetReviewed(true);
                  }}
                  aria-pressed={!customBudget && budget === amount}
                  className="min-h-11 rounded-full px-4 text-[13px] font-black transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9ae56]/25"
                  style={{
                    border: `1px solid ${
                      !customBudget && budget === amount ? "#48664e" : "rgba(72,102,78,.16)"
                    }`,
                    background: !customBudget && budget === amount ? "#48664e" : "#fff",
                    color: !customBudget && budget === amount ? "#fff" : "#48664e",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow:
                      !customBudget && budget === amount
                        ? "0 12px 24px rgba(72,102,78,.18)"
                        : "none",
                  }}
                >
                  {currencySymbol}
                  {amount}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCustomBudget(true);
                  setBudgetReviewed(true);
                }}
                aria-pressed={customBudget}
                className="min-h-11 rounded-full px-4 text-[13px] font-black transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9ae56]/25"
                style={{
                  border: `1px ${customBudget ? "solid" : "dashed"} ${
                    customBudget ? "#48664e" : "rgba(72,102,78,.24)"
                  }`,
                  background: customBudget ? "#48664e" : "#fff",
                  color: customBudget ? "#fff" : "#48664e",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Custom amount
              </button>
            </div>
            {customBudget && (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-[14px] font-black" style={{ color: "#48664e" }}>
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => {
                    setBudget(parseInt(e.target.value, 10) || 0);
                    setBudgetReviewed(true);
                  }}
                  min={0}
                  max={100000}
                  placeholder="Enter amount..."
                  className={`${fieldClassName} sm:w-36`}
                  style={{ fontFamily: "inherit" }}
                />
              </div>
            )}
            <p className="text-[11px] mt-2" style={{ color: "#9ca3af" }}>
              Members will see this budget when they join.
            </p>
          </div>

          <div>
            <label className={labelClassName}>
              Currency
            </label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setBudgetReviewed(true);
              }}
              className={fieldClassName}
              style={{
                fontFamily: "inherit",
                cursor: "pointer",
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
            <label className={labelClassName}>
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
              className={fieldClassName}
              style={{ fontFamily: "inherit" }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>
              Add more than one email by separating them with commas.
            </p>
          </div>

          <div
            className="rounded-3xl p-4 sm:p-5"
            style={{
              background: requireAnonymousNickname
                ? "rgba(72,102,78,.08)"
                : "rgba(15,23,42,.03)",
              border: requireAnonymousNickname
                ? "1px solid rgba(72,102,78,.18)"
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
                className="inline-flex min-h-8 shrink-0 items-center rounded-full p-1 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9ae56]/25 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: requireAnonymousNickname ? "#48664e" : "#cbd5e1",
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
                  color: requireAnonymousNickname ? "#48664e" : "#475569",
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
                  placeholder="e.g. Ribbon Keeper"
                  value={ownerCodename}
                  onChange={(e) => setOwnerCodename(e.target.value)}
                  maxLength={30}
                  autoComplete="off"
                  className={fieldClassName}
                  style={{
                    fontFamily: "inherit",
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
            <p className="text-[13px] font-bold text-center" style={{ color: "#48664e" }}>
              {statusMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={formActionDisabled}
            className="min-h-13 w-full rounded-full px-5 py-4 text-[16px] font-black text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d9ae56]/30 disabled:hover:translate-y-0"
            style={{
              background:
                formActionDisabled ? "#9ca3af" : "linear-gradient(135deg,#48664e,#3c5a43)",
              border: "none",
              cursor: formActionDisabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: formActionDisabled ? "none" : "0 16px 30px rgba(72,102,78,.2)",
            }}
          >
            {loading ? "Creating exchange..." : imageDecodePending ? "Checking picture..." : "Create exchange"}
          </button>
        </form>
        </section>
      </div>
    </main>
  );
}
