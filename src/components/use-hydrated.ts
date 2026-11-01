'use client';

// True once React has hydrated this page in the browser, false in the server
// HTML and during hydration itself.
//
// Before hydration a button's onClick is not attached yet, so a tap does
// nothing (an onClick-only button) or skips the client-side checks (a submit
// button whose form posts on its own). Buttons that depend on their handler
// read this and stay disabled until it is true, so they never look ready
// while they are not.
//
// useSyncExternalStore gives the server snapshot (false) during SSR and
// hydration and the client snapshot (true) afterwards, with no effect and no
// hydration mismatch. The store never changes, so subscribe is a no-op.

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
