'use client';

// "Install app" button. Three cases:
//   * Chrome, Edge, Samsung Internet (Android and desktop): opens the
//     browser's own install dialog, using the prompt the root layout parked.
//   * iPhone and iPad: web pages cannot trigger an install there, so the
//     button opens the two Share-sheet steps instead.
//   * Already installed and running as the app, or a browser with neither
//     (Firefox desktop, for one): renders nothing.
//
// useSyncExternalStore keeps it hydration-safe: the server and the first
// client render both see "hidden", then the real state takes over.

import { useState, useSyncExternalStore } from 'react';
import { INSTALL_CHANGE_EVENT } from '@/lib/install-prompt';

type Mode = 'hidden' | 'prompt' | 'ios';

const STANDALONE_QUERY = '(display-mode: standalone)';

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(STANDALONE_QUERY).matches;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function getSnapshot(): Mode {
  if (isStandalone()) return 'hidden';
  if (window.__ssInstallPrompt) return 'prompt';
  if (isIos()) return 'ios';
  return 'hidden';
}

function getServerSnapshot(): Mode {
  return 'hidden';
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(STANDALONE_QUERY);
  window.addEventListener(INSTALL_CHANGE_EVENT, onChange);
  media.addEventListener('change', onChange);
  return () => {
    window.removeEventListener(INSTALL_CHANGE_EVENT, onChange);
    media.removeEventListener('change', onChange);
  };
}

const STYLES = {
  primary: 'rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background',
  secondary:
    'rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10',
};

export function InstallButton({
  variant = 'secondary',
  align = 'left',
}: {
  variant?: 'primary' | 'secondary';
  /** Which edge the iPhone instructions line up with. */
  align?: 'left' | 'right';
}) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [showSteps, setShowSteps] = useState(false);

  if (mode === 'hidden') return null;

  async function install() {
    const deferred = window.__ssInstallPrompt;
    if (!deferred) return;
    // A prompt can be shown only once. Clear it first so the button hides
    // while the dialog is up; Chrome fires a fresh one later if dismissed.
    window.__ssInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));
    await deferred.prompt();
    await deferred.userChoice;
  }

  if (mode === 'prompt') {
    return (
      <button type="button" onClick={install} className={STYLES[variant]}>
        Install app
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowSteps((open) => !open)}
        aria-expanded={showSteps}
        aria-controls="install-steps"
        className={STYLES[variant]}
      >
        Install app
      </button>
      {showSteps ? (
        <div
          id="install-steps"
          role="dialog"
          aria-label="Add SpoolStack to your home screen"
          // Phones: a sheet along the bottom edge, next to where Safari keeps
          // the Share button, and never clipped by a wrapped header row.
          // Wider screens: a popover under the button.
          className={
            'fixed inset-x-4 bottom-4 z-30 rounded-lg border border-black/15 bg-background p-4 text-left text-sm shadow-lg dark:border-white/20 ' +
            'sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:w-72 ' +
            (align === 'right' ? 'sm:right-0' : 'sm:left-0')
          }
        >
          <p className="font-medium">Add SpoolStack to your home screen</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 opacity-80">
            <li>
              Tap the <span className="font-medium">Share</span> button, the square with an arrow pointing up.
            </li>
            <li>
              Scroll down and tap <span className="font-medium">Add to Home Screen</span>, then{' '}
              <span className="font-medium">Add</span>.
            </li>
          </ol>
          <p className="mt-2 text-xs opacity-60">
            It opens straight to your log, full screen, like any other app.
          </p>
          <button
            type="button"
            onClick={() => setShowSteps(false)}
            className="mt-3 text-xs font-medium underline underline-offset-2"
          >
            Got it
          </button>
        </div>
      ) : null}
    </div>
  );
}
