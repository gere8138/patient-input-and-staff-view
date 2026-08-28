import { z } from 'zod';

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

export function isValidPhone(value: string): boolean {
  const cleaned = normalisePhone(value);
  return /^\+?\d{9,15}$/.test(cleaned);
}

export const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;

export const patientSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter the patient's first name").max(60),
    middleName: z.string().trim().max(60).optional().or(z.literal('')),
    lastName: z.string().trim().min(1, "Enter the patient's last name").max(60),
    dateOfBirth: z
      .string()
      .min(1, 'Enter a date of birth')
      .refine(isRealPastDate, 'Enter a real date of birth in the past'),
    gender: z.enum(GENDER_VALUES, { errorMap: () => ({ message: 'Choose an option' }) }),
    genderSelfDescribe: z.string().trim().max(40).optional().or(z.literal('')),
    phone: z.string().min(1, 'Enter a phone number').refine(isValidPhone, 'Enter a phone number with 9–15 digits'),
    email: z.string().trim().email('Enter an email like name@example.com').or(z.literal('')),
    address: z.string().trim().min(5, 'Enter a street address').max(300),
    preferredLanguage: z.string().min(1, 'Choose a preferred language'),
    nationality: z.string().min(1, 'Choose a nationality'),
    emergencyContactName: z.string().trim().max(80).optional().or(z.literal('')),
    emergencyContactRelationship: z.string().trim().max(40).optional().or(z.literal('')),
    religion: z.string().trim().max(60).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.emergencyContactName && !data.emergencyContactRelationship) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergencyContactRelationship'],
        message: 'Add the relationship as well as the name',
      });
    }
    if (data.emergencyContactRelationship && !data.emergencyContactName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergencyContactName'],
        message: 'Add the contact’s name as well as the relationship',
      });
    }
    if (data.gender === 'other' && !data.genderSelfDescribe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['genderSelfDescribe'],
        message: 'Tell us how you describe your gender',
      });
    }
  });

export type PatientData = z.infer<typeof patientSchema>;
export type PatientField = keyof PatientData;

export const emptyPatientData: PatientData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '' as PatientData['gender'],
  genderSelfDescribe: '',
  phone: '',
  email: '',
  address: '',
  preferredLanguage: '',
  nationality: '',
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
