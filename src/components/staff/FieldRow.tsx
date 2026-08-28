'use client';

import { useEffect, useRef, useState } from 'react';
import { displayValue, type FieldSpec } from '@/lib/fields';

interface Props {
  spec: FieldSpec;
  value: string | undefined;
  isActive: boolean;
}

export function FieldRow({ spec, value, isActive }: Props) {
  const shown = displayValue(spec.key, value);
  const [flash, setFlash] = useState(false);
  const previous = useRef(shown);

  useEffect(() => {
    if (previous.current === shown) return;
    previous.current = shown;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <div
      className={`flex items-start gap-3 rounded-md px-2 py-2 ${flash ? 'animate-flash' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 h-3.5 w-[2px] shrink-0 rounded-full ${
          isActive ? 'animate-caret bg-signal' : 'bg-transparent'
        }`}
      />
      <span className="w-[40%] max-w-[11rem] shrink-0 text-xs leading-6 text-muted">
        {spec.label}
        {spec.required && <span className="text-alert"> *</span>}
      </span>
      <span
        className={`min-w-0 flex-1 font-mono text-sm leading-6 break-words ${
          shown ? 'text-console-ink' : 'text-muted/60 italic'
        }`}
      >
        {shown || (isActive ? 'typing…' : '—')}
      </span>
    </div>
  );
}
