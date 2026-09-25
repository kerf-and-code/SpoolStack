import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { ButtonLink, Eyebrow } from '@/components/site/ui';

export const metadata: Metadata = {
  title: 'Page not found : SpoolStack',
  robots: { index: false },
};

// Any URL that matches no route, and any public page that calls notFound().
// Pages under /app have their own, inside the app shell.
export default function NotFound() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-xl px-4 py-24 sm:px-6">
        <Eyebrow>404</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Nothing printed here.</h1>
        <p className="mt-4 text-muted">
          There is no page at this address. It may have moved, or the link may have a typo in it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/app" variant="secondary">
            Your log
          </ButtonLink>
        </div>
      </div>
    </SiteShell>
  );
}
