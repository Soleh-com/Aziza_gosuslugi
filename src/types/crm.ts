import type { Timestamp } from 'firebase/firestore';

export type ClientStatus = 'active' | 'pending' | 'renewal' | 'denied' | 'archived';
export type BenefitPercent = 0 | 50 | 75 | 100;
export type PayoutPercent = 50 | 75 | 100;

export interface ChildInfo {
  name: string;
  birthDate: string;
}

export type DocumentKey = 'application' | 'passport' | 'incomeCertificate';

export interface DocumentItemState {
  submitted: boolean;
  submittedDate: string;
}

export interface DocumentsChecklist {
  application: DocumentItemState;
  passport: DocumentItemState;
  incomeCertificate: DocumentItemState;
}

export const REQUIRED_DOCUMENT_DEFS: { key: DocumentKey; label: string; hint: string }[] = [
  { key: 'application', label: 'Заявление', hint: 'Заявление о назначении единого пособия' },
  { key: 'passport', label: 'Паспорт', hint: 'Паспорт заявителя (развороты с фото и пропиской)' },
  {
    key: 'incomeCertificate',
    label: 'Справка о доходах',
    hint: 'Справка о доходах (2-НДФЛ или справка за расчётный период)',
  },
];

export function createEmptyDocumentsChecklist(): DocumentsChecklist {
  return {
    application: { submitted: false, submittedDate: '' },
    passport: { submitted: false, submittedDate: '' },
    incomeCertificate: { submitted: false, submittedDate: '' },
  };
}

export interface ClientRecord {
  id: string;
  ownerId: string;
  fullName: string;
  phone: string;
  snils: string;
  region: string;
  childrenCount: number;
  children: ChildInfo[];
  benefitPercent: BenefitPercent;
  monthlyAmount: number;
  status: ClientStatus;
  firstBenefitDate: string;
  renewalDate: string;
  notes: string;
  docsDueDate: string;
  documentsChecklist: DocumentsChecklist;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PayoutRecord {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  amount: number;
  payoutDate: string;
  periodMonth: string;
  benefitPercent: PayoutPercent;
  childrenCovered: number;
  comment: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ClientFormInput {
  fullName: string;
  phone: string;
  snils: string;
  region: string;
  childrenCount: number;
  children: ChildInfo[];
  benefitPercent: BenefitPercent;
  monthlyAmount: number;
  status: ClientStatus;
  firstBenefitDate: string;
  renewalDate: string;
  notes: string;
  docsDueDate: string;
  documentsChecklist: DocumentsChecklist;
}

export interface PayoutFormInput {
  clientId: string;
  clientName: string;
  amount: number;
  payoutDate: string;
  periodMonth: string;
  benefitPercent: PayoutPercent;
  childrenCovered: number;
  comment: string;
}

export const FIELD_LIMITS = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 120,
  PHONE_MAX: 32,
  SNILS_MAX: 20,
  REGION_MAX: 80,
  CHILDREN_MAX: 20,
  CHILDREN_LIST_MAX: 15,
  CHILD_NAME_MAX: 80,
  DATE_MAX: 20,
  NOTES_MAX: 1000,
  MONTHLY_AMOUNT_MAX: 1000000,
  PAYOUT_AMOUNT_MAX: 2000000,
  COMMENT_MAX: 300,
} as const;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Назначено',
  pending: 'На рассмотрении',
  renewal: 'Требует продления',
  denied: 'Отказ',
  archived: 'В архиве',
};

export const CLIENT_STATUS_TONES: Record<ClientStatus, string> = {
  active: 'text-emerald-700',
  pending: 'text-amber-700',
  renewal: 'text-amber-700',
  denied: 'text-red-700',
  archived: 'text-slate-500',
};

export const CLIENT_STATUS_DOTS: Record<ClientStatus, string> = {
  active: 'bg-emerald-600',
  pending: 'bg-amber-600',
  renewal: 'bg-amber-600',
  denied: 'bg-red-600',
  archived: 'bg-slate-400',
};
