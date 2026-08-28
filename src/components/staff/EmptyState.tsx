'use client';

import { useState } from 'react';
import { newSessionId } from '@/lib/realtime/events';

export function EmptyState() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const makeLink = () => {
    const url = `${window.location.origin}/form/${newSessionId()}`;
    setLink(url);
    setCopied(false);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-console-line px-6 py-10 text-center">
      <p className="text-console-ink">No patients are filling in a form right now.</p>
      <p className="mt-2 text-sm text-muted">
        Hand a patient a link and their answers will appear here as they type.
      </p>

      {link ? (
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
          <code className="truncate rounded-lg border border-console-line bg-console px-3 py-2 text-left font-mono text-xs text-console-ink">
            {link}
          </code>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="min-h-[40px] rounded-lg border border-console-line px-4 text-sm text-console-ink hover:border-signal/50"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="min-h-[40px] rounded-lg bg-signal px-4 text-sm leading-10 font-medium text-console"
            >
              Open it here
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={makeLink}
          className="mt-6 min-h-[40px] rounded-lg bg-signal px-4 text-sm font-medium text-console"
        >
          Create an intake link
        </button>
      )}
    </div>
  );
}
