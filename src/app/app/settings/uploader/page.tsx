import type { Metadata } from 'next';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { LocalTime } from '@/components/local-time';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/auth';
import { revokeUploadToken } from './actions';
import { TokenCreator } from './token-creator';

export const metadata: Metadata = { title: 'Slicer uploader : SpoolStack' };

const SCRIPT_PATH = '/downloads/spoolstack_upload.py';

const SLICERS = [
  {
    name: 'PrusaSlicer',
    where: 'Print Settings, Output options, Post-processing scripts. Switch to Expert mode if you do not see it.',
  },
  {
    name: 'OrcaSlicer',
    where: 'Process settings, Others, Post-processing Scripts. Turn on Advanced if you do not see it.',
  },
  {
    name: 'Bambu Studio',
    where: 'Process settings, Others, Post-processing scripts. Turn on Advanced if you do not see it.',
  },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{title}</h2>
        <div className="mt-2 space-y-2 text-sm opacity-85">{children}</div>
      </div>
    </li>
  );
}

const code = 'block overflow-x-auto rounded bg-black/5 p-3 font-mono text-xs dark:bg-white/10';

export default async function UploaderPage() {
  const { supabase } = await requireUser();
  const { data: tokens } = await supabase
    .from('upload_tokens')
    .select('id, name, token_prefix, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false });

  const active = (tokens ?? []).filter((t) => !t.revoked_at);
  const revoked = (tokens ?? []).filter((t) => t.revoked_at);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Slicer uploader"
        back={{ href: '/app/settings', label: 'Settings' }}
        description="Every file you slice shows up on your dashboard under Did it print?, already filled in. One tap logs it."
      />

      <ol className="mt-6 space-y-8">
        <Step n={1} title="Create a token for this computer">
          <p>The token lets the script add files to your account, and nothing else. Make one per computer you slice on.</p>
          <TokenCreator />
        </Step>

        <Step n={2} title="Save the script">
          <p>
            <a href={SCRIPT_PATH} download className="font-medium underline underline-offset-2">
              Download spoolstack_upload.py
            </a>{' '}
            and save it somewhere it will stay, such as a SpoolStack folder in your Documents. It needs Python 3.8 or
            newer (free from python.org) and nothing else.
          </p>
          <p>
            It reads the settings part of each sliced file (print time, filament, every slicer setting) and sends that.
            Never the model, never the moves, and it never changes the gcode. If SpoolStack cannot be reached, it keeps
            the upload and sends it after your next slice, so a slice never fails because of it.
          </p>
        </Step>

        <Step n={3} title="Connect it, once">
          <p>
            Open Command Prompt (or Terminal) in the folder with the script and paste the command shown after you create
            the token. On Windows, use <code className="font-mono">py</code> instead of{' '}
            <code className="font-mono">python</code> if that is what works on your PC. It should answer:
          </p>
          <code className={code}>Connected. This PC uploads as &quot;My PC&quot;.</code>
          <p>
            The token is saved in a <code className="font-mono">.spoolstack</code> folder in your home folder, not in the
            slicer: slicers copy their post-processing line into every gcode file, and a token there would travel with
            every file you share.
          </p>
        </Step>

        <Step n={4} title="Add it to your slicer">
          <p>Paste one line into the post-processing scripts box, with the full paths to Python and to the script:</p>
          <code className={code}>
            &quot;C:\Users\you\AppData\Local\Programs\Python\Python312\python.exe&quot;
            &quot;C:\Users\you\Documents\SpoolStack\spoolstack_upload.py&quot;
          </code>
          <p className="text-xs opacity-75">
            That is one line with a space between the two paths. To find your Python path on Windows, run{' '}
            <code className="font-mono">where python</code> in Command Prompt. On a Mac it is usually{' '}
            <code className="font-mono">/usr/bin/python3</code>.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {SLICERS.map((s) => (
              <li key={s.name}>
                <span className="font-medium">{s.name}:</span> {s.where}
              </li>
            ))}
          </ul>
          <p>
            Then slice anything. It should appear on your dashboard within a few seconds. If it does not, the script
            keeps a log at <code className="font-mono">.spoolstack/upload.log</code> in your home folder that says why.
          </p>
        </Step>
      </ol>

      <section className="mt-12 border-t border-black/10 pt-6 dark:border-white/15">
        <h2 className="text-base font-semibold">Your tokens</h2>
        {active.length === 0 ? (
          <p className="mt-2 text-sm opacity-65">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
            {active.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{t.name}</span>{' '}
                  <span className="font-mono text-xs opacity-60">{t.token_prefix}...</span>
                  <span className="block text-xs opacity-60">
                    Created <LocalTime iso={t.created_at} withTime={false} />
                    {', '}
                    {t.last_used_at ? (
                      <>
                        last upload <LocalTime iso={t.last_used_at} />
                      </>
                    ) : (
                      'not used yet'
                    )}
                  </span>
                </div>
                <form action={revokeUploadToken.bind(null, t.id)}>
                  <ConfirmSubmit
                    message={`Revoke the token for "${t.name}"? The script on that computer stops working until you set it up with a new token.`}
                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10 dark:text-red-400"
                  >
                    Revoke
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
        {revoked.length > 0 ? (
          <p className="mt-3 text-xs opacity-60">
            Revoked: {revoked.map((t) => `${t.name} (${t.token_prefix}...)`).join(', ')}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
