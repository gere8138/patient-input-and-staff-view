import type { ReactNode } from 'react';

export const inputClass =
  'w-full min-h-[44px] rounded-lg border bg-paper-raised px-3 py-2 text-ink transition-colors ' +
  'placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none';

export function controlClass(hasError: boolean): string {
  return `${inputClass} ${hasError ? 'border-alert' : 'border-line'}`;
}

interface FieldShellProps {
  id: string;
  label: string;
  required: boolean;
  help?: string;
  error?: string;
  children: ReactNode;
  /** Radio groups need a fieldset/legend rather than a label. */
  as?: 'label' | 'group';
}

export function FieldShell({
  id,
  label,
  required,
  help,
  error,
  children,
  as = 'label',
}: FieldShellProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const heading = (
    <span className="flex items-baseline gap-2 text-sm font-medium text-ink">
      {label}
      {!required && <span className="text-xs font-normal text-muted">Optional</span>}
    </span>
  );

  const body = (
    <>
      {help && (
        <span id={helpId} className="block text-xs text-ink-soft">
          {help}
        </span>
      )}
      {children}
      {error && (
        <span id={errorId} role="alert" className="block text-sm text-alert">
          {error}
        </span>
      )}
    </>
  );

  if (as === 'group') {
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5">{heading}</legend>
        {body}
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>{heading}</label>
      {body}
    </div>
  );
}

export function describedBy(id: string, help?: string, error?: string): string | undefined {
  const ids = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}
