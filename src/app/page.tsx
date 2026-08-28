'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { newSessionId } from '@/lib/realtime/events';

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-paper px-6 py-16 text-ink">
      <div className="mx-auto w-full max-w-lg">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">Agnos</p>
        <h1 className="mt-3 text-3xl font-semibold text-balance sm:text-4xl">
          Patient intake form , watched live from the front desk.
        </h1>
        <p className="mt-4 text-ink-soft">
          The patient fills in the form. Staff see every answer appear as it is typed, and who is
          still working through it.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push(`/form/${newSessionId()}`)}
            className="min-h-[48px] rounded-xl bg-accent px-5 font-medium text-white transition-opacity hover:opacity-90"
          >
            Start a patient form
          </button>
          <Link
            href="/staff"
            className="min-h-[48px] rounded-xl border border-line bg-paper-raised px-5 text-center leading-[46px] font-medium text-ink transition-colors hover:border-accent/50"
          >
            Open the staff console
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted">
          Try it with two windows side by side — the console updates without a refresh.
        </p>
      </div>
    </main>
  );
}
