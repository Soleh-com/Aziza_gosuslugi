import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createEmptyDocumentsChecklist,
  FIELD_LIMITS,
  type BenefitPercent,
  type ChildInfo,
  type ClientFormInput,
  type ClientRecord,
  type ClientStatus,
  type DocumentsChecklist,
  type PayoutFormInput,
  type PayoutPercent,
  type PayoutRecord,
} from '../types/crm';
import { db, handleFirestoreError, OperationType } from './firebase';

const CLIENTS_COLLECTION = 'clients';
const PAYOUTS_COLLECTION = 'payouts';

function clampString(value: string | undefined | null, maxLen: number): string {
  return String(value ?? '').trim().slice(0, maxLen);
}

function clampInt(value: number, min: number, max: number): number {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

function clampMoney(value: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num * 100) / 100));
}

function sanitizeChildren(children: ChildInfo[]): ChildInfo[] {
  return children
    .slice(0, FIELD_LIMITS.CHILDREN_LIST_MAX)
    .map((child) => ({
      name: clampString(child.name, FIELD_LIMITS.CHILD_NAME_MAX),
      birthDate: clampString(child.birthDate, FIELD_LIMITS.DATE_MAX),
    }))
    .filter((child) => child.name.length > 0 || child.birthDate.length > 0);
}

function sanitizeBenefitPercent(val: number): BenefitPercent {
  if (val === 50 || val === 75 || val === 100) return val;
  return 0;
}

function sanitizePayoutPercent(val: number): PayoutPercent {
  if (val === 75 || val === 100) return val;
  return 50;
}

function sanitizeClientStatus(status: ClientStatus): ClientStatus {
  const allowed: ClientStatus[] = ['active', 'pending', 'renewal', 'denied', 'archived'];
  return allowed.includes(status) ? status : 'active';
}

function sanitizeDocumentsChecklist(raw: unknown): DocumentsChecklist {
  const fallback = createEmptyDocumentsChecklist();
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;

  const parseItem = (key: keyof DocumentsChecklist) => {
    const item = obj[key];
    if (!item || typeof item !== 'object') return fallback[key];
    const rec = item as Record<string, unknown>;
    return {
      submitted: Boolean(rec.submitted),
      submittedDate: clampString(
        typeof rec.submittedDate === 'string' ? rec.submittedDate : '',
        FIELD_LIMITS.DATE_MAX
      ),
    };
  };

  return {
    application: parseItem('application'),
    passport: parseItem('passport'),
    incomeCertificate: parseItem('incomeCertificate'),
  };
}

export interface InitialPayoutDraft {
  enabled: boolean;
  amount: number;
  payoutDate: string;
  periodMonth: string;
  benefitPercent: PayoutPercent;
  childrenCovered: number;
  comment: string;
}

export function subscribeToClients(
  ownerId: string,
  onData: (clients: ClientRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, CLIENTS_COLLECTION), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const records: ClientRecord[] = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          ownerId: String(data.ownerId ?? ''),
          fullName: String(data.fullName ?? ''),
          phone: String(data.phone ?? ''),
          snils: String(data.snils ?? ''),
          region: String(data.region ?? ''),
          childrenCount: Number(data.childrenCount ?? 0),
          children: Array.isArray(data.children)
            ? data.children.map((c: Record<string, unknown>) => ({
                name: String(c?.name ?? ''),
                birthDate: String(c?.birthDate ?? ''),
              }))
            : [],
          benefitPercent: sanitizeBenefitPercent(Number(data.benefitPercent ?? 0)),
          monthlyAmount: Number(data.monthlyAmount ?? 0),
          status: sanitizeClientStatus(data.status as ClientStatus),
          firstBenefitDate: String(data.firstBenefitDate ?? ''),
          renewalDate: String(data.renewalDate ?? ''),
          notes: String(data.notes ?? ''),
          docsDueDate: String(data.docsDueDate ?? ''),
          documentsChecklist: sanitizeDocumentsChecklist(data.documentsChecklist),
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });
      records.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CLIENTS_COLLECTION);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        } else {
          throw wrapped;
        }
      }
    }
  );
}

export function subscribeToPayouts(
  ownerId: string,
  onData: (payouts: PayoutRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, PAYOUTS_COLLECTION), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const records: PayoutRecord[] = snapshot.docs.map((snap) => {
        const data = snap.data();
        return {
          id: snap.id,
          ownerId: String(data.ownerId ?? ''),
          clientId: String(data.clientId ?? ''),
          clientName: String(data.clientName ?? ''),
          amount: Number(data.amount ?? 0),
          payoutDate: String(data.payoutDate ?? ''),
          periodMonth: String(data.periodMonth ?? ''),
          benefitPercent: sanitizePayoutPercent(Number(data.benefitPercent ?? 50)),
          childrenCovered: Number(data.childrenCovered ?? 0),
          comment: String(data.comment ?? ''),
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
        };
      });
      records.sort((a, b) => b.payoutDate.localeCompare(a.payoutDate));
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, PAYOUTS_COLLECTION);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        } else {
          throw wrapped;
        }
      }
    }
  );
}

