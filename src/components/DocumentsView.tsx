import { useMemo, useState } from 'react';
import { Check, FileCheck2, Search } from 'lucide-react';
import {
  REQUIRED_DOCUMENT_DEFS,
  type ClientRecord,
  type DocumentKey,
  type DocumentsChecklist,
} from '../types/crm';
import { formatDateRu, getDaysUntil, getTodayIso, pluralizeChildren } from '../lib/formatters';

interface DocumentsViewProps {
  clients: ClientRecord[];
  loading: boolean;
  onOpenClient: (clientId: string) => void;
  onUpdateClientDocuments: (
    clientId: string,
    docsDueDate: string,
    checklist: DocumentsChecklist
  ) => Promise<void>;
}

type DocsFilter = 'all' | 'pending' | 'urgent' | 'complete';

export function DocumentsView({
  clients,
  loading,
  onOpenClient,
  onUpdateClientDocuments,
}: DocumentsViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DocsFilter>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  const activeClients = useMemo(
    () => clients.filter((c) => c.status !== 'archived'),
    [clients]
  );

  const getSubmittedCount = (checklist: DocumentsChecklist) =>
    REQUIRED_DOCUMENT_DEFS.filter((def) => checklist[def.key].submitted).length;

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeClients
      .filter((client) => {
        const done = getSubmittedCount(client.documentsChecklist);
        const days = getDaysUntil(client.docsDueDate);
        if (filter === 'pending' && done === REQUIRED_DOCUMENT_DEFS.length) return false;
        if (filter === 'complete' && done < REQUIRED_DOCUMENT_DEFS.length) return false;
        if (filter === 'urgent') {
          if (done === REQUIRED_DOCUMENT_DEFS.length) return false;
          if (days === null || days > 14) return false;
        }
        if (!q) return true;
        return (
          client.fullName.toLowerCase().includes(q) ||
          client.phone.toLowerCase().includes(q) ||
          client.region.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const doneA = getSubmittedCount(a.documentsChecklist) === REQUIRED_DOCUMENT_DEFS.length;
        const doneB = getSubmittedCount(b.documentsChecklist) === REQUIRED_DOCUMENT_DEFS.length;
        if (doneA !== doneB) return doneA ? 1 : -1;
        if (a.docsDueDate && b.docsDueDate) return a.docsDueDate.localeCompare(b.docsDueDate);
        if (a.docsDueDate) return -1;
        if (b.docsDueDate) return 1;
        return a.fullName.localeCompare(b.fullName, 'ru');
      });
  }, [activeClients, filter, search]);

  const handleToggleDoc = async (client: ClientRecord, key: DocumentKey) => {
    setSavingId(`${client.id}-${key}`);
    try {
      const current = client.documentsChecklist[key];
      const nextSubmitted = !current.submitted;
      const nextChecklist: DocumentsChecklist = {
        ...client.documentsChecklist,
        [key]: {
          submitted: nextSubmitted,
          submittedDate: nextSubmitted ? getTodayIso() : '',
        },
      };
      await onUpdateClientDocuments(client.id, client.docsDueDate, nextChecklist);
    } finally {
      setSavingId(null);
    }
  };

  const handleDueDateChange = async (client: ClientRecord, nextDate: string) => {
    setSavingId(`${client.id}-date`);
    try {
      await onUpdateClientDocuments(client.id, nextDate, client.documentsChecklist);
    } finally {
      setSavingId(null);
    }
  };

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
          <FileCheck2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Нет клиентов для подачи документов</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          После добавления клиентов вы сможете отмечать сдачу заявления, паспорта и справки о доходах, а также контролировать даты подачи.
        </p>
      </div>
    );
  }

  const readyCount = activeClients.filter(
    (c) => getSubmittedCount(c.documentsChecklist) === REQUIRED_DOCUMENT_DEFS.length
  ).length;

  return (
    <div className="space-y-4">
      {/* Checklist Reference Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Список обязательных документов к подаче
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Заявление · Паспорт · Справка о доходах — отмечайте готовность и срок подачи по каждому клиенту
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs shrink-0">
          <div>
            <span className="text-slate-500">Полный комплект:</span>{' '}
            <span className="font-mono tabular-nums font-semibold text-emerald-700">
              {readyCount} из {activeClients.length}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Ожидают подачи:</span>{' '}
            <span className="font-mono tabular-nums font-semibold text-amber-700">
              {activeClients.length - readyCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, телефону или региону..."
            className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              ['all', 'Все клиенты'],
              ['pending', 'Ожидают подачи'],
              ['urgent', 'Срок до 14 дн.'],
              ['complete', 'Все сданы'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Matrix Table */}
      {filteredClients.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-5">Клиент</th>
                <th className="py-3 px-4">Когда подавать</th>
                {REQUIRED_DOCUMENT_DEFS.map((docDef) => (
                  <th key={docDef.key} className="py-3 px-4">
                    {docDef.label}
                  </th>
                ))}
                <th className="py-3 px-5 text-right">Готовность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredClients.map((client) => {
                const doneCount = getSubmittedCount(client.documentsChecklist);
                const allDone = doneCount === REQUIRED_DOCUMENT_DEFS.length;
                const days = getDaysUntil(client.docsDueDate);

                return (
                  <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <button
                        type="button"
                        onClick={() => onOpenClient(client.id)}
                        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline text-left"
                      >
                        {client.fullName}
                      </button>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {pluralizeChildren(client.childrenCount)}
                        {client.phone ? ` · ${client.phone}` : ''}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <input
                        type="date"
                        value={client.docsDueDate}
                        disabled={savingId === `${client.id}-date`}
                        onChange={(e) => void handleDueDateChange(client, e.target.value)}
                        aria-label={`Дата подачи документов для ${client.fullName}`}
                        className="px-2.5 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                      />
                      <p
                        className={`text-xs mt-1 tabular-nums ${
                          allDone
                            ? 'text-emerald-700'
                            : days === null
                              ? 'text-slate-400'
                              : days < 0
                                ? 'text-red-700 font-medium'
                                : days <= 14
                                  ? 'text-amber-700 font-medium'
                                  : 'text-slate-500'
                        }`}
                      >
                        {allDone
                          ? 'Комплект сдан'
                          : days === null
                            ? 'Срок не назначен'
                            : days < 0
                              ? `Просрочено (${Math.abs(days)} дн.)`
                              : days === 0
                                ? 'Подать сегодня'
                                : `Через ${days} дн.`}
                      </p>
                    </td>

                    {REQUIRED_DOCUMENT_DEFS.map((docDef) => {
                      const state = client.documentsChecklist[docDef.key];
                      const isBusy = savingId === `${client.id}-${docDef.key}`;
                      return (
                        <td key={docDef.key} className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleDoc(client, docDef.key)}
                            className={`inline-flex items-center gap-2 text-xs font-medium py-1 px-2 rounded-md transition-colors ${
                              state.submitted
                                ? 'text-emerald-800 hover:bg-emerald-50'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                state.submitted
                                  ? 'bg-emerald-700 border-emerald-700 text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {state.submitted && <Check className="w-3 h-3" />}
                            </span>
                            <span>
                              {state.submitted
                                ? state.submittedDate
                                  ? `Сдано ${formatDateRu(state.submittedDate)}`
                                  : 'Сдано'
                                : 'Не сдано'}
                            </span>
                          </button>
                        </td>
                      );
                    })}

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <span
                        className={`text-xs font-mono tabular-nums font-semibold ${
                          allDone
                            ? 'text-emerald-700'
                            : doneCount > 0
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {doneCount} / {REQUIRED_DOCUMENT_DEFS.length}
                      </span>
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
        </div>
      )}
    </div>
  );
}
