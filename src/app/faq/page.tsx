import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { ButtonLink, PageIntro } from '@/components/site/ui';
import { MACHINE_PRESETS } from '@/lib/presets';

export const metadata: Metadata = {
  title: 'FAQ : SpoolStack',
  description:
    'Is SpoolStack free, which slicers and printers it supports, whether files are uploaded, where data is stored, and how costs are worked out.',
  alternates: { canonical: '/faq' },
};

interface Qa {
  q: string;
  a: React.ReactNode;
}

const link = 'font-medium text-ink underline underline-offset-2';

const SECTIONS: { title: string; items: Qa[] }[] = [
  {
    title: 'The basics',
    items: [
      {
        q: 'Is SpoolStack free?',
        a: (
          <>
            <p>
              Yes. There is no paid plan, no trial and no card. SpoolStack is cheap to run because it does no AI
              or other paid processing for each thing you do.
            </p>
            <p>
              If a feature that costs money every time it runs is ever added, such as diagnosing a failed print
              from a photo, that feature may be paid. Logging your prints will not be.
            </p>
          </>
        ),
      },
      {
        q: 'What is a run?',
        a: (
          <p>
            One job on one machine: a single print, whether it worked or not. Each run keeps the printer, filament,
            project, time, filament used, the settings, how it came out, and any defects.
          </p>
        ),
      },
      {
        q: 'Does it work on my phone?',
        a: (
          <p>
            Yes, and it is designed to be used standing at the printer. It installs to your home screen like an app:
            on Android use Install app from the Chrome menu, and on iPhone tap Share, then Add to Home Screen.
          </p>
        ),
      },
      {
        q: 'How do I sign in?',
        a: <p>With Google, or with a one-time link sent to your email. There is no password to remember.</p>,
      },
    ],
  },
  {
    title: 'Slicers and printers',
    items: [
      {
        q: 'Which slicer files can it read?',
        a: (
          <>
            <p>
              Plain .gcode from PrusaSlicer, OrcaSlicer and Bambu Studio, and sliced .gcode.3mf project files from
              Bambu Studio and OrcaSlicer. Cura files work too, with fewer settings, because Cura writes little
              about its settings into the file.
            </p>
            <p>
              Prusa&rsquo;s binary .bgcode is not supported yet. Export plain .gcode instead, or type the run in.
            </p>
          </>
        ),
      },
      {
        q: 'Is my slicer file uploaded?',
        a: (
          <p>
            No. The file is read in your browser, and only the values you see in the form are saved when you save
            the run. The file itself never leaves your device.
          </p>
        ),
      },
      {
        q: 'Which printers does it support?',
        a: (
          <p>
            Any FDM printer. {MACHINE_PRESETS.length} common models from Bambu Lab, Prusa, Creality, Elegoo,
            Anycubic, QIDI and Sovol have presets that fill in their specs, and any other printer takes a minute to
            add by hand.
          </p>
        ),
      },
      {
        q: 'What about resin, CNC or laser?',
        a: (
          <p>
            Not yet. SpoolStack is built so other processes can be added as data rather than a rewrite, and they are
            planned after FDM is solid.
          </p>
        ),
      },
      {
        q: 'Do I have to import a file?',
        a: (
          <p>
            No. Every field can be typed, and &ldquo;Copy from last run&rdquo; makes repeat jobs quick. Import just
            saves the typing.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Your data',
    items: [
      {
        q: 'Who can see my runs?',
        a: (
          <p>
            Only you. Each account can read only its own records, and that is enforced by the database itself, not
            just by the app. See the{' '}
            <Link href="/privacy" className={link}>
              privacy page
            </Link>{' '}
            for what is stored and where.
          </p>
        ),
      },
      {
        q: 'Can I delete my data?',
        a: (
          <p>
            Any run can be edited or deleted at any time. To delete your whole account and everything in it,{' '}
            <Link href="/contact" className={link}>
              contact us
            </Link>{' '}
            from the address you sign in with.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Costs',
    items: [
      {
        q: 'How are costs worked out?',
        a: (
          <p>
            From filament used and its price per gram, print time with your printer&rsquo;s power draw and your
            electricity rate, printer wear per printing hour, and your time if you want it counted. The{' '}
            <Link href="/tools/print-cost-calculator" className={link}>
              print cost calculator
            </Link>{' '}
            shows the formulas and works without an account.
          </p>
        ),
      },
      {
        q: 'Why does a cost say incomplete?',
        a: (
          <p>
            Because something it needs was left blank, and SpoolStack never fills a blank with a guess or a zero.
            The missing input is named so you can add it, and once you do, every past run that depends on it is
            corrected too.
          </p>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <PageIntro eyebrow="faq" title="Questions, answered plainly." />

        <div className="space-y-12">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-accent-text">; {section.title}</h2>
              <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-panel">
                {section.items.map((item) => (
                  <details key={item.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span
                        aria-hidden="true"
                        className="shrink-0 font-mono text-lg leading-none text-muted transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{item.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start gap-4 rounded-xl border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">Something not covered?</span>{' '}
            <span className="text-muted">Ask, and the answer may end up here.</span>
          </p>
          <ButtonLink href="/contact" variant="secondary" size="sm">
            Contact
          </ButtonLink>
        </div>
      </div>
    </SiteShell>
  );
}
