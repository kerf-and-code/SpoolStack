import Link from 'next/link';
import { InstallButton } from '@/components/install-button';
import type { Metadata } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

// Server-rendered marketing page at /. The authenticated app lives under /app.
// This split exists from day one on purpose: a client-rendered shell is
// invisible to crawlers, and retrofitting that later is a month of work.
//
// Every claim on this page has to be true of the shipped app. Features that
// are planned but not built are listed under "Coming next", not sold as done.

export const metadata: Metadata = {
  title: 'SpoolStack: a run log for 3D printing and small-batch making',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

const PILLARS = [
  {
    title: 'Logging in under a minute',
    body: 'Drop a .gcode or sliced .3mf file and the form fills itself: print time, filament used, temperatures, layer height. The file is read on your device and never uploaded.',
  },
  {
    title: 'One log, not four apps',
    body: 'A run is a run, whether it is a print, a cut or a laser pass. Same record shape every time, so the history stays comparable as you add machines.',
  },
  {
    title: 'Failures on the record',
    body: 'Log what went wrong, not just what worked. Defects, partial runs and good-part counts are kept per run, so your real success rate is your own, not a guess.',
  },
  {
    title: 'A journal you can search',
    body: 'Filter runs by machine, material, project, outcome and date. Find the settings from the print that came out right three months ago in seconds.',
  },
];

const STEPS = [
  { n: '1', title: 'Add your machines and materials', body: 'Pick from common printers and filaments or enter your own. Once per setup, not once per run.' },
  { n: '2', title: 'Log each run', body: 'Import from the slicer file or type it in. Mark the outcome and any defects when it comes off the bed.' },
  { n: '3', title: 'Read your history', body: 'See what you have run, what failed and why, and which settings to reuse.' },
];

const COMING = [
  'Cost per part: material, electricity, machine wear and your time, recomputed from raw measurements whenever a price changes.',
  'Quoting from your own failure rate instead of an assumed one.',
  'Pattern spotting across runs: which settings and materials go with which defects.',
];

// structured data for search engines. Escaping < keeps a stray "</script>" in
// any string from closing the tag early.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: 'Kerf and Code LLC' },
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <span className="font-semibold tracking-tight">SpoolStack</span>
          <Link
            href="/sign-in"
            className="ml-auto rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="py-20 sm:py-28">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            A run log for people who make things.
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-75">
            Every print, cut and job in one record. What you ran, what went wrong, and which settings actually
            worked, built from your own history instead of someone else&rsquo;s defaults.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/sign-in"
              className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background"
            >
              Start logging
            </Link>
            <span className="text-sm opacity-60">Free while it is in development. Works on phone and desktop.</span>
          </div>
        </section>

        <section className="grid gap-8 border-t border-black/10 py-16 sm:grid-cols-2 dark:border-white/15">
          {PILLARS.map((pillar) => (
            <div key={pillar.title}>
              <h2 className="font-medium">{pillar.title}</h2>
              <p className="mt-2 text-sm opacity-70">{pillar.body}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-black/10 py-16 dark:border-white/15">
          <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 text-sm font-medium dark:border-white/20">
                  {step.n}
                </span>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-2 text-sm opacity-70">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-black/10 py-16 dark:border-white/15">
          <h2 className="text-xl font-semibold tracking-tight">Coming next</h2>
          <p className="mt-2 max-w-xl text-sm opacity-70">
            Being built in the open, in this order. Runs you log today feed all of it.
          </p>
          <ul className="mt-6 max-w-2xl list-disc space-y-2 pl-5 text-sm opacity-80">
            {COMING.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="border-t border-black/10 py-16 dark:border-white/15">
          <h2 className="text-xl font-semibold tracking-tight">Keep it on your home screen</h2>
          <p className="mt-2 max-w-xl text-sm opacity-70">
            SpoolStack installs like an app and opens straight to your log. On Android or desktop Chrome, use
            Install app from the browser menu. On iPhone, tap Share, then Add to Home Screen.
          </p>
          <div className="mt-5">
            <InstallButton variant="primary" />
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 dark:border-white/15">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-sm opacity-60">
          <span>SpoolStack, a Kerf and Code project.</span>
          <Link href="/privacy" className="hover:opacity-100">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
