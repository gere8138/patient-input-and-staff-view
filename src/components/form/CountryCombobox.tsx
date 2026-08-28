'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COUNTRIES, COUNTRY_BY_ISO, dialCode, flagEmoji, type Country } from '@/lib/countries';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';

interface Props {
  value: string;
  onChange: (iso: string) => void;
  /** Announced to screen readers, e.g. "Phone number country". */
  label: string;
  hasError?: boolean;
}

/** Lowercase and strip accents so "cote" finds "Côte d'Ivoire". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Thailand first, then the rest alphabetically. */
const ORDERED: Country[] = [
  ...COUNTRIES.filter((c) => c.iso === DEFAULT_PHONE_COUNTRY),
  ...COUNTRIES.filter((c) => c.iso !== DEFAULT_PHONE_COUNTRY),
];

function search(query: string): Country[] {
  const q = fold(query.trim()).replace(/^\+/, '');
  if (!q) return ORDERED;
  const digits = /^\d+$/.test(q);

  const scored = ORDERED.map((country) => {
    const name = fold(country.name);
    const nationality = fold(country.nationality);
    const iso = fold(country.iso);
    let score = -1;

    if (digits) {
      // Typing a dial code: exact first, then codes that start with it. The
      // main country on a shared code wins, so "44" offers the UK before Jersey.
      if (country.dial === q) score = country.primary ? 0 : 1;
      else if (country.dial.startsWith(q)) score = country.primary ? 2 : 3;
    } else {
      if (iso === q) score = 0;
      else if (name.startsWith(q)) score = 1;
      else if (nationality.startsWith(q)) score = 2;
      else if (name.includes(q)) score = 3;
      else if (nationality.includes(q)) score = 4;
    }
    return { country, score };
  });

  return scored
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.country);
}

export function CountryCombobox({ value, onChange, label, hasError }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const results = useMemo(() => search(query), [query]);
  const selected = COUNTRY_BY_ISO[value];

  // Close when the click lands outside the whole control.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const index = Math.max(0, results.findIndex((c) => c.iso === value));
    setHighlighted(index);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the active option in view while arrowing through 245 of them.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const commit = (iso: string) => {
    onChange(iso);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const choice = results[highlighted];
      if (choice) commit(choice.iso);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-[108px] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}. Selected: ${selected?.name ?? value}`}
        className="flex h-full w-full items-center gap-1.5 rounded-l-lg py-2 pr-6 pl-3 text-left"
      >
        <span className="text-base leading-none">{flagEmoji(value)}</span>
        <span className="font-mono text-sm text-ink">{dialCode(value)}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className="pointer-events-none absolute right-2 h-2 w-3 fill-ink-soft"
        >
          <path d="M1 1l5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-paper-raised shadow-lg">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={`Search ${label.toLowerCase()} by name or dialling code`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Country or code, e.g. 66"
            className="w-full border-b border-line px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none"
          />

          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">No country matches “{query}”.</li>
            )}
            {results.map((country, index) => {
              const active = index === highlighted;
              return (
                <li key={country.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={country.iso === value}
                    data-active={active}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => commit(country.iso)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                      active ? 'bg-accent-soft' : ''
                    } ${country.iso === value ? 'font-medium text-accent' : 'text-ink'}`}
                  >
                    <span className="text-base leading-none">{flagEmoji(country.iso)}</span>
                    <span className="min-w-0 flex-1 truncate">{country.name}</span>
                    <span className="font-mono text-xs text-muted">+{country.dial}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasError && <span className="sr-only">This number is not valid for the chosen country.</span>}
    </div>
  );
}
