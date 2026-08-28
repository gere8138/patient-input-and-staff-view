'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
  type UseFormRegisterReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  countCompletedRequired,
  fieldsInSection,
  PHONE_COUNTRY_FOR,
  REQUIRED_FIELDS,
  SECTIONS,
  type FieldSpec,
} from '@/lib/fields';
import {
  crossFieldIssues,
  emptyPatientData,
  patientSchema,
  type PatientData,
  type PatientField,
} from '@/lib/schema';
import { DEFAULT_PHONE_COUNTRY } from '@/lib/countries';
import { usePatientSession } from '@/hooks/usePatientSession';
import { ConnectionBadge } from './ConnectionBadge';
import { DateField } from './DateField';
import { FormSection } from './FormSection';
import { PhoneField } from './PhoneField';
import { ProgressMeter } from './ProgressMeter';
import { RadioGroup } from './RadioGroup';
import { SelectField } from './SelectField';
import { SubmittedScreen } from './SubmittedScreen';
import { TextAreaField } from './TextAreaField';
import { TextField } from './TextField';

const draftKey = (sessionId: string) => `agnos:draft:${sessionId}`;

/**
 * Fields whose validity depends on another one. React Hook Form only surfaces
 * the error for the field just interacted with, so after finishing with a key
 * here its partners are re-judged too — otherwise "you gave a name, now give
 * the relationship" would stay invisible until submit.
 */
const DEPENDENTS: Partial<Record<PatientField, PatientField[]>> = {
  phoneCountry: ['phone'],
  emergencyContactPhoneCountry: ['emergencyContactPhone'],
  gender: ['genderSelfDescribe'],
};

/** Choosing from a list is a finished action, so its partners re-check at once. */
const REVALIDATE_ON_CHANGE = new Set<PatientField>([
  'phoneCountry',
  'emergencyContactPhoneCountry',
  'gender',
]);

function loadDraft(sessionId: string): PatientData {
  if (typeof window === 'undefined') return emptyPatientData;
  try {
    const raw = window.localStorage.getItem(draftKey(sessionId));
    if (!raw) return emptyPatientData;
    return { ...emptyPatientData, ...(JSON.parse(raw) as Partial<PatientData>) };
  } catch {
    return emptyPatientData;
  }
}

const zodPatientResolver = zodResolver(patientSchema) as Resolver<PatientData>;

/**
 * Zod skips object-level refinements while any base field is still empty, so on
 * a half-filled form the cross-field rules would stay silent until submit.
 * This layers them back on so the patient sees them as they type.
 */
const patientResolver: Resolver<PatientData> = async (values, context, options) => {
  const result = await zodPatientResolver(values, context, options);
  const errors = { ...result.errors } as FieldErrors<PatientData>;
  const byField = errors as Record<string, { type: string; message: string }>;

  for (const [key, message] of Object.entries(crossFieldIssues(values))) {
    if (!byField[key]) byField[key] = { type: 'cross-field', message };
  }

  if (Object.keys(errors).length > 0) return { values: {}, errors };
  return { values: values as PatientData, errors: {} };
};