export async function createClientWithOptionalPayout(
  ownerId: string,
  input: ClientFormInput,
  initialPayout?: InitialPayoutDraft
): Promise<string> {
  const clientRef = doc(collection(db, CLIENTS_COLLECTION));
  const fullName = clampString(input.fullName, FIELD_LIMITS.FULL_NAME_MAX);
  if (fullName.length < FIELD_LIMITS.FULL_NAME_MIN) {
    throw new Error('ФИО клиента должно содержать минимум 2 символа.');
  }

  const sanitizedChildren = sanitizeChildren(input.children);
  const childrenCount = clampInt(
    Math.max(input.childrenCount, sanitizedChildren.length),
    0,
    FIELD_LIMITS.CHILDREN_MAX
  );

  const clientPayload = {
    ownerId,
    fullName,
    phone: clampString(input.phone, FIELD_LIMITS.PHONE_MAX),
    snils: clampString(input.snils, FIELD_LIMITS.SNILS_MAX),
    region: clampString(input.region, FIELD_LIMITS.REGION_MAX),
    childrenCount,
    children: sanitizedChildren,
    benefitPercent: sanitizeBenefitPercent(input.benefitPercent),
    monthlyAmount: clampMoney(input.monthlyAmount, 0, FIELD_LIMITS.MONTHLY_AMOUNT_MAX),
    status: sanitizeClientStatus(input.status),
    firstBenefitDate: clampString(input.firstBenefitDate, FIELD_LIMITS.DATE_MAX),
    renewalDate: clampString(input.renewalDate, FIELD_LIMITS.DATE_MAX),
    notes: clampString(input.notes, FIELD_LIMITS.NOTES_MAX),
    docsDueDate: clampString(input.docsDueDate, FIELD_LIMITS.DATE_MAX),
    documentsChecklist: sanitizeDocumentsChecklist(input.documentsChecklist),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (initialPayout?.enabled && initialPayout.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(initialPayout.payoutDate)) {
      const batch = writeBatch(db);
      batch.set(clientRef, clientPayload);

      const payoutRef = doc(collection(db, PAYOUTS_COLLECTION));
      const periodMonth = /^\d{4}-\d{2}$/.test(initialPayout.periodMonth)
        ? initialPayout.periodMonth
        : initialPayout.payoutDate.slice(0, 7);

      batch.set(payoutRef, {
        ownerId,
        clientId: clientRef.id,
        clientName: fullName,
        amount: clampMoney(initialPayout.amount, 1, FIELD_LIMITS.PAYOUT_AMOUNT_MAX),
        payoutDate: initialPayout.payoutDate,
        periodMonth,
        benefitPercent: sanitizePayoutPercent(initialPayout.benefitPercent),
        childrenCovered: clampInt(initialPayout.childrenCovered, 0, FIELD_LIMITS.CHILDREN_MAX),
        comment: clampString(initialPayout.comment, FIELD_LIMITS.COMMENT_MAX),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } else {
      await setDoc(clientRef, clientPayload);
    }
    return clientRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${CLIENTS_COLLECTION}/${clientRef.id}`);
  }
}

export async function updateClient(
  clientId: string,
  input: ClientFormInput,
  relatedPayouts: PayoutRecord[] = []
): Promise<void> {
  const fullName = clampString(input.fullName, FIELD_LIMITS.FULL_NAME_MAX);
  if (fullName.length < FIELD_LIMITS.FULL_NAME_MIN) {
    throw new Error('ФИО клиента должно содержать минимум 2 символа.');
  }

  const sanitizedChildren = sanitizeChildren(input.children);
  const childrenCount = clampInt(
    Math.max(input.childrenCount, sanitizedChildren.length),
    0,
    FIELD_LIMITS.CHILDREN_MAX
  );

  const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
  const updatePayload = {
    fullName,
    phone: clampString(input.phone, FIELD_LIMITS.PHONE_MAX),
    snils: clampString(input.snils, FIELD_LIMITS.SNILS_MAX),
    region: clampString(input.region, FIELD_LIMITS.REGION_MAX),
    childrenCount,
    children: sanitizedChildren,
    benefitPercent: sanitizeBenefitPercent(input.benefitPercent),
    monthlyAmount: clampMoney(input.monthlyAmount, 0, FIELD_LIMITS.MONTHLY_AMOUNT_MAX),
    status: sanitizeClientStatus(input.status),
    firstBenefitDate: clampString(input.firstBenefitDate, FIELD_LIMITS.DATE_MAX),
    renewalDate: clampString(input.renewalDate, FIELD_LIMITS.DATE_MAX),
    notes: clampString(input.notes, FIELD_LIMITS.NOTES_MAX),
    docsDueDate: clampString(input.docsDueDate, FIELD_LIMITS.DATE_MAX),
    documentsChecklist: sanitizeDocumentsChecklist(input.documentsChecklist),
    updatedAt: serverTimestamp(),
  };

  try {
    const payoutsToSync = relatedPayouts.filter((p) => p.clientName !== fullName);
    if (payoutsToSync.length > 0 && payoutsToSync.length <= 450) {
      const batch = writeBatch(db);
      batch.update(clientRef, updatePayload);
      for (const payout of payoutsToSync) {
        batch.update(doc(db, PAYOUTS_COLLECTION, payout.id), {
          clientName: fullName,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } else {
      await updateDoc(clientRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLIENTS_COLLECTION}/${clientId}`);
  }
}

export async function updateClientDocuments(
  clientId: string,
  docsDueDate: string,
  documentsChecklist: DocumentsChecklist
): Promise<void> {
  const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
  try {
    await updateDoc(clientRef, {
      docsDueDate: clampString(docsDueDate, FIELD_LIMITS.DATE_MAX),
      documentsChecklist: sanitizeDocumentsChecklist(documentsChecklist),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLIENTS_COLLECTION}/${clientId}`);
  }
}

export async function updateClientStatus(clientId: string, status: ClientStatus): Promise<void> {
  const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
  try {
    await updateDoc(clientRef, {
      status: sanitizeClientStatus(status),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLIENTS_COLLECTION}/${clientId}`);
  }
}

export async function deleteClientWithPayouts(
  clientId: string,
  relatedPayouts: PayoutRecord[]
): Promise<void> {
  const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
  try {
    const batch = writeBatch(db);
    for (const payout of relatedPayouts.slice(0, 450)) {
      batch.delete(doc(db, PAYOUTS_COLLECTION, payout.id));
    }
    batch.delete(clientRef);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CLIENTS_COLLECTION}/${clientId}`);
  }
}

export async function createPayout(ownerId: string, input: PayoutFormInput): Promise<string> {
  const payoutRef = doc(collection(db, PAYOUTS_COLLECTION));
  const clientName = clampString(input.clientName, FIELD_LIMITS.FULL_NAME_MAX);
  const amount = clampMoney(input.amount, 1, FIELD_LIMITS.PAYOUT_AMOUNT_MAX);
  const payoutDate = clampString(input.payoutDate, 10);
  const periodMonth = clampString(input.periodMonth, 7);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payoutDate)) {
    throw new Error('Укажите корректную дату выплаты.');
  }
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new Error('Укажите корректный расчётный месяц.');
  }

  try {
    await setDoc(payoutRef, {
      ownerId,
      clientId: input.clientId,
      clientName: clientName.length >= 2 ? clientName : 'Клиент',
      amount,
      payoutDate,
      periodMonth,
      benefitPercent: sanitizePayoutPercent(input.benefitPercent),
      childrenCovered: clampInt(input.childrenCovered, 0, FIELD_LIMITS.CHILDREN_MAX),
      comment: clampString(input.comment, FIELD_LIMITS.COMMENT_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return payoutRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${PAYOUTS_COLLECTION}/${payoutRef.id}`);
  }
}

