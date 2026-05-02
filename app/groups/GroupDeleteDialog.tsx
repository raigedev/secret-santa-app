"use client";

import { useEffect, useRef } from "react";
import type { ActionMessage } from "@/app/dashboard/dashboard-types";

export type DeleteGroupTarget = {
  id: string;
  name: string;
};

type GroupDeleteDialogProps = {
  confirmName: string;
  deleting: boolean;
  message: ActionMessage;
  target: DeleteGroupTarget;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmNameChange: (value: string) => void;
};

export function GroupDeleteDialog({
  confirmName,
  deleting,
  message,
  target,
  onCancel,
  onConfirm,
  onConfirmNameChange,
}: GroupDeleteDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const confirmationMatches = confirmName.trim() === target.name.trim();

  useEffect(() => {
    const focusInputFrame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(focusInputFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleting, onCancel]);

  return (
    <div
      data-app-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2e3432]/35 px-4 py-6 backdrop-blur-sm"
      role="presentation"
    >
      <section
        ref={dialogRef}
        aria-labelledby="delete-group-title"
        aria-describedby="delete-group-description"
        aria-modal="true"
        className="w-full max-w-lg rounded-[28px] border border-[rgba(164,60,63,0.18)] bg-white p-6 text-[#2e3432] shadow-[0_24px_70px_rgba(46,52,50,0.22)]"
        role="dialog"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a43c3f]">
          Permanent delete
        </p>
        <h2
          id="delete-group-title"
          className="mt-2 text-2xl font-black"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
        >
          Delete {target.name}?
        </h2>
        <p
          id="delete-group-description"
          className="mt-3 text-sm font-semibold leading-6 text-slate-600"
        >
          This removes the group, members, wishlists, messages, draw details, and progress
          records. Related notifications are cleared too. This cannot be undone.
        </p>
        <label
          className="mt-5 block text-sm font-black text-slate-700"
          htmlFor="delete-group-confirm-name"
        >
          Type the group name to confirm
        </label>
        <input
          id="delete-group-confirm-name"
          ref={inputRef}
          value={confirmName}
          onChange={(event) => onConfirmNameChange(event.target.value)}
          disabled={deleting}
          className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-[#48664e] focus:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48664e] disabled:cursor-not-allowed disabled:opacity-60"
          autoComplete="off"
          placeholder={target.name}
        />
        {!confirmationMatches && confirmName.trim().length > 0 && (
          <p className="mt-2 text-xs font-bold text-slate-500" role="status">
            Match the exact group name, including capitalization and spacing.
          </p>
        )}
        {message && (
          <p
            className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
            role="status"
          >
            {message.text}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep group
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || !confirmationMatches}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#a43c3f] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(164,60,63,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting" : "Delete forever"}
          </button>
        </div>
      </section>
    </div>
  );
}
