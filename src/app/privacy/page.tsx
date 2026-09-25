import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteShell } from '@/components/site/site-shell';
import { PageIntro } from '@/components/site/ui';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy : SpoolStack',
  description: 'What SpoolStack stores, where it is kept, and how to have it deleted.',
  alternates: { canonical: '/privacy' },
};

// Written to match what the code actually does. If a feature changes
// what is collected (photos, analytics, error reporting, payments), this page
// changes in the same commit.
const UPDATED = 'September 23, 2026';

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
        <PageIntro eyebrow="privacy" title="Privacy">
          <p className="font-mono text-sm">Last updated {UPDATED}</p>
        </PageIntro>

        <div className="space-y-10 rounded-xl border border-line bg-panel p-6 text-sm leading-relaxed sm:p-8 [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:text-muted [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted">
          <section>
            <h2>The short version</h2>
            <p>
              {SITE_NAME} is run by Kerf and Code LLC. It stores what you type into it so it can show it back to
              you, and nothing else. No advertising, no analytics trackers, no selling or sharing your data.
            </p>
          </section>

          <section>
            <h2>What is stored</h2>
            <ul>
              <li>Your email address, used to sign you in. If you sign in with Google, Google shares your email address and basic profile with us for that purpose.</li>
              <li>The records you create: machines, materials, projects, runs, defects, notes and settings such as your currency and electricity rate.</li>
              <li>Print settings pulled from a slicer file when you use import, such as layer height, temperatures and filament used.</li>
            </ul>
          </section>

          <section>
            <h2>What is not stored</h2>
            <ul>
              <li>Slicer files. When you import a .gcode or .3mf file it is read in your browser and only the values shown in the form are saved. The file itself never leaves your device.</li>
              <li>Payment details. {SITE_NAME} does not take payments.</li>
              <li>Tracking data. There are no analytics, advertising or social media scripts on this site.</li>
            </ul>
          </section>

          <section>
            <h2>If you contact us</h2>
            <p>
              Messages sent through the{' '}
              <Link href="/contact" className="underline underline-offset-2">
                contact form
              </Link>{' '}
              are emailed to us through Resend, an email delivery service, with the name and email address you
              enter so we can reply. They are not added to any mailing list.
            </p>
          </section>

          <section>
            <h2>Free tools</h2>
            <p>
              The calculators under Free tools run in your browser and save nothing. The numbers you enter are kept
              in the page address, so a link you share includes them.
            </p>
          </section>

          <section>
            <h2>Cookies</h2>
            <p>
              {SITE_NAME} sets only the cookies needed to keep you signed in. They are not used for tracking and
              are removed when you sign out.
            </p>
          </section>

          <section>
            <h2>Where your data lives</h2>
            <p>
              Your records are stored in a Supabase database hosted in the United States, and the site is served
              by Vercel. Both act as service providers and process data only to run {SITE_NAME}. Each account can
              read only its own records; this is enforced by the database, not just the app.
            </p>
          </section>

          <section>
            <h2>Deleting your data</h2>
            <p>
              You can delete individual records from inside the app at any time. To delete your whole account and
              everything in it, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>{' '}
              from the address you sign in with, and it will be removed.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              If {SITE_NAME} starts collecting something new, this page will say so before it happens, and the
              date at the top will change.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions go to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}
