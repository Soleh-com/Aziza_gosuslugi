import { ArrowRight, Plus, Users } from 'lucide-react';
import {
  CLIENT_STATUS_DOTS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONES,
  type ClientRecord,
  type PayoutRecord,
} from '../types/crm';
import {
  formatDateRu,
  formatMonthRu,
  formatRubles,
  getDaysUntil,
  pluralizeChildren,
  pluralizePayouts,
} from '../lib/formatters';

interface OverviewViewProps {
  clients: ClientRecord[];
  payouts: PayoutRecord[];
  loading: boolean;
  onOpenClient: (clientId: string) => void;
  onAddClient: () => void;
  onNavigate: (tab: 'clients' | 'payouts' | 'renewals') => void;
}

export function OverviewView({
  clients,
  payouts,
  loading,
  onOpenClient,
  onAddClient,
  onNavigate,
}: OverviewViewProps) {
  const activeClients = clients.filter((c) => c.status !== 'archived');
  const approvedCount = activeClients.filter((c) => c.status === 'active').length;
  const totalChildren = activeClients.reduce((sum, c) => sum + c.childrenCount, 0);
  const totalDisbursed = payouts.reduce((sum, p) => sum + p.amount, 0);
  const monthlyCommitment = activeClients
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + c.monthlyAmount, 0);

  const urgentRenewals = activeClients
    .map((client) => ({
      client,
      days: getDaysUntil(client.renewalDate),
    }))
    .filter((item) => item.days !== null && item.days <= 30)
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));

  // Aggregate payouts by periodMonth (last 6 active months)
  const monthlyMap = new Map<string, { total: number; count: number }>();
  for (const p of payouts) {
    const key = p.periodMonth || p.payoutDate.slice(0, 7);
    const prev = monthlyMap.get(key) ?? { total: 0, count: 0 };
    monthlyMap.set(key, { total: prev.total + p.amount, count: prev.count + 1 });
  }
  const monthlySeries = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);
  const maxMonthTotal = Math.max(1, ...monthlySeries.map(([, v]) => v.total));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 space-y-2.5 animate-pulse">
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="h-7 w-24 bg-slate-200 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto mt-8">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">База клиентов пока пуста</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
          Добавьте первого клиента по единому пособию: укажите ФИО, количество детей и их даты рождения,
          размер пособия и даты полученных выплат.
        </p>
        <button
          type="button"
          onClick={onAddClient}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить первого клиента
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Клиентов в базе</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
            {activeClients.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Назначено пособие: {approvedCount}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Детей на учёте</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
            {totalChildren}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            В среднем{' '}
            {activeClients.length > 0 ? (totalChildren / activeClients.length).toFixed(1) : '0'} на семью
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Выплачено всего (зафиксировано)</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
            {formatRubles(totalDisbursed)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {pluralizePayouts(payouts.length)} · План/мес: {formatRubles(monthlyCommitment)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Продлений в ближайшие 30 дн.</p>
          <p
            className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              urgentRenewals.length > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {urgentRenewals.length}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('renewals')}
            className="text-xs text-blue-700 hover:text-blue-800 font-medium mt-1 inline-flex items-center gap-1"
          >
            Перейти к очереди
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main 2-column content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Monthly disbursements + recent payouts */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Динамика выплат по месяцам</h2>
                <p className="text-xs text-slate-500 mt-0.5">Суммы полученных пособий по расчётным периодам</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('payouts')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Все выплаты
              </button>
            </div>

            {monthlySeries.length > 0 ? (
              <div className="space-y-3">
                {monthlySeries.map(([monthKey, stats]) => {
                  const pct = Math.max(4, Math.round((stats.total / maxMonthTotal) * 100));
                  return (
                    <div key={monthKey} className="grid grid-cols-12 items-center gap-3 text-xs">
                      <span className="col-span-4 sm:col-span-3 text-slate-700 font-medium truncate">
                        {formatMonthRu(monthKey)}
                      </span>
                      <div className="col-span-5 sm:col-span-6 h-6 bg-slate-100 rounded overflow-hidden flex items-center">
                        <div
                          className="h-full bg-blue-700 rounded-r transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="col-span-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatRubles(stats.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-6 text-center">
                Запишите выплаты по клиентам, чтобы увидеть статистику по месяцам.
              </p>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Последние выплаты</h2>
              <button
                type="button"
                onClick={() => onNavigate('payouts')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Открыть журнал
              </button>
            </div>

            {payouts.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-5">Дата</th>
                    <th className="py-2.5 px-4">Клиент</th>
                    <th className="py-2.5 px-4">Период</th>
                    <th className="py-2.5 px-5 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {payouts.slice(0, 6).map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => onOpenClient(p.clientId)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-5 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatDateRu(p.payoutDate)}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 truncate max-w-[200px]">
                        {p.clientName}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {formatMonthRu(p.periodMonth)} · {p.benefitPercent}%
                      </td>
                      <td className="py-2.5 px-5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatRubles(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500 p-6 text-center">Выплаты ещё не добавлены.</p>
            )}
          </section>
        </div>

        {/* Right: Upcoming renewals & recent clients */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Ближайшие продления</h2>
              <button
                type="button"
                onClick={() => onNavigate('renewals')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Все сроки
              </button>
            </div>

            {urgentRenewals.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {urgentRenewals.slice(0, 6).map(({ client, days }) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => onOpenClient(client.id)}
                    className="w-full text-left px-6 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{client.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {pluralizeChildren(client.childrenCount)} · {client.benefitPercent}% ПМ
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                        {formatDateRu(client.renewalDate)}
                      </p>
                      <p
                        className={`text-xs mt-0.5 tabular-nums ${
                          days !== null && days < 0 ? 'text-red-700 font-medium' : 'text-amber-700'
                        }`}
                      >
                        {days !== null && days < 0
                          ? `Просрочено (${Math.abs(days)} дн.)`
                          : days === 0
                            ? 'Сегодня'
                            : `Через ${days} дн.`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 p-6 text-center">
                Нет клиентов со сроком продления в ближайшие 30 дней.
              </p>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">Клиенты в базе</h2>
              <button
                type="button"
                onClick={() => onNavigate('clients')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                Вся таблица
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {activeClients.slice(0, 5).map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onOpenClient(client.id)}
                  className="w-full text-left px-6 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{client.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pluralizeChildren(client.childrenCount)}
                      {client.region ? ` · ${client.region}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${CLIENT_STATUS_DOTS[client.status]}`} />
                    <span className={`font-medium ${CLIENT_STATUS_TONES[client.status]}`}>
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
