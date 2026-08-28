import type { UseFormRegisterReturn } from 'react-hook-form';
import type { FieldSpec } from '@/lib/fields';
import { FieldShell } from '@/components/ui/Field';

interface Props {
  spec: FieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
  value?: string;
}

export function RadioGroup({ spec, registration, error, value }: Props) {
  const id = `field-${spec.key}`;
  return (
    <FieldShell
      id={id}
      label={spec.label}
      required={spec.required}
      help={spec.help}
      error={error}
      as="group"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {spec.options?.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                checked ? 'border-accent bg-accent-soft' : 'border-line bg-paper-raised hover:border-accent/50'
              }`}
            >
              <input
                {...registration}
                type="radio"
                value={option.value}
                aria-describedby={error ? `${id}-error` : undefined}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm text-ink">{option.label}</span>
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}
