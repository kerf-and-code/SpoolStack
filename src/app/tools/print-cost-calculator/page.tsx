import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { Eyebrow, PageIntro } from '@/components/site/ui';
import { PrintCostCalculator } from '@/components/tools/print-cost-calculator';
import { valuesFromQuery } from '@/lib/cost-calculator';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: '3D Print Cost Calculator: filament, electricity and wear : SpoolStack',
  description:
    'Work out what a 3D print really costs: filament, electricity, printer wear and your time, per part, with failed prints counted. Free, no sign-up.',
  alternates: { canonical: '/tools/print-cost-calculator' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '3D Print Cost Calculator',
  url: `${SITE_URL}/tools/print-cost-calculator`,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: 'Kerf and Code LLC' },
};

// The explanation below the calculator is the part search engines read, and
// the part that answers the questions people actually search for.
const GUIDE = [
  {
    q: 'How is the cost of a 3D print calculated?',
    a: [
      'Four parts, each only counted when you give its inputs:',
      'Filament: grams used times the price per gram, where price per gram is the spool price divided by the filament weight on it.',
      'Electricity: print hours times the printer’s average power in kilowatts times your price per kWh.',
      'Machine wear: print hours times the printer price divided by the hours it will print in its life, plus any maintenance cost per hour.',
      'Your time: hands-on minutes times your hourly rate, if you want labour counted.',
    ],
  },
  {
    q: 'Why count failed prints?',
    a: [
      'A failed print used filament and power and produced nothing to show for it. If one print in five fails, each good one really carries a quarter of a failure on top of its own cost.',
      'Enter a success rate and the calculator spreads that cost over the prints that worked. It is usually the biggest correction to a naive number, and the one most price lists leave out.',
    ],
  },
  {
    q: 'What power figure should I use?',
    a: [
      'The average draw while printing, measured with a plug-in power meter. The number on the power supply is the maximum it can deliver, which a printer only approaches while the bed heats up.',
      'Enclosure, bed temperature and room temperature all move it, so a measured number for your own setup beats any published figure.',
    ],
  },
  {
    q: 'What should expected life be?',
    a: [
      'The printing hours you expect before replacing the printer, not the years you will own it. Machine wear is often a small line on its own, but on long prints it adds up, and leaving it out is how printing for others ends up quietly subsidised.',
    ],
  },
  {
    q: 'Is anything I type sent anywhere?',
    a: [
      'The calculation runs in your browser and nothing is saved. The numbers are kept in the page address so that Copy link can share them, which also means anyone you send the link to sees them.',
    ],
  },
];

export default async function PrintCostCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = valuesFromQuery(await searchParams);

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="pt-8 font-mono text-xs text-muted">
          <Link href="/tools" className="hover:text-ink">
            Free tools
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Print cost calculator</span>
        </nav>
        <PageIntro eyebrow="free tool" title="3D print cost calculator">
          <p>
            What a print really cost: filament, electricity, machine wear and your time, per part, with the failed
            prints paid for by the ones that worked. Fill in what you know; blanks are left out, not guessed.
          </p>
        </PageIntro>

        <PrintCostCalculator initial={initial} />

        <section className="mx-auto max-w-3xl py-24">
          <Eyebrow>how it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">The maths, and the numbers to use.</h2>
          <div className="mt-8 space-y-10">
            {GUIDE.map((item) => (
              <div key={item.q}>
                <h3 className="text-lg font-semibold">{item.q}</h3>
                <div className="mt-3 space-y-3 leading-relaxed text-muted">
                  {item.a.map((para) => (
                    <p key={para}>{para}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-12 rounded-xl border border-line bg-panel p-5 text-sm text-muted">
            This calculator uses the same formulas as SpoolStack&rsquo;s run costing, which is coming next in the app.
            There, the inputs come from your logged prints and your real success rate instead of estimates.{' '}
            <Link href="/features" className="font-medium text-ink underline underline-offset-2">
              See what the app does
            </Link>
            .
          </p>
        </section>
      </div>
    </SiteShell>
  );
}
