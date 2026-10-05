"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/app/account/actions";

export function DeleteAccountForm({ confirmWord }: { confirmWord: string }) {
  const [error, formAction, isPending] = useActionState(deleteAccount, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Type {confirmWord} to confirm
        <input
          name="confirm"
          required
          pattern={confirmWord}
          autoComplete="off"
          className="w-full max-w-xs border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-red-600"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
