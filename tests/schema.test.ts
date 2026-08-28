import { describe, expect, it } from 'vitest';
import {
  digitsOnly,
  fieldErrors,
  formatPhone,
  GENDER_VALUES,
  isValidPhone,
  patientSchema,
  type PatientData,
} from '@/lib/schema';
import {
  countCompletedRequired,
  FIELDS,
  GENDERS,
  LANGUAGES,
  NATIONALITIES,
  PHONE_COUNTRIES,
  REQUIRED_FIELDS,
} from '@/lib/fields';
import { COUNTRIES, flagEmoji } from '@/lib/countries';

const valid: PatientData = {
  firstName: 'Somchai',
  middleName: '',
  lastName: 'Wongsawat',
  dateOfBirth: '1988-04-12',
  gender: 'male',
  phoneCountry: 'TH',
  phone: '081 234 5678',
  email: 'somchai@example.com',
  address: '221 Sukhumvit Road, Khlong Toei, Bangkok 10110',
  preferredLanguage: 'thai',
  nationality: 'TH',
  emergencyContactPhoneCountry: 'TH',
  emergencyContactPhone: '0891234567',
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

  it('requires an email address', () => {
    expect(errorsFor({ email: '' })).toHaveProperty('email');
  });

  it('rejects a malformed email when one is given', () => {
    expect(errorsFor({ email: 'somchai@' })).toHaveProperty('email');
  });

  it('requires an emergency contact number', () => {
    expect(errorsFor({ emergencyContactPhone: '' })).toHaveProperty('emergencyContactPhone');
  });

  it('validates the emergency number against its own country', () => {
    expect(
      errorsFor({ emergencyContactPhoneCountry: 'US', emergencyContactPhone: '0891234567' }),
    ).toHaveProperty('emergencyContactPhone');
    expect(
      errorsFor({ emergencyContactPhoneCountry: 'US', emergencyContactPhone: '(415) 555-2671' }),
    ).toEqual({});
  });

  it('treats the contact name and relationship as independent and optional', () => {
    expect(errorsFor({ emergencyContactName: 'Malee' })).toEqual({});
    expect(errorsFor({ emergencyContactRelationship: 'spouse' })).toEqual({});
    expect(errorsFor({ emergencyContactName: '', emergencyContactRelationship: '' })).toEqual({});
  });

  it('keeps the two phone numbers on separate country rules', () => {
    const errors = errorsFor({
      phoneCountry: 'TH',
      phone: '081 234 5678',
      emergencyContactPhoneCountry: 'GB',
      emergencyContactPhone: '07400 123456',
    });
    expect(errors).toEqual({});
  });

  it('accepts each of the three gender options and nothing else', () => {
    for (const gender of GENDER_VALUES) {
      expect(errorsFor({ gender })).toEqual({});
    }
    expect(
      patientSchema.safeParse({ ...valid, gender: 'other' as PatientData['gender'] }).success,
    ).toBe(false);
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
  it.each([
    ['TH', '0812345678'],
    ['TH', '081 234 5678'],
    ['TH', '+66 81 234 5678'],
    ['US', '(415) 555-2671'],
    ['GB', '07400 123456'],
    ['JP', '090-1234-5678'],
    ['SG', '8123 4567'],
  ])('accepts a real %s number: %s', (country, input) => {
    expect(isValidPhone(input, country)).toBe(true);
  });

  it.each([
    ['TH', '12345'],
    ['TH', ''],
    ['TH', 'not a phone'],
    ['TH', '08123456789012'],
    ['US', '0812345678'],
    ['SG', '0812345678'],
    ['GB', '12345'],
  ])('rejects an invalid %s number: %s', (country, input) => {
    expect(isValidPhone(input, country)).toBe(false);
  });

  it('judges the same digits differently depending on the country', () => {
    // A valid Thai mobile is not a valid Singapore number.
    expect(isValidPhone('0812345678', 'TH')).toBe(true);
    expect(isValidPhone('0812345678', 'SG')).toBe(false);
  });

  it('rejects an unknown country code', () => {
    expect(isValidPhone('0812345678', 'ZZ')).toBe(false);
  });
});

describe('phone validation through the schema', () => {
  it('rejects a number that is invalid for the chosen country', () => {
    expect(errorsFor({ phoneCountry: 'US', phone: '081 234 5678' })).toHaveProperty('phone');
  });

  it('accepts the same number once the country matches', () => {
    expect(errorsFor({ phoneCountry: 'TH', phone: '081 234 5678' })).toEqual({});
  });

  it('names the country in the error message', () => {
    expect(errorsFor({ phoneCountry: 'JP', phone: '081 234 5678' }).phone).toContain('Japan');
  });
});

describe('digitsOnly', () => {
  it('keeps digits and drops everything else', () => {
    expect(digitsOnly('081 234 5678')).toBe('0812345678');
    expect(digitsOnly('+66 (81) 234-5678')).toBe('66812345678');
    expect(digitsOnly('abc081def234')).toBe('081234');
    expect(digitsOnly('!@#$%')).toBe('');
    expect(digitsOnly('')).toBe('');
  });

  it('leaves an already-clean number untouched', () => {
    expect(digitsOnly('0812345678')).toBe('0812345678');
  });
});

describe('formatPhone', () => {
  it('renders an international form for the staff console', () => {
    expect(formatPhone('0812345678', 'TH')).toBe('+66 81 234 5678');
    expect(formatPhone('(415) 555-2671', 'US')).toBe('+1 415 555 2671');
  });
});

describe('country data', () => {
  it('covers every country libphonenumber can validate', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(240);
  });

  it('gives every country a dial code and a nationality', () => {
    for (const country of COUNTRIES) {
      expect(country.dial).toMatch(/^\d+$/);
      expect(country.nationality.length).toBeGreaterThan(0);
    }
  });

  it('leads the language list with Thai and ends it with a catch-all', () => {
    const values = LANGUAGES.map((option) => option.value);
    expect(values[0]).toBe('thai');
    expect(values.at(-1)).toBe('other');
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps the gender radio options and the schema enum in step', () => {
    expect(GENDERS.map((option) => option.value)).toEqual([...GENDER_VALUES]);
  });

  it('has no free-text gender field left behind', () => {
    expect(FIELDS.some((field) => String(field.key) === 'genderSelfDescribe')).toBe(false);
    expect(FIELDS.every((field) => !('showWhen' in field))).toBe(true);
  });

  it('offers one nationality option per country', () => {
    expect(NATIONALITIES).toHaveLength(COUNTRIES.length);
  });

  it('puts Thailand first in both country lists', () => {
    expect(NATIONALITIES[0]).toEqual({ value: 'TH', label: 'Thai' });
    expect(PHONE_COUNTRIES[0].value).toBe('TH');
    expect(PHONE_COUNTRIES[0].label).toContain('+66');
  });

  it('lists every country exactly once in the phone picker', () => {
    expect(new Set(PHONE_COUNTRIES.map((o) => o.value)).size).toBe(COUNTRIES.length);
    expect(new Set(NATIONALITIES.map((o) => o.value)).size).toBe(COUNTRIES.length);
  });

  it('marks one primary country per shared dialling code', () => {
    const fortyFour = COUNTRIES.filter((c) => c.dial === '44');
    expect(fortyFour.filter((c) => c.primary).map((c) => c.iso)).toEqual(['GB']);
    expect(COUNTRIES.find((c) => c.iso === 'US')?.primary).toBe(true);
    expect(COUNTRIES.find((c) => c.iso === 'JE')?.primary).toBe(false);
  });

  it('builds a flag from the ISO code', () => {
    expect(flagEmoji('TH')).toBe('🇹🇭');
    expect(flagEmoji('GB')).toBe('🇬🇧');
  });
});

