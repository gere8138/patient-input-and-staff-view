import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

// The metadata lists each dialling code's countries with the main one first,
// so "+44" can rank the United Kingdom above Jersey.
const metadata = createRequire(import.meta.url)('libphonenumber-js/metadata.max.json');
const primaryForCode = new Map(
  Object.entries(metadata.country_calling_codes).map(([code, isos]) => [code, isos[0]]),
);

// Demonyms for sovereign states. Territories fall back to their country name,
// which reads correctly in a nationality list ("Gibraltar", "Guadeloupe").
const DEMONYM = {
  AD: 'Andorran', AE: 'Emirati', AF: 'Afghan', AG: 'Antiguan or Barbudan', AL: 'Albanian',
  AM: 'Armenian', AO: 'Angolan', AR: 'Argentine', AT: 'Austrian', AU: 'Australian',
  AZ: 'Azerbaijani', BA: 'Bosnian or Herzegovinian', BB: 'Barbadian', BD: 'Bangladeshi',
  BE: 'Belgian', BF: 'Burkinabé', BG: 'Bulgarian', BH: 'Bahraini', BI: 'Burundian',
  BJ: 'Beninese', BN: 'Bruneian', BO: 'Bolivian', BR: 'Brazilian', BS: 'Bahamian',
  BT: 'Bhutanese', BW: 'Botswanan', BY: 'Belarusian', BZ: 'Belizean', CA: 'Canadian',
  CD: 'Congolese (DR Congo)', CF: 'Central African', CG: 'Congolese', CH: 'Swiss',
  CI: 'Ivorian', CL: 'Chilean', CM: 'Cameroonian', CN: 'Chinese', CO: 'Colombian',
  CR: 'Costa Rican', CU: 'Cuban', CV: 'Cabo Verdean', CY: 'Cypriot', CZ: 'Czech',
  DE: 'German', DJ: 'Djiboutian', DK: 'Danish', DM: 'Dominican (Dominica)',
  DO: 'Dominican (Dominican Republic)', DZ: 'Algerian', EC: 'Ecuadorian', EE: 'Estonian',
  EG: 'Egyptian', ER: 'Eritrean', ES: 'Spanish', ET: 'Ethiopian', FI: 'Finnish',
  FJ: 'Fijian', FM: 'Micronesian', FR: 'French', GA: 'Gabonese', GB: 'British',
  GD: 'Grenadian', GE: 'Georgian', GH: 'Ghanaian', GM: 'Gambian', GN: 'Guinean',
  GQ: 'Equatorial Guinean', GR: 'Greek', GT: 'Guatemalan', GW: 'Bissau-Guinean',
  GY: 'Guyanese', HN: 'Honduran', HR: 'Croatian', HT: 'Haitian', HU: 'Hungarian',
  ID: 'Indonesian', IE: 'Irish', IL: 'Israeli', IN: 'Indian', IQ: 'Iraqi', IR: 'Iranian',
  IS: 'Icelandic', IT: 'Italian', JM: 'Jamaican', JO: 'Jordanian', JP: 'Japanese',
  KE: 'Kenyan', KG: 'Kyrgyz', KH: 'Cambodian', KI: 'I-Kiribati', KM: 'Comoran',
  KN: 'Kittitian or Nevisian', KP: 'North Korean', KR: 'South Korean', KW: 'Kuwaiti',
  KZ: 'Kazakhstani', LA: 'Lao', LB: 'Lebanese', LC: 'Saint Lucian', LI: 'Liechtensteiner',
  LK: 'Sri Lankan', LR: 'Liberian', LS: 'Basotho', LT: 'Lithuanian', LU: 'Luxembourgish',
  LV: 'Latvian', LY: 'Libyan', MA: 'Moroccan', MC: 'Monégasque', MD: 'Moldovan',
  ME: 'Montenegrin', MG: 'Malagasy', MH: 'Marshallese', MK: 'Macedonian', ML: 'Malian',
  MM: 'Burmese', MN: 'Mongolian', MR: 'Mauritanian', MT: 'Maltese', MU: 'Mauritian',
  MV: 'Maldivian', MW: 'Malawian', MX: 'Mexican', MY: 'Malaysian', MZ: 'Mozambican',
  NA: 'Namibian', NE: 'Nigerien', NG: 'Nigerian', NI: 'Nicaraguan', NL: 'Dutch',
  NO: 'Norwegian', NP: 'Nepali', NR: 'Nauruan', NZ: 'New Zealander', OM: 'Omani',
  PA: 'Panamanian', PE: 'Peruvian', PG: 'Papua New Guinean', PH: 'Filipino',
  PK: 'Pakistani', PL: 'Polish', PS: 'Palestinian', PT: 'Portuguese', PW: 'Palauan',
  PY: 'Paraguayan', QA: 'Qatari', RO: 'Romanian', RS: 'Serbian', RU: 'Russian',
  RW: 'Rwandan', SA: 'Saudi Arabian', SB: 'Solomon Islander', SC: 'Seychellois',
  SD: 'Sudanese', SE: 'Swedish', SG: 'Singaporean', SI: 'Slovenian', SK: 'Slovak',
  SL: 'Sierra Leonean', SM: 'Sammarinese', SN: 'Senegalese', SO: 'Somali',
  SR: 'Surinamese', SS: 'South Sudanese', ST: 'São Toméan', SV: 'Salvadoran',
  SY: 'Syrian', SZ: 'Swazi', TD: 'Chadian', TG: 'Togolese', TH: 'Thai', TJ: 'Tajik',
  TL: 'Timorese', TM: 'Turkmen', TN: 'Tunisian', TO: 'Tongan', TR: 'Turkish',
  TT: 'Trinidadian or Tobagonian', TV: 'Tuvaluan', TW: 'Taiwanese', TZ: 'Tanzanian',
  UA: 'Ukrainian', UG: 'Ugandan', US: 'American', UY: 'Uruguayan', UZ: 'Uzbek',
  VA: 'Vatican', VC: 'Vincentian', VE: 'Venezuelan', VN: 'Vietnamese', VU: 'Ni-Vanuatu',
  WS: 'Samoan', XK: 'Kosovar', YE: 'Yemeni', ZA: 'South African', ZM: 'Zambian',
  ZW: 'Zimbabwean',
};

