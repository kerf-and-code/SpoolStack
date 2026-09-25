// POST /api/contact: emails a contact form message to Kerf and Code through
// Resend's HTTP API (no SDK dependency). Same shape as the Six Axes mailer.
//
// Needs RESEND_API_KEY in the environment. The sending domain
// send.kerfandcode.com is already verified in Resend. Without the key this
// answers 503 and the form shows the email address instead.

import { NextResponse } from 'next/server';
import { checkContact } from '@/lib/contact';
import { CONTACT_EMAIL } from '@/lib/site';

const FROM = 'SpoolStack <contact@send.kerfandcode.com>';

export async function POST(request: Request) {
  // Cheap cross-site check: browsers send Origin on POST. A form on another
  // site posting here would carry that site's origin.
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" (sandboxed frames) or garbage: treat as foreign.
    }
    if (originHost !== host) return NextResponse.json({ error: 'Bad origin.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Could not read the form.' }, { status: 400 });
  }

  const check = checkContact(typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {});
  if (!check.ok) {
    // A filled honeypot gets a normal-looking success, so bots learn nothing.
    if (check.spam) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: check.message }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'The contact form is not set up yet.', fallback: CONTACT_EMAIL }, { status: 503 });
  }

  const { name, email, topic, message } = check.value;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [CONTACT_EMAIL],
      reply_to: email,
      subject: `[SpoolStack] ${topic}${name ? ` from ${name}` : ''}`,
      text: `${message}\n\n--\nFrom: ${name || '(no name)'} <${email}>\nTopic: ${topic}\nSent from the SpoolStack contact form.`,
    }),
  });

  if (!res.ok) {
    console.error('contact: resend failed', res.status, await res.text().catch(() => ''));
    return NextResponse.json({ error: 'The message could not be sent.', fallback: CONTACT_EMAIL }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
