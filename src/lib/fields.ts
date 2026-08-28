import { COUNTRIES, DEFAULT_PHONE_COUNTRY, flagEmoji } from './countries';
import { crossFieldIssues, isFieldValid, type PatientData, type PatientField } from './schema';

export type FieldType = 'text' | 'tel' | 'email' | 'date' | 'textarea' | 'select' | 'radio' | 'phone';

export type SectionId = 'identity' | 'contact' | 'background' | 'emergency';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: PatientField;
  label: string;
  section: SectionId;
  type: FieldType;
  required: boolean;
  /** Half-width fields pair up side by side from the `sm` breakpoint. */
  span: 'full' | 'half';
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  help?: string;
  options?: FieldOption[];
  /**
   * Carried by another field's control rather than getting one of its own —
   * it is never rendered as a standalone input or as its own staff row.
   */
  internal?: boolean;
}

export interface SectionSpec {
  id: SectionId;
  title: string;
  description: string;
}

export const SECTIONS: SectionSpec[] = [
  { id: 'identity', title: 'About you', description: 'Your name and basic details, as they appear on your ID.' },
  { id: 'contact', title: 'How we reach you', description: 'Used for appointment reminders and results.' },
  { id: 'background', title: 'Background', description: 'Helps us assign the right staff and interpreter.' },
  {
    id: 'emergency',
    title: 'Emergency contact',
    description: 'A number we can call if we cannot reach you. A name and relationship help, but are optional.',
  },
];

export const LANGUAGES: FieldOption[] = [
  { value: 'thai', label: 'ไทย — Thai' },
  { value: 'english', label: 'English' },
  { value: 'mandarin', label: '中文 — Mandarin' },
  { value: 'japanese', label: '日本語 — Japanese' },
  { value: 'korean', label: '한국어 — Korean' },
  { value: 'other', label: 'Other' },
];

/** Thailand leads both country lists — this is a Thai clinic product. */
function thailandFirst<T extends { value: string }>(options: T[]): T[] {
  const home = options.filter((option) => option.value === DEFAULT_PHONE_COUNTRY);
  return [...home, ...options.filter((option) => option.value !== DEFAULT_PHONE_COUNTRY)];
}

/** Every country libphonenumber can validate a number for. */
export const NATIONALITIES: FieldOption[] = thailandFirst(
  COUNTRIES.map((country) => ({ value: country.iso, label: country.nationality })).sort((a, b) =>
    a.label.localeCompare(b.label, 'en'),
  ),
);

/** Flag + dial code, for the phone number country pickers. */
export const PHONE_COUNTRIES: FieldOption[] = thailandFirst(
  COUNTRIES.map((country) => ({
    value: country.iso,
    label: `${flagEmoji(country.iso)} +${country.dial} ${country.name}`,
  })),
);


