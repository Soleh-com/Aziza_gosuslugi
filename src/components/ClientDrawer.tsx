import { useEffect, useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  CLIENT_STATUS_DOTS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_TONES,
  FIELD_LIMITS,
  REQUIRED_DOCUMENT_DEFS,
  type ClientRecord,
  type ClientStatus,
  type DocumentKey,
  type DocumentsChecklist,
  type PayoutFormInput,
  type PayoutPercent,
  type PayoutRecord,
} from '../types/crm';
import {
  calculateChildAge,
  formatDateRu,
  formatMonthRu,
  formatRubles,
  getCurrentMonthIso,
  getDaysUntil,
  getTodayIso,
  pluralizeChildren,
  pluralizePayouts,
} from '../lib/formatters';

interface ClientDrawerProps {
  client: ClientRecord | null;
  payouts: PayoutRecord[];
  onClose: () => void;
  onEditClient: (client: ClientRecord) => void;
  onChangeStatus: (clientId: string, status: ClientStatus) => Promise<void>;
  onUpdateClientDocuments: (
    clientId: string,
    docsDueDate: string,
    checklist: DocumentsChecklist
  ) => Promise<void>;
  onDeleteClient: (client: ClientRecord, clientPayouts: PayoutRecord[]) => Promise<void>;
  onCreatePayout: (input: PayoutFormInput) => Promise<void>;
  onUpdatePayout: (payoutId: string, input: Omit<PayoutFormInput, 'clientId'>) => Promise<void>;
  onDeletePayout: (payoutId: string) => Promise<void>;
}

