import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { ButtonLink, Eyebrow, PageIntro } from '@/components/site/ui';

export const metadata: Metadata = {
  title: 'About : SpoolStack',
  description: 'SpoolStack is made by Kerf and Code LLC, a small Washington studio that builds software and makes small-batch physical things.',
  alternates: { canonical: '/about' },
};

const PRINCIPLES = [
  {
    title: 'Measured, not guessed',
    body: 'A blank stays blank. A cost with a missing input says so, instead of hiding a zero inside a confident total.',
  },
  {
    title: 'Failures are data',
    body: 'The print that warped teaches more than the one that worked. Both go on the record, with what went wrong.',
  },
  {
    title: 'Your files stay yours',
    body: 'Slicer files are read on your device and never uploaded. Your runs are visible to your account and nobody else.',
  },
  {
    title: 'Light and free',
    body: 'No ads, no tracking scripts, no per-use AI bill to pass on. That is what lets it be free.',
  },
];

export default function AboutPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <PageIntro eyebrow="about" title="Made by people who print, for people who print.">
          <p>
            SpoolStack is made by Kerf and Code LLC, a small studio in Washington that builds software and makes
            small-batch physical things.
          </p>
        </PageIntro>

        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="max-w-2xl space-y-5 leading-relaxed text-muted">
            <p>
              It started as a spreadsheet: one row per print, with columns for the printer, the filament, the time,
              and whether it worked. It answered the questions that matter when you make things to sell or give away.
              What does this part cost me? Which settings gave the clean result last month? How often does this
              filament fail on this printer?
            </p>
            <p>
              The spreadsheet also had the usual problems. Typing every print in by hand is slow, so the failures
              were the first rows to go missing, and they were the rows that made the numbers honest.
            </p>
            <p>
              SpoolStack keeps the idea and removes the typing. The slicer file fills in most of a run, marking how
              it came out takes seconds at the printer, and the history builds itself into something you can search
              and, soon, cost.
            </p>
          </div>

          <div>
            <Eyebrow>how it is built</Eyebrow>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="rounded-xl border border-line bg-panel p-5">
                  <span aria-hidden="true" className="block h-1 w-8 rounded-full bg-accent" />
                  <h2 className="mt-3 font-semibold">{p.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap gap-3">
          <ButtonLink href="/sign-in">Start logging</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Get in touch
          </ButtonLink>
        </div>
      </div>
    </SiteShell>
  );
}
