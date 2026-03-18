"use client";

import { useFormState } from "react-dom";
import { inviteUser } from "./actions";

type State = {
  message: string;
};

export default function InviteForm({ groupId }: { groupId: string }) {
  const [state, formAction] = useFormState<State, FormData>(inviteUser, { message: "" });

  return (
    <form action={formAction} className="mb-6 flex flex-col gap-2">
      {/* Hidden group ID */}
      <input type="hidden" name="id" value={groupId} />

      {/* Email input */}
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="Enter email to invite"
          className="flex-1 px-3 py-2 border rounded-lg text-black bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
        >
          Invite
        </button>
      </div>

      {/* Feedback message */}
      {state.message && (
        <p
          className={`text-sm mt-2 ${
            state.message.startsWith("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}