import Link from 'next/link';

export function SubmittedScreen({ reference, name }: { reference: string; name: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-ok/15 text-ok"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12.5 9.5 18 20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-ink">Thank you{name ? `, ${name}` : ''}.</h1>
      <p className="mt-3 text-ink-soft">
        Your details are with the front desk. Please take a seat — a member of staff will call you shortly.
      </p>
      <p className="mt-8 text-xs tracking-wide text-muted uppercase">Form ID</p>
      <p className="font-mono text-xl tracking-widest text-ink">{reference}</p>
      <Link
        href="/"
        className="mt-10 text-sm text-accent underline underline-offset-4 hover:no-underline"
      >
        Start another intake
      </Link>
    </div>
  );
}
