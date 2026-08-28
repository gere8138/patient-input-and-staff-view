import type { PatientField } from './schema';

export type FieldType = 'text' | 'tel' | 'email' | 'date' | 'textarea' | 'select' | 'radio';

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
  /** Rendered only when another field holds a particular value. */
  showWhen?: { key: PatientField; equals: string };
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
  { id: 'emergency', title: 'Emergency contact', description: 'Optional, but useful if we need to reach someone.' },
];

export const LANGUAGES: FieldOption[] = [
  { value: 'thai', label: 'ไทย — Thai' },
  { value: 'english', label: 'English' },
  { value: 'mandarin', label: '中文 — Mandarin' },
  { value: 'japanese', label: '日本語 — Japanese' },
  { value: 'korean', label: '한국어 — Korean' },
  { value: 'burmese', label: 'Burmese' },
  { value: 'khmer', label: 'Khmer' },
  { value: 'lao', label: 'Lao' },
  { value: 'malay', label: 'Malay' },
  { value: 'arabic', label: 'العربية — Arabic' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'russian', label: 'Russian' },
  { value: 'other', label: 'Other' },
];

export const NATIONALITIES: FieldOption[] = [
  { value: 'thai', label: 'Thai' },
  { value: 'american', label: 'American' },
  { value: 'australian', label: 'Australian' },
  { value: 'british', label: 'British' },
  { value: 'cambodian', label: 'Cambodian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'indian', label: 'Indian' },
  { value: 'indonesian', label: 'Indonesian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'lao', label: 'Lao' },
  { value: 'malaysian', label: 'Malaysian' },
  { value: 'myanmar', label: 'Myanmar' },
  { value: 'philippine', label: 'Philippine' },
  { value: 'russian', label: 'Russian' },
  { value: 'singaporean', label: 'Singaporean' },
  { value: 'vietnamese', label: 'Vietnamese' },
  { value: 'other', label: 'Other' },
];

export const GENDERS: FieldOption[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Prefer to self-describe' },
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
    placeholder: 'Somchai',
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
    placeholder: 'Wongsawat',
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
    key: 'genderSelfDescribe',
    label: 'How do you describe your gender?',
    section: 'identity',
    type: 'text',
    required: false,
    span: 'full',
    showWhen: { key: 'gender', equals: 'other' },
  },
  {
    key: 'phone',
    label: 'Phone number',
    section: 'contact',
    type: 'tel',
    required: true,
    span: 'half',
    placeholder: '081 234 5678',
    autoComplete: 'tel',
    inputMode: 'tel',
    help: '9–15 digits. A country code is fine.',
  },
  {
    key: 'email',
    label: 'Email',
    section: 'contact',
    type: 'email',
    required: false,
    span: 'half',
    placeholder: 'name@example.com',
    autoComplete: 'email',
    inputMode: 'email',
    help: 'If you have one.',
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

export function fieldsInSection(section: SectionId): FieldSpec[] {
  return FIELDS.filter((field) => field.section === section);
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

export function countCompletedRequired(data: Partial<Record<PatientField, unknown>>): number {
  return REQUIRED_FIELDS.filter((key) => {
    const value = data[key];
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  }).length;
}
