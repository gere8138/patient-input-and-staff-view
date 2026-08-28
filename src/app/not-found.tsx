import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center text-ink">
      <p className="font-mono text-xs tracking-widest text-muted uppercase">Agnos</p>
      <h1 className="mt-3 text-2xl font-semibold">That intake link is not valid.</h1>
      <p className="mt-3 max-w-sm text-ink-soft">
        Session links look like <span className="font-mono">ABCD-2345</span>. Ask the front desk for a new one.
      </p>
      <Link
        href="/"
        className="mt-8 min-h-[44px] rounded-lg bg-accent px-5 leading-[44px] font-medium text-white"
      >
        Start again
      </Link>
    </main>
  );
}
