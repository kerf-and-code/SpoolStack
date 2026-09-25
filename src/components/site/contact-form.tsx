'use client';

import { useState } from 'react';
import { CONTACT_LIMITS, CONTACT_TOPICS } from '@/lib/contact';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string; fallback?: string };

const inputClass =
  'mt-1.5 w-full rounded-lg border-[1.5px] border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none';

export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; fallback?: string };
      if (!res.ok) {
        setStatus({ kind: 'error', message: json.error ?? 'Something went wrong.', fallback: json.fallback });
        return;
      }
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach the server. Check your connection and try again.' });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="site-panel p-6" role="status">
        <p className="text-lg font-semibold">Message sent.</p>
        <p className="mt-2 text-sm text-muted">Thanks. The reply will come to the email address you gave.</p>
      </div>
    );
  }

  const busy = status.kind === 'sending';
  const initialTopic = defaultTopic && (CONTACT_TOPICS as readonly string[]).includes(defaultTopic) ? defaultTopic : 'Question';

  return (
    <form onSubmit={onSubmit} className="site-panel space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="text-sm font-medium">
            Name <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="contact-name" name="name" autoComplete="name" maxLength={CONTACT_LIMITS.name} className={inputClass} />
        </div>
        <div>
          <label htmlFor="contact-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={CONTACT_LIMITS.email}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-topic" className="text-sm font-medium">
          Topic
        </label>
        <select id="contact-topic" name="topic" defaultValue={initialTopic} className={inputClass}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={CONTACT_LIMITS.message}
          placeholder="For a bug, what you did and what happened. For a printer or slicer, which one."
          className={inputClass}
        />
      </div>
      {/* Honeypot: hidden from people and screen readers, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === 'error' ? (
        <p role="alert" className="rounded-md border border-red-600/40 bg-red-500/10 px-3 py-2 text-sm">
          {status.message}
          {status.fallback ? (
            <>
              {' '}
              You can email{' '}
              <a href={`mailto:${status.fallback}`} className="font-medium underline underline-offset-2">
                {status.fallback}
              </a>{' '}
              directly.
            </>
          ) : null}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-60">
        {busy ? 'Sending...' : 'Send message'}
      </button>
    </form>
  );
}
