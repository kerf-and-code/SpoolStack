import Link from 'next/link';
import type { Metadata } from 'next';
import { InstallButton } from '@/components/install-button';
import { RunCardMock } from '@/components/site/mocks';
import { SiteShell } from '@/components/site/site-shell';
import { ButtonLink, Eyebrow, LayerRule } from '@/components/site/ui';
import { MACHINE_PRESETS, MATERIAL_PRESETS } from '@/lib/presets';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

// Server-rendered marketing page at /. The authenticated app lives under /app.
//
// Every claim on this page has to be true of the shipped app. Features that
// are planned but not built are marked as coming, not sold as done.

export const metadata: Metadata = {
  title: 'SpoolStack: a free run log for 3D printing',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

const STEPS = [
  {
    n: '01',
    title: 'Drop the slicer file',
    body: 'A .gcode from PrusaSlicer, OrcaSlicer or Bambu Studio, or a sliced .gcode.3mf, fills in the time, filament, temperatures and settings. Or type it in.',
  },
  {
    n: '02',
    title: 'Say how it came out',
    body: 'Success, partial, failure or aborted, how many parts were usable, and which defects showed up. Ten seconds at the printer.',
  },
  {
    n: '03',
    title: 'Read your own history',
    body: 'Filter by printer, filament, project and outcome. The settings from the print that came out right are one search away.',
  },
];

const HIGHLIGHTS = [
  {
    title: 'Import, not typing',
    body: 'The file is read on your device and never uploaded. Printer and filament are matched to your setup automatically.',
  },
  {
    title: 'Failures count',
    body: 'Partial plates, defects and aborted jobs go on the record, so your success rate is measured, not remembered.',
  },
  {
    title: 'Setup in a minute',
    body: `Pick from ${MACHINE_PRESETS.length} common printers and ${MATERIAL_PRESETS.length} filament types, or enter your own.`,
  },
  {
    title: 'Blank means unknown',
    body: 'Nothing is guessed. A missing price or power figure shows up as missing, never as a quiet zero in a total.',
  },
];

// Structured data for search engines. Escaping < keeps a stray "</script>"
// in any string from closing the tag early.
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
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <Eyebrow>run log for 3D printing</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            A run log for people who make things.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Every print in one record: what you ran, how it came out, and which settings actually worked. Built
            from your own history instead of someone else&rsquo;s defaults.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="/sign-in">Start logging, free</ButtonLink>
            <ButtonLink href="/tools/print-cost-calculator" variant="secondary">
              Print cost calculator
            </ButtonLink>
          </div>
          <p className="mt-5 font-mono text-xs text-muted">
            No card. No ads. Works on your phone at the printer.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          {/* The stacked layers from the logo, as a backdrop. */}
          <div aria-hidden="true" className="absolute inset-x-6 -bottom-6 flex flex-col items-center gap-2 opacity-60">
            <span className="h-3 w-4/5 rounded-full bg-ink/10" />
            <span className="h-3 w-11/12 rounded-full bg-ink/10" />
            <span className="h-3 w-full rounded-full bg-ink/10" />
          </div>
          <RunCardMock className="relative rotate-[-1.5deg]" />
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-panel/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Eyebrow>how it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Logging a print takes under a minute.</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="font-mono text-sm font-semibold text-accent-text">{step.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>features</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
              Built around the print that failed, not just the one that worked.
            </h2>
          </div>
          <ButtonLink href="/features" variant="secondary" size="sm">
            See every feature
          </ButtonLink>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-xl border border-line bg-panel p-5">
              <span aria-hidden="true" className="block h-1 w-8 rounded-full bg-accent" />
              <h3 className="mt-4 font-semibold">{h.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      <LayerRule />

      {/* Free tool */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="site-panel grid gap-8 p-6 sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <Eyebrow>free tool</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">What did that print actually cost?</h2>
            <p className="mt-4 text-muted">
              Filament, electricity, machine wear and your time, with failed prints spread over the ones that
              worked. No sign-up, and it uses the same maths as SpoolStack&rsquo;s upcoming run costing.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/tools/print-cost-calculator">Open the calculator</ButtonLink>
              <ButtonLink href="/tools" variant="secondary">
                All free tools
              </ButtonLink>
            </div>
          </div>
          <figure>
          <dl className="grid grid-cols-2 gap-4 font-mono text-sm">
            {[
              ['filament', '$2.72'],
              ['electricity', '$0.05'],
              ['machine wear', '$0.36'],
              ['per good part', '$3.91'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line px-3 py-2.5">
                <dt className="text-[11px] uppercase tracking-wider text-muted">{k}</dt>
                <dd className="mt-1 text-lg font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <figcaption className="mt-3 font-mono text-[11px] text-muted">
            ; the 4h 27m print above, at an 80% success rate
          </figcaption>
          </figure>
        </div>
      </section>

      {/* Install */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 rounded-xl border border-line bg-panel p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Eyebrow>on your phone</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Keep it on your home screen.</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              SpoolStack installs like an app and opens straight to your log. On Android or desktop Chrome, use
              Install app from the browser menu. On iPhone, tap Share, then Add to Home Screen.
            </p>
          </div>
          <InstallButton variant="primary" />
        </div>
      </section>

      {/* Closing call to action */}
      <section className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Log your next print.</h2>
            <p className="mt-2 max-w-lg text-paper/70">
              Free to use. Sign in with Google or an email link, and your first run takes a minute.
            </p>
          </div>
          <Link
            href="/sign-in"
            className="btn btn-primary"
            style={{ borderColor: 'var(--site-paper)', boxShadow: '0 4px 0 0 var(--site-paper)' }}
          >
            Start logging
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
