import { useMemo, useState } from 'react';
import { Download, Plus, Search, Users } from 'lucide-react';
import {
  CLIENT_STATUS_DOTS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONES,
  REQUIRED_DOCUMENT_DEFS,
  type ClientRecord,
  type ClientStatus,
  type PayoutRecord,
} from '../types/crm';
import {
  exportClientsToCsv,
  formatDateRu,
  formatRubles,
  pluralizeChildren,
  pluralizePayouts,
} from '../lib/formatters';

interface ClientsViewProps {
  clients: ClientRecord[];
  payouts: PayoutRecord[];
  loading: boolean;
  onOpenClient: (clientId: string) => void;
  onAddClient: () => void;
  onQuickAddPayout: (clientId: string) => void;
}

type SortKey = 'name' | 'children' | 'total' | 'renewal';

export function ClientsView({
  clients,
  payouts,
  loading,
  onOpenClient,
  onAddClient,
  onQuickAddPayout,
}: ClientsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [percentFilter, setPercentFilter] = useState<'all' | '50' | '75' | '100'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');

  const payoutsByClient = useMemo(() => {
    const map = new Map<string, PayoutRecord[]>();
    for (const p of payouts) {
      const list = map.get(p.clientId) ?? [];
      list.push(p);
      map.set(p.clientId, list);
    }
    return map;
  }, [payouts]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clients.filter((c) => {
      if (statusFilter === 'all') {
        if (c.status === 'archived') return false;
      } else if (c.status !== statusFilter) {
        return false;
      }
      if (percentFilter !== 'all' && String(c.benefitPercent) !== percentFilter) {
        return false;
      }
      if (!q) return true;
      const childNames = c.children.map((ch) => ch.name.toLowerCase()).join(' ');
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.snils.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        childNames.includes(q)
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'children') return b.childrenCount - a.childrenCount;
      if (sortBy === 'total') {
        const sumA = (payoutsByClient.get(a.id) ?? []).reduce((s, p) => s + p.amount, 0);
        const sumB = (payoutsByClient.get(b.id) ?? []).reduce((s, p) => s + p.amount, 0);
        return sumB - sumA;
      }
      if (sortBy === 'renewal') {
        if (!a.renewalDate && !b.renewalDate) return 0;
        if (!a.renewalDate) return 1;
        if (!b.renewalDate) return -1;
        return a.renewalDate.localeCompare(b.renewalDate);
      }
      return a.fullName.localeCompare(b.fullName, 'ru');
    });
  }, [clients, payoutsByClient, search, statusFilter, percentFilter, sortBy]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Список клиентов пуст</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
          Вносите сюда всех клиентов по единому пособию: данные о детях, проценте выплаты и истории
          перечислений.
        </p>
        <button
          type="button"
          onClick={onAddClient}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить клиента
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по ФИО, телефону, СНИЛС, детям..."
              className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['all', 'Активные'],
                ['active', 'Назначено'],
                ['pending', 'Рассмотрение'],
                ['renewal', 'Продление'],
                ['denied', 'Отказ'],
                ['archived', 'Архив'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={percentFilter}
            onChange={(e) => setPercentFilter(e.target.value as 'all' | '50' | '75' | '100')}
            aria-label="Фильтр по проценту пособия"
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="all">Все % ПМ</option>
            <option value="50">50% ПМ</option>
            <option value="75">75% ПМ</option>
            <option value="100">100% ПМ</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Сортировка клиентов"
            className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="name">По ФИО (А–Я)</option>
            <option value="children">По числу детей</option>
            <option value="total">По сумме выплат</option>
            <option value="renewal">По дате продления</option>
          </select>

          <button
            type="button"
            onClick={() => exportClientsToCsv(filteredClients, payoutsByClient)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Экспорт CSV
          </button>
        </div>
      </div>

      {/* Data Grid */}
      {filteredClients.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-5">Клиент и контакты</th>
                <th className="py-3 px-4">Дети</th>
                <th className="py-3 px-4">Статус и размер</th>
                <th className="py-3 px-4 text-right">Ежемесячно / Всего получено</th>
                <th className="py-3 px-4">Последняя выплата и продление</th>
                <th className="py-3 px-5 text-right w-32">Выплата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredClients.map((client) => {
                const clientPayouts = payoutsByClient.get(client.id) ?? [];
                const totalReceived = clientPayouts.reduce((sum, p) => sum + p.amount, 0);
                const lastPayout = clientPayouts[0];
                const childNamesPreview = client.children
                  .map((c) => c.name || formatDateRu(c.birthDate))
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(', ');

                return (
                  <tr
                    key={client.id}
                    onClick={() => onOpenClient(client.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{client.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        {client.phone || 'Нет телефона'}
                        {client.region ? ` · ${client.region}` : ''}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900 tabular-nums">
                        {pluralizeChildren(client.childrenCount)}
                      </p>
                      {childNamesPreview && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[180px]">
                          {childNamesPreview}
                          {client.children.length > 2 ? ` +${client.children.length - 2}` : ''}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${CLIENT_STATUS_DOTS[client.status]}`} />
                        <span className={`font-medium ${CLIENT_STATUS_TONES[client.status]}`}>
                          {CLIENT_STATUS_LABELS[client.status]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        {client.benefitPercent > 0 ? `${client.benefitPercent}% ПМ` : 'Размер не задан'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <p className="font-mono tabular-nums font-semibold text-slate-900">
                        {formatRubles(totalReceived)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        {client.monthlyAmount > 0 ? `${formatRubles(client.monthlyAmount)}/мес` : '—'}
                        {' · '}
                        {pluralizePayouts(clientPayouts.length)}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-xs font-mono tabular-nums text-slate-900">
                        {lastPayout
                          ? `Выплата: ${formatDateRu(lastPayout.payoutDate)}`
                          : 'Выплат ещё нет'}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                        {client.renewalDate
                          ? `Продление: ${formatDateRu(client.renewalDate)}`
                          : 'Продление не указано'}
                        {' · '}
                        Док:{' '}
                        {
                          REQUIRED_DOCUMENT_DEFS.filter(
                            (d) => client.documentsChecklist[d.key].submitted
                          ).length
                        }
                        /3
                        {client.docsDueDate ? ` (до ${formatDateRu(client.docsDueDate)})` : ''}
                      </p>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddPayout(client.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Выплата
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-600">По выбранным фильтрам клиенты не найдены.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setPercentFilter('all');
            }}
            className="mt-3 text-xs font-medium text-blue-700 hover:text-blue-800"
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}