export function PatientForm({ sessionId }: { sessionId: string }) {
  const [completed, setCompleted] = useState(0);
  const [reference, setReference] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    setValue,
    setError,
    trigger,
    setFocus: focusInput,
    formState: { errors, isSubmitting },
  } = useForm<PatientData>({
    resolver: patientResolver,
    mode: 'onTouched',
    defaultValues: emptyPatientData,
  });

  const { connection, pushField, setFocus, submit } = usePatientSession(sessionId, getValues);

  // Restore any draft left by a refresh or a dropped connection.
  useEffect(() => {
    const draft = loadDraft(sessionId);
    reset(draft);
    setCompleted(countCompletedRequired(draft));
  }, [sessionId, reset]);

  const [gender, dateOfBirth, phoneCountry, emergencyPhoneCountry] = useWatch({
    control,
    name: ['gender', 'dateOfBirth', 'phoneCountry', 'emergencyContactPhoneCountry'],
  });

  const onFieldChanged = useCallback(
    (key: PatientField, value: string) => {
      pushField(key, value);
      // The field itself is included: picking a valid option must clear its own
      // error in the same pass that re-judges its partners.
      if (REVALIDATE_ON_CHANGE.has(key)) {
        void trigger([key, ...(DEPENDENTS[key] ?? [])]);
      }
      const values = getValues();
      setCompleted(countCompletedRequired(values));
      try {
        window.localStorage.setItem(draftKey(sessionId), JSON.stringify(values));
      } catch {
        // Private browsing or a full quota — the socket copy is still authoritative.
      }
    },
    [pushField, getValues, sessionId, trigger],
  );

  /** The combobox writes through form state rather than a native change event. */
  const onCountryPicked = useCallback(
    (key: PatientField) => (iso: string) => {
      setValue(key, iso, { shouldDirty: true });
      onFieldChanged(key, iso);
    },
    [setValue, onFieldChanged],
  );

  const bind = useCallback(
    (key: PatientField): UseFormRegisterReturn => {
      const registration = register(key);
      return {
        ...registration,
        onChange: async (event) => {
          await registration.onChange(event);
          const target = event.target as HTMLInputElement;
          onFieldChanged(key, target.value ?? '');
        },
        onBlur: async (event) => {
          await registration.onBlur(event);
          const dependents = DEPENDENTS[key];
          if (dependents?.length) void trigger(dependents);
          setFocus(null);
        },
      };
    },
    [register, onFieldChanged, setFocus, trigger],
  );

  const onSubmit = handleSubmit(
    async (data) => {
      setFormError(null);
      const result = await submit(data);
      if (result.ok && result.reference) {
        try {
          window.localStorage.removeItem(draftKey(sessionId));
        } catch {
          // Nothing to clean up if storage is unavailable.
        }
        setReference(result.reference);
        return;
      }
      const entries = Object.entries(result.errors ?? {});
      for (const [key, message] of entries) {
        if (key === '_form') setFormError(message);
        else setError(key as PatientField, { type: 'server', message });
      }
      const firstField = entries.find(([key]) => key !== '_form')?.[0];
      if (firstField) focusInput(firstField as PatientField);
    },
    (validationErrors) => {
      const first = Object.keys(validationErrors)[0] as PatientField | undefined;
      if (first) focusInput(first);
    },
  );

  if (reference) {
    return <SubmittedScreen reference={reference} name={getValues('firstName')} />;
  }

  const renderField = (spec: FieldSpec) => {
    if (spec.showWhen && spec.showWhen.key === 'gender' && gender !== spec.showWhen.equals) return null;
    const error = errors[spec.key]?.message;
    const registration = bind(spec.key);
    const onFocus = () => setFocus(spec.key);
    const common = { spec, registration, error };

    let control_: React.ReactNode;
    switch (spec.type) {
      case 'select':
        control_ = <SelectField {...common} />;
        break;
      case 'radio':
        control_ = <RadioGroup {...common} value={gender} />;
        break;
      case 'date':
        control_ = <DateField {...common} value={dateOfBirth} />;
        break;
      case 'phone': {
        const countryKey = PHONE_COUNTRY_FOR[spec.key] as PatientField;
        const current =
          (countryKey === 'phoneCountry' ? phoneCountry : emergencyPhoneCountry) ||
          DEFAULT_PHONE_COUNTRY;
        control_ = (
          <PhoneField
            {...common}
            countryKey={countryKey}
            countryRegistration={register(countryKey)}
            country={current}
            onCountryChange={onCountryPicked(countryKey)}
          />
        );
        break;
      }
      case 'textarea':
        control_ = <TextAreaField {...common} />;
        break;
      default:
        control_ = <TextField {...common} />;
    }

    return (
      <div
        key={spec.key}
        onFocus={onFocus}
        className={spec.span === 'full' ? 'sm:col-span-2' : undefined}
      >
        {control_}
      </div>
    );
  };

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto max-w-[720px] px-4 pt-8 pb-4 sm:px-6 lg:pt-14">
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs tracking-widest text-muted uppercase">Agnos clinic · intake</p>
            <ConnectionBadge state={connection} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-balance sm:text-3xl">Before we see you</h1>
          <p className="mt-2 max-w-prose text-ink-soft">
            Fill this in at your own pace. The front desk can see your answers as you type, so you will not be
            asked for them again.
          </p>
          <p className="mt-3 font-mono text-xs text-muted">Session {sessionId}</p>
        </header>

        <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-8 pb-4">
          {SECTIONS.map((section, index) => (
            <FormSection
              key={section.id}
              index={index + 1}
              title={section.title}
              description={section.description}
            >
              {fieldsInSection(section.id).map(renderField)}
            </FormSection>
          ))}

          {formError && (
            <p role="alert" className="rounded-lg border border-alert/40 bg-alert/5 px-4 py-3 text-sm text-alert">
              {formError}
            </p>
          )}

          <ProgressMeter completed={completed} total={REQUIRED_FIELDS.length} submitting={isSubmitting} />
        </form>
      </div>
    </main>
  );
}
