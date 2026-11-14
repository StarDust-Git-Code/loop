import { NextResponse } from "next/server";

/**
 * Waitlist sign-up. Forwards the email to WAITLIST_WEBHOOK_URL (any endpoint that
 * accepts a JSON POST: a Google Apps Script, a Formspree form, a Discord webhook...).
 * Without that variable set, sign-ups are refused so none are silently lost.
 */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "That email doesn't look right." }, { status: 400 });
  }

  const hook = process.env.WAITLIST_WEBHOOK_URL;
  if (!hook) {
    return NextResponse.json({ ok: false, error: "The list isn't open yet. Try again soon." }, { status: 503 });
  }

  const res = await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, content: `Waitlist: ${email}`, at: new Date().toISOString() }),
  }).catch(() => null);

  if (!res || !res.ok) {
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
