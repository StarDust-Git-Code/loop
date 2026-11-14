"use client";

import { useState } from "react";

type State = { kind: "idle" | "sending" | "done" | "error"; msg?: string };

/** Waitlist form. `stacked` puts the button under the field instead of inside it. */
export default function JoinForm({ id, stacked = false, onDone }: { id: string; stacked?: boolean; onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setState({ kind: "done" });
        onDone?.();
      }
      else setState({ kind: "error", msg: data.error ?? "Something went wrong." });
    } catch {
      setState({ kind: "error", msg: "You seem to be offline." });
    }
  };

  if (state.kind === "done") {
    return (
      <p className="join-done" role="status">
        You&rsquo;re on the list. Mimo will write when your Mates are ready.
      </p>
    );
  }

  return (
    <form className={`join${stacked ? " join-stacked" : ""}`} onSubmit={submit} noValidate>
      <label htmlFor={id} className="sr">Email address</label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby={state.kind === "error" ? `${id}-err` : undefined}
      />
      <button type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Joining…" : "Join the list"}
      </button>
      {state.kind === "error" && (
        <p id={`${id}-err`} className="join-err" role="alert">{state.msg}</p>
      )}
    </form>
  );
}