describe('countCompletedRequired', () => {
  it('counts only required fields with a non-blank value', () => {
    expect(countCompletedRequired({})).toBe(0);
    expect(countCompletedRequired({ firstName: 'A', middleName: 'B' })).toBe(1);
    expect(countCompletedRequired({ firstName: '   ' })).toBe(0);
    expect(countCompletedRequired(valid)).toBe(REQUIRED_FIELDS.length);
  });

  it('does not credit a filled-in field that is invalid', () => {
    expect(countCompletedRequired({ email: 'not-an-email' })).toBe(0);
    expect(countCompletedRequired({ email: 'a@b.co' })).toBe(1);
    expect(countCompletedRequired({ dateOfBirth: '2999-01-01' })).toBe(0);
    expect(countCompletedRequired({ address: 'x' })).toBe(0);
  });

  it('judges a phone number against its chosen country', () => {
    expect(countCompletedRequired({ phoneCountry: 'TH', phone: '0812345678' })).toBe(1);
    expect(countCompletedRequired({ phoneCountry: 'US', phone: '0812345678' })).toBe(0);
    expect(countCompletedRequired({ phoneCountry: 'TH', phone: '123' })).toBe(0);
  });

  it('never reaches full while any required field is still invalid', () => {
    const broken = { ...valid, email: 'nope' };
    expect(countCompletedRequired(broken)).toBe(REQUIRED_FIELDS.length - 1);
    expect(patientSchema.safeParse(broken).success).toBe(false);
  });
});
