import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { COUNTRY_BY_ISO, countryName, DEFAULT_PHONE_COUNTRY } from './countries';

const MAX_AGE_YEARS = 120;

export function isRealPastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = Date.now();
  if (date.getTime() > now) return false;
  const oldest = new Date();
  oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_AGE_YEARS);
  return date.getTime() >= oldest.getTime();
}

export function normalisePhone(value: string): string {
  return value.replace(/[\s().-]/g, '');
}

/**
 * Phone inputs accept digits and nothing else — the dialling prefix comes from
 * the country picker, so letters, punctuation and stray "+" only ever produce
 * a number that cannot be dialled. Applied on every keystroke and on paste.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validity is delegated to libphonenumber's per-country metadata, so a Thai
 * mobile, a UK landline and a US number are each judged by their own
 * numbering plan rather than one generic digit-count rule.
 */
export function isValidPhone(value: string, country: string = DEFAULT_PHONE_COUNTRY): boolean {
  if (!value.trim()) return false;
  if (!COUNTRY_BY_ISO[country]) return false;
  try {
    return isValidPhoneNumber(value, country as CountryCode);
  } catch {
    return false;
  }
}

/** "+66 81 234 5678" — how the staff console shows a number. */
export function formatPhone(value: string, country: string = DEFAULT_PHONE_COUNTRY): string {
  if (!value.trim()) return '';
  try {
    const parsed = parsePhoneNumberFromString(value, country as CountryCode);
    return parsed ? parsed.formatInternational() : value;
  } catch {
    return value;
  }
}

export const GENDER_VALUES = ['female', 'male', 'prefer_not_to_say'] as const;

const patientObject = z.object({
    firstName: z.string().trim().min(1, "Please enter your first name").max(60),
    middleName: z.string().trim().max(60).optional().or(z.literal('')),
    lastName: z.string().trim().min(1, "Please enter your last name").max(60),
    dateOfBirth: z
      .string()
      .min(1, 'Enter a date of birth')
      .refine(isRealPastDate, 'Please enter a valid date'),
    gender: z.enum(GENDER_VALUES, { errorMap: () => ({ message: 'Choose an option' }) }),
    phoneCountry: z
      .string()
      .refine((iso) => Boolean(COUNTRY_BY_ISO[iso]), 'Choose a country'),
    phone: z.string().trim().min(1, 'Enter a phone number'),
    email: z
      .string()
      .trim()
      .min(1, 'Enter an email address')
      .email('Please enter a valid email address like name@example.com'),
    address: z.string().trim().min(5, 'Please enter a valid address').max(300),
    preferredLanguage: z.string().min(1, 'Choose a preferred language'),
    nationality: z.string().min(1, 'Choose a nationality'),
    emergencyContactPhoneCountry: z
      .string()
      .refine((iso) => Boolean(COUNTRY_BY_ISO[iso]), 'Choose a country'),
    emergencyContactPhone: z.string().trim().min(1, 'Enter an emergency contact number'),
    emergencyContactName: z.string().trim().max(80).optional().or(z.literal('')),
    emergencyContactRelationship: z.string().trim().max(40).optional().or(z.literal('')),
    religion: z.string().trim().max(60).optional().or(z.literal('')),
});

export const patientSchema = patientObject.superRefine((data, ctx) => {
  for (const [path, message] of Object.entries(crossFieldIssues(data))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  }
});

/**
 * Judges one field on its own, plus any cross-field rule that points at it.
 * Used by the progress meter, which must not credit a field the patient has
 * filled in wrongly.
 */
export function isFieldValid(
  key: PatientField,
  data: Partial<PatientData>,
  issues: Record<string, string> = crossFieldIssues(data),
): boolean {
  const value = data[key];
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (issues[key]) return false;
  const field = patientObject.shape[key];
  return field ? field.safeParse(value).success : true;
}

export type PatientData = z.infer<typeof patientSchema>;

/**
 * Rules that need to see more than one field at once.
 *
 * Kept out of the object's `.superRefine` body and exported, because Zod skips
 * object-level effects entirely when any base field fails — which on a
 * half-filled form is always. The form runs these on every keystroke so the
 * patient gets the feedback immediately; the schema runs them again on submit
 * so the server enforces the same rules.
 */
export function crossFieldIssues(data: Partial<PatientData>): Record<string, string> {
  const issues: Record<string, string> = {};

  const ownCountry = data.phoneCountry || DEFAULT_PHONE_COUNTRY;
  if (data.phone?.trim() && !isValidPhone(data.phone, ownCountry)) {
    issues.phone = `Please enter a valid ${countryName(ownCountry)} phone number`;
  }

  const emergencyCountry = data.emergencyContactPhoneCountry || DEFAULT_PHONE_COUNTRY;
  if (data.emergencyContactPhone?.trim() && !isValidPhone(data.emergencyContactPhone, emergencyCountry)) {
    issues.emergencyContactPhone = `Please enter a valid ${countryName(emergencyCountry)} phone number`;
  }

  // The contact's name and relationship are independent and optional: a number
  // on its own is still useful, so neither one requires the other.
  return issues;
}
export type PatientField = keyof PatientData;

export const emptyPatientData: PatientData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '' as PatientData['gender'],
  phoneCountry: DEFAULT_PHONE_COUNTRY,
  phone: '',
  email: '',
  address: '',
  preferredLanguage: '',
  nationality: '',
  emergencyContactPhoneCountry: DEFAULT_PHONE_COUNTRY,
  emergencyContactPhone: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  religion: '',
};

/** Field-keyed errors, ready to hand back to React Hook Form's setError. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
