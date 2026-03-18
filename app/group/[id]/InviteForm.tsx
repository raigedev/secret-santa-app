"use client";

import { useFormState } from "react-dom";
import { inviteUser } from "./actions";

type State = {
  message: string;
};

export default function InviteForm({ groupId }: { groupId: string }) {
  const [state, formAction] = useFormState<State, FormData>(inviteUser, { message: "" });

  return (
    <form action={formAction} className="mb-6 flex gap-2">
      <input type="hidden" name="id" value={groupId} />
      <input
        type="email"
        name="email"
        placeholder="Enter email to invite"
        className="flex-1 px-3 py-2 border rounded-lg"
        required
      />
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition"
      >
        Invite
      </button>
      {state.message && (
        <p className="text-sm text-gray-700 mt-2">{state.message}</p>
      )}
    </form>
  );
}