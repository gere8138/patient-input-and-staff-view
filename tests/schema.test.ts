import { describe, expect, it } from 'vitest';
import { fieldErrors, isValidPhone, patientSchema, type PatientData } from '@/lib/schema';
import { countCompletedRequired, REQUIRED_FIELDS } from '@/lib/fields';

const valid: PatientData = {
  firstName: 'Somchai',
  middleName: '',
  lastName: 'Wongsawat',
  dateOfBirth: '1988-04-12',
  gender: 'male',
  genderSelfDescribe: '',
  phone: '081 234 5678',
  email: 'somchai@example.com',
  address: '221 Sukhumvit Road, Khlong Toei, Bangkok 10110',
  preferredLanguage: 'thai',
  nationality: 'thai',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  religion: '',
};

function errorsFor(overrides: Partial<PatientData>): Record<string, string> {
  const result = patientSchema.safeParse({ ...valid, ...overrides });
  return result.success ? {} : fieldErrors(result.error);
}

describe('patientSchema', () => {
  it('accepts a complete form', () => {
    expect(patientSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a form with no email, which the brief marks optional', () => {
    expect(errorsFor({ email: '' })).toEqual({});
  });

  it('rejects a malformed email when one is given', () => {
    expect(errorsFor({ email: 'somchai@' })).toHaveProperty('email');
  });

  it('requires both halves of the emergency contact or neither', () => {
    expect(errorsFor({ emergencyContactName: 'Malee' })).toHaveProperty(
      'emergencyContactRelationship',
    );
    expect(errorsFor({ emergencyContactRelationship: 'spouse' })).toHaveProperty(
      'emergencyContactName',
    );
    expect(errorsFor({ emergencyContactName: 'Malee', emergencyContactRelationship: 'spouse' })).toEqual({});
  });

  it('requires a self-description when gender is "other"', () => {
    expect(errorsFor({ gender: 'other' })).toHaveProperty('genderSelfDescribe');
    expect(errorsFor({ gender: 'other', genderSelfDescribe: 'Non-binary' })).toEqual({});
  });

  it('rejects a date of birth in the future or beyond a human lifespan', () => {
    expect(errorsFor({ dateOfBirth: '2999-01-01' })).toHaveProperty('dateOfBirth');
    expect(errorsFor({ dateOfBirth: '1850-01-01' })).toHaveProperty('dateOfBirth');
  });

  it('rejects an address that is too short to find', () => {
    expect(errorsFor({ address: '12' })).toHaveProperty('address');
  });
});

describe('isValidPhone', () => {
  it.each(['0812345678', '081 234 5678', '+66 81-234-5678', '(02) 123 4567'])('accepts %s', (input) => {
    expect(isValidPhone(input)).toBe(true);
  });

  it.each(['12345', '', 'not a phone', '1234567890123456'])('rejects %s', (input) => {
    expect(isValidPhone(input)).toBe(false);
  });
});

describe('countCompletedRequired', () => {
  it('counts only required fields with a non-blank value', () => {
    expect(countCompletedRequired({})).toBe(0);
    expect(countCompletedRequired({ firstName: 'A', middleName: 'B' })).toBe(1);
    expect(countCompletedRequired({ firstName: '   ' })).toBe(0);
    expect(countCompletedRequired(valid)).toBe(REQUIRED_FIELDS.length);
  });
});