export async function updatePayout(
  payoutId: string,
  input: Omit<PayoutFormInput, 'clientId'>
): Promise<void> {
  const payoutRef = doc(db, PAYOUTS_COLLECTION, payoutId);
  const clientName = clampString(input.clientName, FIELD_LIMITS.FULL_NAME_MAX);
  const amount = clampMoney(input.amount, 1, FIELD_LIMITS.PAYOUT_AMOUNT_MAX);
  const payoutDate = clampString(input.payoutDate, 10);
  const periodMonth = clampString(input.periodMonth, 7);

  try {
    await updateDoc(payoutRef, {
      clientName: clientName.length >= 2 ? clientName : 'Клиент',
      amount,
      payoutDate,
      periodMonth,
      benefitPercent: sanitizePayoutPercent(input.benefitPercent),
      childrenCovered: clampInt(input.childrenCovered, 0, FIELD_LIMITS.CHILDREN_MAX),
      comment: clampString(input.comment, FIELD_LIMITS.COMMENT_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PAYOUTS_COLLECTION}/${payoutId}`);
  }
}

export async function deletePayout(payoutId: string): Promise<void> {
  const payoutRef = doc(db, PAYOUTS_COLLECTION, payoutId);
  try {
    await deleteDoc(payoutRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PAYOUTS_COLLECTION}/${payoutId}`);
  }
}
