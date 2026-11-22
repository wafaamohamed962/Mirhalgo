import type { DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import {
  DOCUMENT_TYPES,
  FILE_RULES,
  TERMS_VERSION,
  companyAccountStepSchema,
  companyLegalStepSchema,
  companyRegistrationSchema,
  companyServicesStepSchema,
  needsServicesStep,
  type CompanyActivity,
  type CompanyRegistrationFormValues,
  type DocumentType,
} from '@mirhalgo/shared';

/*
 * Wizard model (MW_002 A1/A2): form values = the shared application + the picked files.
 * Validation always uses the shared schemas (the API validates with the same ones).
 */

export type DocumentFiles = Partial<Record<DocumentType, File | null>>;
export type CompanyFormValues = CompanyRegistrationFormValues & { files: DocumentFiles };

export const STEP_IDS = ['account', 'services', 'documents', 'review'] as const;
export type StepId = (typeof STEP_IDS)[number];

/** Presence only: type and size are checked when a file is picked (fileChecks.ts). */
const filesSchema = z.object(
  Object.fromEntries(
    DOCUMENT_TYPES.map((type) => [
      type,
      FILE_RULES[type].required
        ? z.instanceof(File, { message: 'validation.fileRequired' })
        : z.instanceof(File).nullish(),
    ]),
  ),
);

/** "Next" validates the current step only (spec A1); Submit validates everything. */
export const STEP_SCHEMAS: Record<StepId, z.ZodTypeAny> = {
  account: companyAccountStepSchema,
  services: companyServicesStepSchema,
  documents: companyLegalStepSchema.extend({ files: filesSchema }),
  review: companyRegistrationSchema.and(z.object({ files: filesSchema })),
};

/** Which step owns each top-level field: used to jump to the first error on submit. */
const STEP_OF_FIELD: Record<string, StepId> = {
  international: 'services',
  domestic: 'services',
  china: 'services',
  yearsInBusiness: 'services',
  commercialRegisterNumber: 'documents',
  taxNumber: 'documents',
  files: 'documents',
  notes: 'review',
  confirmAccuracy: 'review',
  acceptTerms: 'review',
  termsVersion: 'review',
};
export const stepOfField = (field: string): StepId => STEP_OF_FIELD[field] ?? 'account';

/** Step 2 is skipped when "Other" is the only activity (spec A2). */
export const isStepSkipped = (step: StepId, activities: readonly CompanyActivity[] = []) =>
  step === 'services' && activities.length > 0 && !needsServicesStep(activities);

/** The empty form (enums without a choice yet stay unset: "Select…", no radio checked). */
export const EMPTY_VALUES: DefaultValues<CompanyFormValues> = {
  legalName: '',
  representativeName: '',
  representativeTitle: '',
  email: '',
  phone: '',
  whatsappSameAsMobile: true,
  whatsapp: '',
  landline: '',
  city: '',
  street: '',
  website: '',
  password: '',
  confirmPassword: '',
  activities: [],
  otherActivity: '',
  // every section exists; the schema ignores the ones whose activity is not selected
  international: { modes: [], countries: [], regions: [] },
  domestic: {
    allGovernorates: false,
    governorates: [],
    vehicleTypes: [],
    vehicleTypeOther: '',
    fleetSize: '',
  },
  china: { sites: [], siteOther: '', services: [] },
  yearsInBusiness: '',
  commercialRegisterNumber: '',
  taxNumber: '',
  notes: '',
  termsVersion: TERMS_VERSION,
  files: {},
};
