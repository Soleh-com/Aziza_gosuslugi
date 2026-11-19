import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  FIELD_LIMITS,
  type ClientRecord,
  type PayoutFormInput,
  type PayoutPercent,
  type PayoutRecord,
} from '../types/crm';
import { getCurrentMonthIso, getTodayIso } from '../lib/formatters';

interface PayoutModalProps {
  isOpen: boolean;
  clients: ClientRecord[];
  editingPayout: PayoutRecord | null;
  defaultClientId?: string;
  onClose: () => void;
  onSave: (input: PayoutFormInput, payoutId?: string) => Promise<void>;
}

export function PayoutModal({
  isOpen,
  clients,
  editingPayout,
  defaultClientId,
  onClose,
  onSave,
}: PayoutModalProps) {
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(getTodayIso());
  const [periodMonth, setPeriodMonth] = useState(getCurrentMonthIso());
  const [benefitPercent, setBenefitPercent] = useState<PayoutPercent>(100);
  const [childrenCovered, setChildrenCovered] = useState(1);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingPayout) {
      setClientId(editingPayout.clientId);
      setAmount(String(editingPayout.amount));
      setPayoutDate(editingPayout.payoutDate);
      setPeriodMonth(editingPayout.periodMonth);
      setBenefitPercent(editingPayout.benefitPercent);
      setChildrenCovered(editingPayout.childrenCovered);
      setComment(editingPayout.comment);
    } else {
      const targetId = defaultClientId || clients[0]?.id || '';
      const matched = clients.find((c) => c.id === targetId);
      setClientId(targetId);
      setAmount(matched && matched.monthlyAmount > 0 ? String(matched.monthlyAmount) : '');
      setPayoutDate(getTodayIso());
      setPeriodMonth(getCurrentMonthIso());
      setBenefitPercent(
        matched && (matched.benefitPercent === 50 || matched.benefitPercent === 75 || matched.benefitPercent === 100)
          ? matched.benefitPercent
          : 100
      );
      setChildrenCovered(matched ? matched.childrenCount : 1);
      setComment('');
    }
  }, [isOpen, editingPayout, defaultClientId, clients]);

  if (!isOpen) return null;

  const handleClientSelect = (nextId: string) => {
    setClientId(nextId);
    const matched = clients.find((c) => c.id === nextId);
    if (matched) {
      if (matched.monthlyAmount > 0) setAmount(String(matched.monthlyAmount));
      if (matched.benefitPercent === 50 || matched.benefitPercent === 75 || matched.benefitPercent === 100) {
        setBenefitPercent(matched.benefitPercent);
      }
      setChildrenCovered(matched.childrenCount);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const matchedClient = clients.find((c) => c.id === clientId);
    if (!matchedClient && !editingPayout) {
      setError('Выберите клиента из списка.');
      return;
    }

    const parsedAmount = Number(amount.replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > FIELD_LIMITS.PAYOUT_AMOUNT_MAX) {
      setError('Укажите корректную сумму выплаты больше 0 ₽.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payoutDate)) {
      setError('Укажите дату выплаты.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      setError('Укажите расчётный месяц.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave(
        {
          clientId: editingPayout ? editingPayout.clientId : clientId,
          clientName: matchedClient?.fullName ?? editingPayout?.clientName ?? 'Клиент',
          amount: parsedAmount,
          payoutDate,
          periodMonth,
          benefitPercent,
          childrenCovered: Math.max(0, Math.min(FIELD_LIMITS.CHILDREN_MAX, Math.round(childrenCovered))),
          comment: comment.trim(),
        },
        editingPayout?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить выплату.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="payout-modal-title" className="text-lg font-semibold text-slate-900">
            {editingPayout ? 'Редактировать выплату' : 'Записать выплату пособия'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Клиент <span className="text-red-600">*</span>
            </label>
            <select
              value={clientId}
              disabled={Boolean(editingPayout)}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.childrenCount} дет.)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Сумма выплаты (₽) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                max={FIELD_LIMITS.PAYOUT_AMOUNT_MAX}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="15400"
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Дата получения <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                За какой месяц <span className="text-red-600">*</span>
              </label>
              <input
                type="month"
                required
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Размер (% от ПМ)</label>
              <select
                value={benefitPercent}
                onChange={(e) => setBenefitPercent(Number(e.target.value) as PayoutPercent)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              >
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Детей в выплате</label>
              <input
                type="number"
                min={0}
                max={FIELD_LIMITS.CHILDREN_MAX}
                value={childrenCovered}
                onChange={(e) => setChildrenCovered(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Комментарий</label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.COMMENT_MAX}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: на карту Мир, СФР"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {submitting ? 'Сохранение...' : editingPayout ? 'Сохранить' : 'Записать выплату'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
