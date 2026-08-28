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
  const heading = (
    <span className="flex items-baseline gap-2 text-sm leading-5 font-medium text-ink">
      {label}
      {!required && <span className="text-xs font-normal text-muted">Optional</span>}
    </span>
  );

  /**
   * Every field reserves one line here whether or not it has anything to say.
   * An error appearing, or the age hint resolving, must never nudge the field
   * beside it or the ones below it.
   */
  const message = (
    <span className="block min-h-5 text-xs leading-5">
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-alert">
          {error}
        </span>
      ) : help ? (
        <span id={`${id}-help`} className="text-ink-soft">
          {help}
        </span>
      ) : null}
    </span>
  );

  if (as === 'group') {
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5">{heading}</legend>
        {children}
        {message}
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>{heading}</label>
      {children}
      {message}
    </div>
  );
}

/** Only one of the two is ever rendered, so only one is ever referenced. */
export function describedBy(id: string, help?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  return help ? `${id}-help` : undefined;
}
