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

/*
 * One voice for every message the patient can see. These helpers also carry the
 * message into `required_error`, so a payload that omits a key entirely gets
 * the same sentence as one that sends it empty — Zod's bare "Required" never
 * reaches the form.
 */
const lengthLimit = (max: number) => `Please use ${max} characters or fewer`;

function requiredText(message: string, max: number) {
  return z
    .string({ required_error: message, invalid_type_error: message })
    .trim()
    .min(1, message)
    .max(max, lengthLimit(max));
}

function optionalText(max: number) {
  return z
    .string({ invalid_type_error: lengthLimit(max) })
    .trim()
    .max(max, lengthLimit(max))
    .optional()
    .or(z.literal(''));
}

function requiredChoice(message: string) {
  return z.string({ required_error: message, invalid_type_error: message }).min(1, message);
}

function countryChoice() {
  const message = 'Please choose a country';
  return z
    .string({ required_error: message, invalid_type_error: message })
    .refine((iso) => Boolean(COUNTRY_BY_ISO[iso]), message);
}

const patientObject = z.object({
  firstName: requiredText('Please enter your first name', 60),
  middleName: optionalText(60),
  lastName: requiredText('Please enter your last name', 60),
  dateOfBirth: requiredChoice('Please enter your date of birth').refine(
    isRealPastDate,
    'Please enter a valid date of birth',
  ),
  gender: z.enum(GENDER_VALUES, { errorMap: () => ({ message: 'Please choose an option' }) }),
  phoneCountry: countryChoice(),
  phone: requiredChoice('Please enter your phone number'),
  email: requiredText('Please enter your email address', 200).email(
    'Please enter a valid email address like name@example.com',
  ),
  address: requiredText('Please enter your address', 300).min(5, 'Please enter a valid address'),
  preferredLanguage: requiredChoice('Please choose a preferred language'),
  nationality: requiredChoice('Please choose a nationality'),
  emergencyContactPhoneCountry: countryChoice(),
  emergencyContactPhone: requiredChoice('Please enter an emergency contact number'),
  emergencyContactName: optionalText(80),
  emergencyContactRelationship: optionalText(40),
  religion: optionalText(60),
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
