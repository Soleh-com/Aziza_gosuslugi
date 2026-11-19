import { CalendarClock } from 'lucide-react';
import {
  CLIENT_STATUS_LABELS,
  type ClientRecord,
  type PayoutRecord,
} from '../types/crm';
import {
  formatDateRu,
  formatRubles,
  getDaysUntil,
  pluralizeChildren,
} from '../lib/formatters';

interface RenewalsViewProps {
  clients: ClientRecord[];
  payouts: PayoutRecord[];
  loading: boolean;
  onOpenClient: (clientId: string) => void;
}

export function RenewalsView({ clients, payouts, loading, onOpenClient }: RenewalsViewProps) {
  const activeClients = clients.filter((c) => c.status !== 'archived');

  const lastPayoutByClient = new Map<string, PayoutRecord>();
  for (const p of payouts) {
    if (!lastPayoutByClient.has(p.clientId)) {
      lastPayoutByClient.set(p.clientId, p);
    }
  }

  const withDates = activeClients
    .map((client) => ({
      client,
      days: getDaysUntil(client.renewalDate),
    }))
    .sort((a, b) => {
      if (a.days === null && b.days === null) return a.client.fullName.localeCompare(b.client.fullName, 'ru');
      if (a.days === null) return 1;
      if (b.days === null) return -1;
      return a.days - b.days;
    });

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (activeClients.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4">
          <CalendarClock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Нет активных дел</h2>
        <p className="text-sm text-slate-600">
          После добавления клиентов с датой продления здесь появится график сроков подачи заявлений на новый срок.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">График продлений единого пособия</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Сортировка по срочности окончания 12-месячного периода назначения
          </p>
        </div>
      </div>

      <table className="w-full text-left border-collapse min-w-[780px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
            <th className="py-3 px-5">Срок продления</th>
            <th className="py-3 px-4">Осталось</th>
            <th className="py-3 px-4">Клиент</th>
            <th className="py-3 px-4">Дети и ставка</th>
            <th className="py-3 px-4">Последняя выплата</th>
            <th className="py-3 px-5 text-right">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {withDates.map(({ client, days }) => {
            const lastPayout = lastPayoutByClient.get(client.id);
            const urgencyTone =
              days === null
                ? 'text-slate-500'
                : days <= 0
                  ? 'text-red-700 font-semibold'
                  : days <= 30
                    ? 'text-amber-700 font-semibold'
                    : 'text-slate-700';

            const urgencyText =
              days === null
                ? 'Дата не указана'
                : days < 0
                  ? `Просрочено на ${Math.abs(days)} дн.`
                  : days === 0
                    ? 'Сегодня'
                    : `Через ${days} дн.`;

            return (
              <tr
                key={client.id}
                onClick={() => onOpenClient(client.id)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="py-3.5 px-5 font-mono tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                  {formatDateRu(client.renewalDate)}
                </td>
                <td className={`py-3.5 px-4 text-xs tabular-nums whitespace-nowrap ${urgencyTone}`}>
                  {urgencyText}
                </td>
                <td className="py-3.5 px-4">
                  <p className="font-medium text-slate-900">{client.fullName}</p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">{client.phone || '—'}</p>
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                  {pluralizeChildren(client.childrenCount)} ·{' '}
                  {client.benefitPercent > 0 ? `${client.benefitPercent}% ПМ` : '—'} ·{' '}
                  <span className="font-mono">{formatRubles(client.monthlyAmount)}</span>
                </td>
                <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
                  {lastPayout
                    ? `${formatDateRu(lastPayout.payoutDate)} (${formatRubles(lastPayout.amount)})`
                    : 'Нет записей'}
                </td>
                <td className="py-3.5 px-5 text-right text-xs text-slate-700 whitespace-nowrap">
                  {CLIENT_STATUS_LABELS[client.status]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
