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
      className="gift-modal-backdrop fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="presentation"
    >
      <section
        ref={dialogRef}
        aria-labelledby="delete-group-title"
        aria-describedby="delete-group-description"
        aria-modal="true"
        className="gift-modal-panel gift-surface-strong w-full max-w-lg p-6 text-[#2e3432]"
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
          className="gift-field mt-2 w-full px-4 text-sm font-bold"
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
            className={`gift-alert mt-3 text-sm ${
              message.type === "success"
                ? "gift-alert-success"
                : "gift-alert-error"
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
            className="gift-button gift-button-secondary gift-button-compact text-sm"
          >
            Keep group
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || !confirmationMatches}
            className="gift-button gift-button-red gift-button-compact text-sm"
          >
            {deleting ? "Deleting" : "Delete forever"}
          </button>
        </div>
      </section>
    </div>
  );
}