// A few regions ICU names awkwardly or not at all for this use.
const NAME_OVERRIDE = {
  XK: 'Kosovo',
  AC: 'Ascension Island',
  TA: 'Tristan da Cunha',
  BQ: 'Caribbean Netherlands',
  VA: 'Vatican City',
  KP: 'North Korea',
  KR: 'South Korea',
  CD: 'Congo (DR)',
  CG: 'Congo (Republic)',
  GB: 'United Kingdom',
  US: 'United States',
  RU: 'Russia',
  SY: 'Syria',
  IR: 'Iran',
  LA: 'Laos',
  MM: 'Myanmar',
  MD: 'Moldova',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  VE: 'Venezuela',
  VN: 'Vietnam',
  BO: 'Bolivia',
  FM: 'Micronesia',
  PS: 'Palestine',
  BN: 'Brunei',
  CV: 'Cabo Verde',
  CI: 'Côte d’Ivoire',
  SZ: 'Eswatini',
  MK: 'North Macedonia',
  TL: 'Timor-Leste',
  NL: 'Netherlands',
  CZ: 'Czechia',
};

const display = new Intl.DisplayNames(['en'], { type: 'region' });

const rows = getCountries()
  .map((iso) => {
    const name = NAME_OVERRIDE[iso] ?? display.of(iso) ?? iso;
    const dial = getCountryCallingCode(iso);
    return {
      iso,
      name,
      nationality: DEMONYM[iso] ?? name,
      dial,
      primary: primaryForCode.get(dial) === iso,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const missing = rows.filter((r) => r.name === r.iso);
if (missing.length) console.warn('No ICU name for:', missing.map((r) => r.iso).join(' '));

const body = rows
  .map((r) => `  { iso: '${r.iso}', name: ${JSON.stringify(r.name)}, nationality: ${JSON.stringify(r.nationality)}, dial: '${r.dial}', primary: ${r.primary} },`)
  .join('\n');

const file = `/**
 * Generated from libphonenumber-js's country list — every region it can validate
 * a number for. Static rather than derived at runtime so the server and the
 * browser always render identical <option> lists.
 *
 * Regenerate with: node scripts/gen-countries.mjs
 */
export interface Country {
  /** ISO 3166-1 alpha-2. */
  iso: string;
  name: string;
  /** Demonym where one is in common use, otherwise the country name. */
  nationality: string;
  /** International dialling code, without the leading +. */
  dial: string;
  /** True for the main country on a shared dialling code (GB for +44). */
  primary: boolean;
}

export const COUNTRIES: Country[] = [
${body}
];

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((country) => [country.iso, country]),
);

/** Turns 'TH' into 🇹🇭 using regional indicator symbols. */
export function flagEmoji(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return '';
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function countryName(iso: string): string {
  return COUNTRY_BY_ISO[iso]?.name ?? iso;
}

export function dialCode(iso: string): string {
  const country = COUNTRY_BY_ISO[iso];
  return country ? \`+\${country.dial}\` : '';
}

/** Default for the phone picker — this is a Thai clinic product. */
export const DEFAULT_PHONE_COUNTRY = 'TH';
`;

writeFileSync(new URL('../src/lib/countries.ts', import.meta.url), file);
console.log('wrote', rows.length, 'countries');
console.log(rows.filter((r) => ['TH', 'US', 'GB'].includes(r.iso)));
