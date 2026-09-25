import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { PageIntro } from '@/components/site/ui';

export const metadata: Metadata = {
  title: 'Free 3D printing tools : SpoolStack',
  description: 'Free, no-sign-up tools for 3D printing, starting with a print cost calculator that counts filament, electricity, machine wear and failed prints.',
  alternates: { canonical: '/tools' },
};

const TOOLS = [
  {
    href: '/tools/print-cost-calculator',
    title: 'Print cost calculator',
    body: 'Filament, electricity, machine wear and your time for one print, per part, and per successful print once failures are counted.',
    tag: 'costing',
  },
];

export default function ToolsPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <PageIntro eyebrow="free tools" title="Free tools for 3D printing.">
          <p>No sign-up, nothing to install, and nothing you type is saved.</p>
        </PageIntro>

        <ul className="grid gap-6 md:grid-cols-2">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <Link href={tool.href} className="site-panel group block p-6 transition-transform hover:-translate-y-0.5">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-accent-text">; {tool.tag}</span>
                <h2 className="mt-3 text-xl font-semibold tracking-tight">{tool.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{tool.body}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                  Open the calculator
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                    &rarr;
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li className="rounded-[14px] border-[1.5px] border-dashed border-line p-6">
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">; more</span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-muted">More on the way</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Have a calculation you do by hand every time?{' '}
              <Link href="/contact" className="underline underline-offset-2 hover:text-ink">
                Tell us about it
              </Link>
              .
            </p>
          </li>
        </ul>
      </div>
    </SiteShell>
  );
}
