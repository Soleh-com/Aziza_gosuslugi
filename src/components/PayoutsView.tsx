import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react';
import { type ClientRecord, type PayoutRecord } from '../types/crm';
import {
  exportPayoutsToCsv,
  formatDateRu,
  formatMonthRu,
  formatRubles,
  pluralizePayouts,
} from '../lib/formatters';

interface PayoutsViewProps {
  clients: ClientRecord[];
  payouts: PayoutRecord[];
  loading: boolean;
  onOpenClient: (clientId: string) => void;
  onAddPayout: () => void;
  onEditPayout: (payout: PayoutRecord) => void;
  onDeletePayout: (payoutId: string) => Promise<void>;
}

export function PayoutsView({
  clients,
  payouts,
  loading,
  onOpenClient,
  onAddPayout,
  onEditPayout,
  onDeletePayout,
}: PayoutsViewProps) {
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredPayouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter((p) => {
      if (clientFilter !== 'all' && p.clientId !== clientFilter) return false;
      if (monthFilter && p.periodMonth !== monthFilter) return false;
      if (!q) return true;
      return (
        p.clientName.toLowerCase().includes(q) ||
        p.comment.toLowerCase().includes(q) ||
        formatDateRu(p.payoutDate).includes(q)
      );
    });
  }, [payouts, clientFilter, monthFilter, search]);

  const filteredTotal = useMemo(
    () => filteredPayouts.reduce((sum, p) => sum + p.amount, 0),
    [filteredPayouts]
  );

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Журнал выплат пуст</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
          {clients.length > 0
            ? 'Зафиксируйте первую выплату единого пособия с указанием суммы и точной даты получения.'
            : 'Сначала добавьте клиента в базу, после чего можно будет вести журнал его выплат.'}
        </p>
        {clients.length > 0 && (
          <button
            type="button"
            onClick={onAddPayout}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Записать выплату
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по ФИО, дате или комментарию..."
              className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="Фильтр по клиенту"
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700 max-w-[220px]"
          >
            <option value="all">Все клиенты</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Фильтр по месяцу"
              className="px-3 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg bg-white text-slate-700"
            />
            {monthFilter && (
              <button
                type="button"
                onClick={() => setMonthFilter('')}
                className="text-xs text-slate-500 hover:text-slate-800 px-1.5"
              >
                Сброс
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => exportPayoutsToCsv(filteredPayouts)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Экспорт CSV
          </button>
          {clients.length > 0 && (
            <button
              type="button"
              onClick={onAddPayout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Записать выплату
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
        <span className="tabular-nums">Показано: {pluralizePayouts(filteredPayouts.length)}</span>
        <span className="font-semibold text-slate-900 font-mono tabular-nums">
          Итого по выборке: {formatRubles(filteredTotal)}
        </span>
      </div>

      {filteredPayouts.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-5">Дата получения</th>
                <th className="py-3 px-4">Расчётный месяц</th>
                <th className="py-3 px-4">Клиент</th>
                <th className="py-3 px-4">Параметры</th>
                <th className="py-3 px-4">Комментарий</th>
                <th className="py-3 px-4 text-right">Сумма</th>
                <th className="py-3 px-5 text-right w-24">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredPayouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-5 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                    {formatDateRu(payout.payoutDate)}
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-900 whitespace-nowrap">
                    {formatMonthRu(payout.periodMonth)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onOpenClient(payout.clientId)}
                      className="font-medium text-blue-700 hover:text-blue-900 hover:underline text-left"
                    >
                      {payout.clientName}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {payout.benefitPercent}% ПМ · {payout.childrenCovered} дет.
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500 truncate max-w-[200px]">
                    {payout.comment || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatRubles(payout.amount)}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    {confirmDeleteId === payout.id ? (
                      <div className="inline-flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => onDeletePayout(payout.id).then(() => setConfirmDeleteId(null))}
                          className="font-medium text-red-700 hover:underline"
                        >
                          Удалить
                        </button>
                        <span className="text-slate-300">/</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-slate-500 hover:underline"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditPayout(payout)}
                          aria-label="Редактировать выплату"
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(payout.id)}
                          aria-label="Удалить выплату"
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-600">Выплаты по заданным фильтрам не найдены.</p>
        </div>
      )}
    </div>
  );
}
