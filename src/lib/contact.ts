// Contact form rules, shared by the form (for limits) and the API route
// (which enforces them; the browser's checks are only a convenience).

export const CONTACT_TOPICS = [
  'Question',
  'Bug report',
  'Feature idea',
  'Printer or slicer support',
  'Delete my account',
  'Other',
] as const;

export const CONTACT_LIMITS = { name: 100, email: 200, message: 5000 } as const;

export interface ContactInput {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Honeypot. Real people never see or fill it. */
  company: string;
}

export type ContactCheck =
  | { ok: true; value: Omit<ContactInput, 'company'> }
  | { ok: false; spam: true }
  | { ok: false; spam: false; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkContact(raw: Partial<Record<keyof ContactInput, unknown>>): ContactCheck {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const input = {
    name: s(raw.name),
    email: s(raw.email),
    topic: s(raw.topic),
    message: s(raw.message),
    company: s(raw.company),
  };
  if (input.company !== '') return { ok: false, spam: true };
  if (!EMAIL.test(input.email) || input.email.length > CONTACT_LIMITS.email) {
    return { ok: false, spam: false, message: 'Enter an email address we can reply to.' };
  }
  if (input.message.length < 5) return { ok: false, spam: false, message: 'Add a message.' };
  if (input.message.length > CONTACT_LIMITS.message) {
    return { ok: false, spam: false, message: `Keep the message under ${CONTACT_LIMITS.message} characters.` };
  }
  if (input.name.length > CONTACT_LIMITS.name) return { ok: false, spam: false, message: 'That name is too long.' };
  const topic = (CONTACT_TOPICS as readonly string[]).includes(input.topic) ? input.topic : 'Other';
  return { ok: true, value: { name: input.name, email: input.email, topic, message: input.message } };
}