export const GENDERS: FieldOption[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const RELATIONSHIPS: FieldOption[] = [
  { value: 'spouse', label: 'Spouse or partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'carer', label: 'Carer' },
  { value: 'other', label: 'Other' },
];

/**
 * The spine of the app: the patient form, the staff detail pane and the
 * progress meter all render from this one array.
 */
export const FIELDS: FieldSpec[] = [
  {
    key: 'firstName',
    label: 'First name',
    section: 'identity',
    type: 'text',
    required: true,
    span: 'half',
    placeholder: 'First Name',
    autoComplete: 'given-name',
  },
  {
    key: 'middleName',
    label: 'Middle name',
    section: 'identity',
    type: 'text',
    required: false,
    span: 'half',
    autoComplete: 'additional-name',
  },
  {
    key: 'lastName',
    label: 'Last name',
    section: 'identity',
    type: 'text',
    required: true,
    span: 'half',
    placeholder: 'Last Name',
    autoComplete: 'family-name',
  },
  {
    key: 'dateOfBirth',
    label: 'Date of birth',
    section: 'identity',
    type: 'date',
    required: true,
    span: 'half',
    autoComplete: 'bday',
  },
  {
    key: 'gender',
    label: 'Gender',
    section: 'identity',
    type: 'radio',
    required: true,
    span: 'full',
    options: GENDERS,
  },
  {
    key: 'phoneCountry',
    label: 'Phone country',
    section: 'contact',
    type: 'select',
    required: false,
    span: 'half',
    options: PHONE_COUNTRIES,
    internal: true,
  },
  {
    key: 'phone',
    label: 'Phone number',
    section: 'contact',
    type: 'phone',
    required: true,
    span: 'half',
    placeholder: '0812345678',
    autoComplete: 'tel',
    inputMode: 'tel',
    help: 'Pick the country, then the number as you would dial it there.',
  },
  {
    key: 'email',
    label: 'Email',
    section: 'contact',
    type: 'email',
    required: true,
    span: 'half',
    placeholder: 'name@example.com',
    autoComplete: 'email',
    inputMode: 'email',
    help: 'Where we send results and reminders.',
  },
  {
    key: 'address',
    label: 'Address',
    section: 'contact',
    type: 'textarea',
    required: true,
    span: 'full',
    placeholder: 'House number, street, sub-district, district, province, postcode',
    autoComplete: 'street-address',
  },
  {
    key: 'preferredLanguage',
    label: 'Preferred language',
    section: 'background',
    type: 'select',
    required: true,
    span: 'half',
    options: LANGUAGES,
    help: 'We will try to match you with a speaker.',
  },
  {
    key: 'nationality',
    label: 'Nationality',
    section: 'background',
    type: 'select',
    required: true,
    span: 'half',
    options: NATIONALITIES,
  },
  {
    key: 'religion',
    label: 'Religion',
    section: 'background',
    type: 'text',
    required: false,
    span: 'full',
    placeholder: 'Optional',
    help: 'Only if it affects the care you would like.',
  },
  {
    key: 'emergencyContactPhoneCountry',
    label: 'Emergency contact phone country',
    section: 'emergency',
    type: 'select',
    required: false,
    span: 'half',
    options: PHONE_COUNTRIES,
    internal: true,
  },
  {
    key: 'emergencyContactPhone',
    label: 'Contact number',
    section: 'emergency',
    type: 'phone',
    required: true,
    span: 'half',
    placeholder: '0899876543',
    autoComplete: 'tel',
    inputMode: 'tel',
    help: 'Digits only. Someone we can call if we cannot reach you.',
  },
  {
    key: 'emergencyContactName',
    label: 'Contact name',
    section: 'emergency',
    type: 'text',
    required: false,
    span: 'half',
    autoComplete: 'name',
  },
  {
    key: 'emergencyContactRelationship',
    label: 'Relationship to you',
    section: 'emergency',
    type: 'select',
    required: false,
    span: 'half',
    options: RELATIONSHIPS,
  },
];

export const FIELD_BY_KEY: Record<PatientField, FieldSpec> = Object.fromEntries(
  FIELDS.map((field) => [field.key, field]),
) as Record<PatientField, FieldSpec>;

export const REQUIRED_FIELDS: PatientField[] = FIELDS.filter((f) => f.required).map((f) => f.key);

/** Which field holds the dialling country for each phone number field. */
export const PHONE_COUNTRY_FOR: Partial<Record<PatientField, PatientField>> = {
  phone: 'phoneCountry',
  emergencyContactPhone: 'emergencyContactPhoneCountry',
};

export function fieldsInSection(section: SectionId): FieldSpec[] {
  return FIELDS.filter((field) => field.section === section && !field.internal);
}

export function labelFor(key: PatientField): string {
  return FIELD_BY_KEY[key]?.label ?? key;
}

/** Turns a stored value into something a human can read in the staff console. */
export function displayValue(key: PatientField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value);
  const spec = FIELD_BY_KEY[key];
  if (spec?.options) {
    return spec.options.find((option) => option.value === raw)?.label ?? raw;
  }
  if (spec?.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return raw;
}

/**
 * How many required fields are both filled in and actually valid. A wrong
 * phone number or a malformed email is not progress, so the meter does not
 * credit it — otherwise the bar reaches full while submit still refuses.
 */
export function countCompletedRequired(data: Partial<PatientData>): number {
  const issues = crossFieldIssues(data);
  return REQUIRED_FIELDS.filter((key) => isFieldValid(key, data, issues)).length;
}