export function ClientDrawer({
  client,
  payouts,
  onClose,
  onEditClient,
  onChangeStatus,
  onUpdateClientDocuments,
  onDeleteClient,
  onCreatePayout,
  onUpdatePayout,
  onDeletePayout,
}: ClientDrawerProps) {
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);

  const [showAddPayout, setShowAddPayout] = useState(false);
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(getTodayIso());
  const [periodMonth, setPeriodMonth] = useState(getCurrentMonthIso());
  const [benefitPercent, setBenefitPercent] = useState<PayoutPercent>(100);
  const [childrenCovered, setChildrenCovered] = useState(1);
  const [comment, setComment] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [confirmDeletePayoutId, setConfirmDeletePayoutId] = useState<string | null>(null);

  useEffect(() => {
    setConfirmDeleteClient(false);
    setShowAddPayout(false);
    setEditingPayoutId(null);
    setConfirmDeletePayoutId(null);
    setPayoutError(null);
    if (client) {
      setAmount(client.monthlyAmount > 0 ? String(client.monthlyAmount) : '');
      setBenefitPercent(
        client.benefitPercent === 50 || client.benefitPercent === 75 || client.benefitPercent === 100
          ? client.benefitPercent
          : 100
      );
      setChildrenCovered(client.childrenCount);
      setPayoutDate(getTodayIso());
      setPeriodMonth(getCurrentMonthIso());
      setComment('');
    }
  }, [client?.id]);

  if (!client) return null;

  const totalReceived = payouts.reduce((sum, p) => sum + p.amount, 0);
  const renewalDays = getDaysUntil(client.renewalDate);
  const isArchived = client.status === 'archived';

  const startEditPayout = (payout: PayoutRecord) => {
    setShowAddPayout(true);
    setEditingPayoutId(payout.id);
    setAmount(String(payout.amount));
    setPayoutDate(payout.payoutDate);
    setPeriodMonth(payout.periodMonth);
    setBenefitPercent(payout.benefitPercent);
    setChildrenCovered(payout.childrenCovered);
    setComment(payout.comment);
    setPayoutError(null);
  };

  const startNewPayout = () => {
    setEditingPayoutId(null);
    setAmount(client.monthlyAmount > 0 ? String(client.monthlyAmount) : '');
    setPayoutDate(getTodayIso());
    setPeriodMonth(getCurrentMonthIso());
    setBenefitPercent(
      client.benefitPercent === 50 || client.benefitPercent === 75 || client.benefitPercent === 100
        ? client.benefitPercent
        : 100
    );
    setChildrenCovered(client.childrenCount);
    setComment('');
    setPayoutError(null);
    setShowAddPayout(true);
  };

  const handlePayoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount.replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > FIELD_LIMITS.PAYOUT_AMOUNT_MAX) {
      setPayoutError('Укажите корректную сумму выплаты больше 0 ₽.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payoutDate)) {
      setPayoutError('Укажите дату выплаты.');
      return;
    }

    setSavingPayout(true);
    setPayoutError(null);
    try {
      if (editingPayoutId) {
        await onUpdatePayout(editingPayoutId, {
          clientName: client.fullName,
          amount: parsedAmount,
          payoutDate,
          periodMonth: periodMonth || payoutDate.slice(0, 7),
          benefitPercent,
          childrenCovered,
          comment: comment.trim(),
        });
      } else {
        await onCreatePayout({
          clientId: client.id,
          clientName: client.fullName,
          amount: parsedAmount,
          payoutDate,
          periodMonth: periodMonth || payoutDate.slice(0, 7),
          benefitPercent,
          childrenCovered,
          comment: comment.trim(),
        });
      }
      setShowAddPayout(false);
      setEditingPayoutId(null);
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Ошибка сохранения выплаты.');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleConfirmDeleteClient = async () => {
    setDeletingClient(true);
    try {
      await onDeleteClient(client, payouts);
      onClose();
    } finally {
      setDeletingClient(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/35 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-client-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${CLIENT_STATUS_DOTS[client.status]}`} />
              <span className={`font-medium ${CLIENT_STATUS_TONES[client.status]}`}>
                {CLIENT_STATUS_LABELS[client.status]}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {client.benefitPercent > 0 ? `${client.benefitPercent}% ПМ` : 'Не назначено'}
              </span>
              {client.region && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{client.region}</span>
                </>
              )}
            </div>
            <h2 id="drawer-client-title" className="text-xl font-bold text-slate-900 truncate">
              {client.fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1.5 font-mono tabular-nums">
              <span>{client.phone || 'Телефон не указан'}</span>
              {client.snils && (
                <>
                  <span aria-hidden="true" className="text-slate-300">/</span>
                  <span>СНИЛС {client.snils}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isArchived && (
              <button
                type="button"
                onClick={() => onEditClient(client)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                Изменить
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDeleteClient((v) => !v)}
              aria-label="Удалить клиента"
              className="p-2 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть карточку"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Confirm Client Deletion Inline Banner */}
        {confirmDeleteClient && (
          <div className="px-6 py-3.5 bg-red-50 border-b border-red-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-red-800">
              Удалить карточку клиента и все связанные выплаты ({pluralizePayouts(payouts.length)})?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteClient(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deletingClient}
                onClick={handleConfirmDeleteClient}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-60"
              >
                {deletingClient ? 'Удаление...' : 'Подтвердить удаление'}
              </button>
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
          {/* Summary Strip */}
          <div className="grid grid-cols-3 border border-slate-200 rounded-lg divide-x divide-slate-200 bg-slate-50/50">
            <div className="p-4">
              <p className="text-xs text-slate-500">Всего получено</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                {formatRubles(totalReceived)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{pluralizePayouts(payouts.length)}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500">Ежемесячная ставка</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                {client.monthlyAmount > 0 ? formatRubles(client.monthlyAmount) : '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {client.benefitPercent > 0 ? `${client.benefitPercent}% от ПМ` : 'Не задана'}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500">Продление срока</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                {formatDateRu(client.renewalDate)}
              </p>
              <p
                className={`text-xs mt-0.5 tabular-nums ${
                  renewalDays !== null && renewalDays < 0
                    ? 'text-red-700 font-medium'
                    : renewalDays !== null && renewalDays <= 30
                      ? 'text-amber-700 font-medium'
                      : 'text-slate-500'
                }`}
              >
                {renewalDays === null
                  ? 'Срок не указан'
                  : renewalDays < 0
                    ? `Просрочено на ${Math.abs(renewalDays)} дн.`
                    : renewalDays === 0
                      ? 'Сегодня'
                      : `Через ${renewalDays} дн.`}
              </p>
            </div>
          </div>

          {/* Quick Status Control */}
          {!isArchived && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
              <span className="text-xs font-medium text-slate-600">Статус дела</span>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['active', 'pending', 'renewal', 'denied'] as ClientStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onChangeStatus(client.id, st)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      client.status === st
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {CLIENT_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Children Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Дети в семье — {pluralizeChildren(client.childrenCount)}
              </h3>
              {client.firstBenefitDate && (
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Назначено с {formatDateRu(client.firstBenefitDate)}
                </span>
              )}
            </div>

            {client.children.length > 0 ? (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {client.children.map((child, idx) => {
                  const age = calculateChildAge(child.birthDate);
                  return (
                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-slate-900 truncate">
                        {child.name || `Ребёнок №${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums shrink-0">
                        <span>{child.birthDate ? formatDateRu(child.birthDate) : 'Дата не указана'}</span>
                        {age && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700 font-sans font-medium">{age}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Поимённый список детей не заполнен (указано количество: {client.childrenCount}).
              </p>
            )}

            {client.notes && (
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Примечание</p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </section>

          {/* Documents Submission Checklist Section */}
          <section className="border-t border-slate-200 pt-6 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Список подачи документов</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Отмечайте, какие документы уже сданы и к какому числу их нужно подать
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Когда подавать:</span>
                <input
                  type="date"
                  disabled={isArchived}
                  value={client.docsDueDate}
                  onChange={(e) =>
                    void onUpdateClientDocuments(
                      client.id,
                      e.target.value,
                      client.documentsChecklist
                    )
                  }
                  aria-label="Срок подачи документов"
                  className="px-2.5 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {REQUIRED_DOCUMENT_DEFS.map((docDef) => {
                const state = client.documentsChecklist[docDef.key];
                const handleToggle = () => {
                  if (isArchived) return;
                  const nextSubmitted = !state.submitted;
                  const nextChecklist: DocumentsChecklist = {
                    ...client.documentsChecklist,
                    [docDef.key]: {
                      submitted: nextSubmitted,
                      submittedDate: nextSubmitted ? getTodayIso() : '',
                    },
                  };
                  void onUpdateClientDocuments(client.id, client.docsDueDate, nextChecklist);
                };

                return (
                  <div
                    key={docDef.key}
                    className="px-4 py-2.5 flex items-center justify-between gap-4"
                  >
                    <button
                      type="button"
                      disabled={isArchived}
                      onClick={handleToggle}
                      className="flex items-center gap-3 text-left disabled:opacity-60"
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
                      <div>
                        <span className="text-sm font-medium text-slate-900 block">
                          {docDef.label}
                        </span>
                        <span className="text-xs text-slate-500">{docDef.hint}</span>
                      </div>
                    </button>

                    <span
                      className={`text-xs font-mono tabular-nums shrink-0 ${
                        state.submitted ? 'text-emerald-700 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {state.submitted
                        ? state.submittedDate
                          ? `Сдано ${formatDateRu(state.submittedDate)}`
                          : 'Сдано'
                        : 'Ожидается'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Payouts History Section */}
          <section className="border-t border-slate-200 pt-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">История выплат единого пособия</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Фиксируйте каждую полученную сумму и дату перечисления
                </p>
              </div>
              {!showAddPayout && (
                <button
                  type="button"
                  onClick={startNewPayout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Записать выплату
                </button>
              )}
            </div>

            {showAddPayout && (
              <form
                onSubmit={handlePayoutSubmit}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-900">
                    {editingPayoutId ? 'Редактирование выплаты' : 'Новая выплата'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPayout(false);
                      setEditingPayoutId(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Закрыть
                  </button>
                </div>

                {payoutError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {payoutError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Сумма (₽) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={FIELD_LIMITS.PAYOUT_AMOUNT_MAX}
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="15400"
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Дата получения *</label>
                    <input
                      type="date"
                      required
                      value={payoutDate}
                      onChange={(e) => setPayoutDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">За месяц *</label>
                    <input
                      type="month"
                      required
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">% от ПМ</label>
                    <select
                      value={benefitPercent}
                      onChange={(e) => setBenefitPercent(Number(e.target.value) as PayoutPercent)}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                    >
                      <option value={50}>50%</option>
                      <option value={75}>75%</option>
                      <option value={100}>100%</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Детей в выплате</label>
                    <input
                      type="number"
                      min={0}
                      max={FIELD_LIMITS.CHILDREN_MAX}
                      value={childrenCovered}
                      onChange={(e) => setChildrenCovered(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Комментарий</label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.COMMENT_MAX}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="СФР / задержка / доплата"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPayout(false);
                      setEditingPayoutId(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayout}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-60"
                  >
                    {savingPayout ? 'Сохранение...' : editingPayoutId ? 'Обновить' : 'Сохранить выплату'}
                  </button>
                </div>
              </form>
            )}

            {payouts.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-3.5">Дата</th>
                      <th className="py-2.5 px-3.5">Период</th>
                      <th className="py-2.5 px-3.5">Условия</th>
                      <th className="py-2.5 px-3.5 text-right">Сумма</th>
                      <th className="py-2.5 px-3.5 text-right w-20">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                          {formatDateRu(payout.payoutDate)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-slate-900">
                          <div>{formatMonthRu(payout.periodMonth)}</div>
                          {payout.comment && (
                            <div className="text-slate-500 truncate max-w-[160px]">{payout.comment}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {payout.benefitPercent}% ПМ · {payout.childrenCovered} дет.
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatRubles(payout.amount)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {confirmDeletePayoutId === payout.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onDeletePayout(payout.id).then(() => setConfirmDeletePayoutId(null))}
                                className="text-xs font-medium text-red-700 hover:underline"
                              >
                                Да
                              </button>
                              <span className="text-slate-300">/</span>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePayoutId(null)}
                                className="text-xs text-slate-500 hover:underline"
                              >
                                Нет
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditPayout(payout)}
                                aria-label="Редактировать выплату"
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePayoutId(payout.id)}
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
              <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center">
                <p className="text-sm text-slate-600">По этому клиенту ещё не записано ни одной выплаты.</p>
                {!showAddPayout && (
                  <button
                    type="button"
                    onClick={startNewPayout}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить первую выплату
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
