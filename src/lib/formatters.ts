import type { ClientRecord, PayoutRecord } from '../types/crm';
import { CLIENT_STATUS_LABELS } from '../types/crm';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

export function formatRubles(amount: number): string {
  if (!Number.isFinite(amount)) return '0 ₽';
  return currencyFormatter.format(Math.round(amount));
}

export function formatDateRu(isoDate: string): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export function formatMonthRu(periodMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodMonth.trim());
  if (!match) return periodMonth || '—';
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return periodMonth;
  return `${MONTHS_RU[monthIdx]} ${year}`;
}

export function pluralizeChildren(count: number): string {
  const abs = Math.abs(Math.floor(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${abs} детей`;
  if (mod10 === 1) return `${abs} ребёнок`;
  if (mod10 >= 2 && mod10 <= 4) return `${abs} ребёнка`;
  return `${abs} детей`;
}

export function pluralizePayouts(count: number): string {
  const abs = Math.abs(Math.floor(count));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${abs} выплат`;
  if (mod10 === 1) return `${abs} выплата`;
  if (mod10 >= 2 && mod10 <= 4) return `${abs} выплаты`;
  return `${abs} выплат`;
}

export function calculateChildAge(birthDate: string): string | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return null;
  const birth = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  if (Number.isNaN(birth.getTime()) || birth > now) return null;

  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  if (years < 1) {
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    return `${Math.max(0, months)} мес.`;
  }
  const mod100 = years % 100;
  const mod10 = years % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${years} лет`;
  if (mod10 === 1) return `${years} год`;
  if (mod10 >= 2 && mod10 <= 4) return `${years} года`;
  return `${years} лет`;
}

export function getDaysUntil(isoDate: string): number | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthIso(): string {
  return getTodayIso().slice(0, 7);
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(filename: string, rows: (string | number)[][]): void {
  const csvContent = '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportClientsToCsv(
  clients: ClientRecord[],
  payoutsByClient: Map<string, PayoutRecord[]>
): void {
  const header = [
    'ФИО',
    'Телефон',
    'СНИЛС',
    'Регион',
    'Количество детей',
    'Статус',
    'Размер (% ПМ)',
    'Ежемесячная сумма (₽)',
    'Всего получено (₽)',
    'Кол-во выплат',
    'Дата последней выплаты',
    'Дата назначения',
    'Дата продления',
    'Примечание',
  ];

  const rows = clients.map((client) => {
    const clientPayouts = payoutsByClient.get(client.id) ?? [];
    const totalReceived = clientPayouts.reduce((sum, p) => sum + p.amount, 0);
    const lastPayout = clientPayouts[0]?.payoutDate ? formatDateRu(clientPayouts[0].payoutDate) : '';
    return [
      client.fullName,
      client.phone,
      client.snils,
      client.region,
      client.childrenCount,
      CLIENT_STATUS_LABELS[client.status],
      client.benefitPercent ? `${client.benefitPercent}%` : '—',
      client.monthlyAmount,
      totalReceived,
      clientPayouts.length,
      lastPayout,
      formatDateRu(client.firstBenefitDate),
      formatDateRu(client.renewalDate),
      client.notes,
    ];
  });

  triggerCsvDownload(`klienty-edinoe-posobie-${getTodayIso()}.csv`, [header, ...rows]);
}

export function exportPayoutsToCsv(payouts: PayoutRecord[]): void {
  const header = [
    'Дата выплаты',
    'Расчётный месяц',
    'ФИО клиента',
    'Сумма (₽)',
    'Размер (% ПМ)',
    'Детей в выплате',
    'Комментарий',
  ];

  const rows = payouts.map((p) => [
    formatDateRu(p.payoutDate),
    formatMonthRu(p.periodMonth),
    p.clientName,
    p.amount,
    `${p.benefitPercent}%`,
    p.childrenCovered,
    p.comment,
  ]);

  triggerCsvDownload(`vyplaty-edinoe-posobie-${getTodayIso()}.csv`, [header, ...rows]);
}
