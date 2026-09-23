import Link from 'next/link';

// Server-rendered marketing page at /. The authenticated app lives under /app.
// This split exists from day one on purpose: a client-rendered shell is
// invisible to crawlers, and retrofitting that later is a month of work.

const PILLARS = [
  {
    title: 'One log, not four apps',
    body: 'A run is a run, whether it is a print, a cut or a laser pass. Same record shape every time, so the history stays comparable as you add machines.',
  },
  {
    title: 'Logging in under a minute',
    body: 'Drop a gcode file and the form fills itself: time, filament used, temperatures, layer height. Manual entry stays for the jobs that have no file.',
  },
  {
    title: 'Costs you can defend',
    body: 'Material, energy, machine wear and labour are computed from raw measurements at read time. Change a filament price and every past run recosts correctly.',
  },
  {
    title: 'Failure rates that are real',
    body: 'Your logged failures, not an assumed yield. A quoted price built on a made-up success rate is a guess wearing a number.',
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
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
            Every print, cut and job in one record. What it cost, what went wrong, and
            which settings actually worked, built from your own history instead of
            someone else&rsquo;s defaults.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/sign-in"
              className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background"
            >
              Start logging
            </Link>
            <span className="text-sm opacity-60">
              Free while it is in development.
            </span>
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
      </main>

      <footer className="border-t border-black/10 dark:border-white/15">
        <div className="mx-auto max-w-5xl px-6 py-6 text-sm opacity-60">
          SpoolStack, a Kerf and Code project.
        </div>
      </footer>
    </div>
  );
}
