import type { Metadata } from 'next';
import { FeaturesExplorer } from '@/components/site/features-explorer';
import { SiteShell } from '@/components/site/site-shell';
import { ButtonLink, PageIntro } from '@/components/site/ui';

export const metadata: Metadata = {
  title: 'Features : SpoolStack',
  description:
    'Slicer file import, a searchable run journal, failure and defect tracking, printer and filament presets, and honest per-print costs.',
  alternates: { canonical: '/features' },
};

export default function FeaturesPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PageIntro eyebrow="features" title="One log for every print, and what it taught you.">
          <p>
            SpoolStack keeps the whole story of each print: the settings, how it came out, and what it used. Here
            is what that looks like.
          </p>
        </PageIntro>

        <FeaturesExplorer />

        <section className="my-20 flex flex-col items-start gap-5 rounded-xl border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Free, on the web and on your phone.</h2>
            <p className="mt-1 text-sm text-muted">Sign in with Google or an email link. No card, no trial.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-in">Start logging</ButtonLink>
            <ButtonLink href="/faq" variant="secondary">
              Questions
            </ButtonLink>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
