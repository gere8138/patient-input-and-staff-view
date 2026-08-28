import type { UseFormRegisterReturn } from 'react-hook-form';
import type { FieldSpec } from '@/lib/fields';
import { controlClass, describedBy, FieldShell } from '@/components/ui/Field';

interface Props {
  spec: FieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
}

export function SelectField({ spec, registration, error }: Props) {
  const id = `field-${spec.key}`;
  return (
    <FieldShell id={id} label={spec.label} required={spec.required} help={spec.help} error={error}>
      <select
        {...registration}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, spec.help, error)}
        className={`${controlClass(Boolean(error))} appearance-none bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath fill='%234A5F5C' d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="">Choose…</option>
        {spec.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
