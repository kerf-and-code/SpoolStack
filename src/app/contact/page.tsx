import type { Metadata } from 'next';
import { ContactForm } from '@/components/site/contact-form';
import { SiteShell } from '@/components/site/site-shell';
import { PageIntro } from '@/components/site/ui';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact : SpoolStack',
  description: 'Questions, bug reports, feature ideas, or a printer or slicer you want supported.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>;
}) {
  const { topic } = await searchParams;

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <PageIntro eyebrow="contact" title="Talk to a person.">
          <p>
            Questions, bugs, a feature you want, or a printer or slicer that should be supported. Messages go
            straight to Kerf and Code, and the reply comes from a person.
          </p>
          <p className="mt-4 text-base">
            Prefer email? Write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-ink underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </PageIntro>
        <div className="lg:pt-20">
          <ContactForm defaultTopic={typeof topic === 'string' ? topic : undefined} />
        </div>
      </div>
    </SiteShell>
  );
}
