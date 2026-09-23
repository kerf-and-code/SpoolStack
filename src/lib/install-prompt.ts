// Shared by the root layout (which captures the browser's install prompt)
// and the Install app button (which shows it).
//
// Chromium browsers fire `beforeinstallprompt` once, early, often before
// React has hydrated. A listener added in a component would miss it, so a
// tiny inline script in the root layout catches it first and parks it on
// window. The button reads it from there and re-renders on a custom event.
//
// Safari (iPhone and iPad) never fires the event and cannot be prompted from
// a web page, so the button shows the Share, Add to Home Screen steps there.

/** Fired on window whenever the parked prompt appears or is used up. */
export const INSTALL_CHANGE_EVENT = 'ss-install-change';

/** Not in the TypeScript DOM library, because it is Chromium-only. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __ssInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/**
 * Runs before hydration. preventDefault() stops Chrome's own mini install bar
 * so the prompt can be offered from the button instead.
 */
export const INSTALL_CAPTURE_SCRIPT = `(function () {
  window.__ssInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__ssInstallPrompt = e;
    window.dispatchEvent(new Event('${INSTALL_CHANGE_EVENT}'));
  });
  window.addEventListener('appinstalled', function () {
    window.__ssInstallPrompt = null;
    window.dispatchEvent(new Event('${INSTALL_CHANGE_EVENT}'));
  });
})();`;
