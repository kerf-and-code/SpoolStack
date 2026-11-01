'use client';

// A submit button that asks before it submits. For destructive actions only.
//
// Disabled until hydration: before that the onClick confirm is not attached,
// and the form (a Server Action, which works without JavaScript) would submit
// straight away with no question asked. After the tap it shows pendingLabel
// and stays disabled until the action finishes, so a slow network never
// leaves a button that looks ready but ignores taps, or submits twice.
//
// useFormStatus reads the parent <form>, so this must render inside one.

import { useFormStatus } from 'react-dom';
import { useHydrated } from './use-hydrated';

export function ConfirmSubmit({
  children,
  message,
  className,
  pendingLabel = 'Deleting...',
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  pendingLabel?: string;
}) {
  const hydrated = useHydrated();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={!hydrated || pending}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
