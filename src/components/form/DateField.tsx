import type { UseFormRegisterReturn } from 'react-hook-form';
import type { FieldSpec } from '@/lib/fields';
import { controlClass, describedBy, FieldShell } from '@/components/ui/Field';

interface Props {
  spec: FieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
  value?: string;
}

export function ageFromDate(value: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export function DateField({ spec, registration, error, value }: Props) {
  const id = `field-${spec.key}`;
  const age = value ? ageFromDate(value) : null;
  const help = age !== null ? `${age} years old` : spec.help;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FieldShell id={id} label={spec.label} required={spec.required} help={help} error={error}>
      <input
        {...registration}
        id={id}
        type="date"
        max={today}
        autoComplete={spec.autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={controlClass(Boolean(error))}
      />
    </FieldShell>
  );
}
