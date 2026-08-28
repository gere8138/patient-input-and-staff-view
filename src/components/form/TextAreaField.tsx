import type { UseFormRegisterReturn } from 'react-hook-form';
import type { FieldSpec } from '@/lib/fields';
import { controlClass, describedBy, FieldShell } from '@/components/ui/Field';

interface Props {
  spec: FieldSpec;
  registration: UseFormRegisterReturn;
  error?: string;
}

export function TextAreaField({ spec, registration, error }: Props) {
  const id = `field-${spec.key}`;
  return (
    <FieldShell id={id} label={spec.label} required={spec.required} help={spec.help} error={error}>
      <textarea
        {...registration}
        id={id}
        rows={3}
        autoComplete={spec.autoComplete}
        placeholder={spec.placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, spec.help, error)}
        className={`${controlClass(Boolean(error))} resize-y leading-relaxed`}
      />
    </FieldShell>
  );
}
