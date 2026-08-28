import type { ReactNode } from 'react';

interface Props {
  title: string;
  description: string;
  index: number;
  children: ReactNode;
}

export function FormSection({ title, description, index, children }: Props) {
  return (
    <section className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <header className="mb-5">
        <h2 className="flex items-baseline gap-2.5 text-lg font-semibold text-ink">
          <span className="font-mono text-xs font-normal text-muted">{String(index).padStart(2, '0')}</span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
