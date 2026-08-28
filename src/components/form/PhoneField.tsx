import type { UseFormRegisterReturn } from 'react-hook-form';
import type { FieldSpec } from '@/lib/fields';
import type { PatientField } from '@/lib/schema';
import { describedBy, FieldShell } from '@/components/ui/Field';
import { CountryCombobox } from './CountryCombobox';

interface Props {
  spec: FieldSpec;
  /** The number input. */
  registration: UseFormRegisterReturn;
  /** Hidden input keeping the ISO code inside the form state. */
  countryRegistration: UseFormRegisterReturn;
  countryKey: PatientField;
  country: string;
  onCountryChange: (iso: string) => void;
  error?: string;
}

export function PhoneField({
  spec,
  registration,
  countryRegistration,
  countryKey,
  country,
  onCountryChange,
  error,
}: Props) {
  const id = `field-${spec.key}`;

  return (
    <FieldShell id={id} label={spec.label} required={spec.required} help={spec.help} error={error}>
      {/*
        Picker and input share one bordered box so the pair reads as a single
        control, with the focus ring drawn on the container.
      */}
      <div
        className={`flex min-h-[44px] items-stretch rounded-lg border bg-paper-raised transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${
          error ? 'border-alert' : 'border-line'
        }`}
      >
        <CountryCombobox
          value={country}
          onChange={onCountryChange}
          label={`${spec.label} country`}
          hasError={Boolean(error)}
        />
        <input type="hidden" {...countryRegistration} id={`field-${countryKey}`} />

        <span aria-hidden="true" className="my-2 w-px shrink-0 bg-line" />

        <input
          {...registration}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={spec.autoComplete}
          placeholder={spec.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, spec.help, error)}
          className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
    </FieldShell>
  );
}
