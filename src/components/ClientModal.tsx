import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  createEmptyDocumentsChecklist,
  FIELD_LIMITS,
  REQUIRED_DOCUMENT_DEFS,
  type BenefitPercent,
  type ChildInfo,
  type ClientFormInput,
  type ClientRecord,
  type ClientStatus,
  type DocumentKey,
  type DocumentsChecklist,
  type PayoutPercent,
} from '../types/crm';
import { type InitialPayoutDraft } from '../lib/crmService';
import { getCurrentMonthIso, getTodayIso } from '../lib/formatters';

interface ClientModalProps {
  isOpen: boolean;
  editingClient: ClientRecord | null;
  onClose: () => void;
  onSave: (input: ClientFormInput, initialPayout?: InitialPayoutDraft) => Promise<void>;
}

export function ClientModal({ isOpen, editingClient, onClose, onSave }: ClientModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [snils, setSnils] = useState('');
  const [region, setRegion] = useState('');
  const [childrenCount, setChildrenCount] = useState(1);
  const [children, setChildren] = useState<ChildInfo[]>([{ name: '', birthDate: '' }]);
  const [benefitPercent, setBenefitPercent] = useState<BenefitPercent>(100);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [status, setStatus] = useState<ClientStatus>('active');
  const [firstBenefitDate, setFirstBenefitDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [notes, setNotes] = useState('');
  const [docsDueDate, setDocsDueDate] = useState('');
  const [documentsChecklist, setDocumentsChecklist] = useState<DocumentsChecklist>(
    createEmptyDocumentsChecklist()
  );

  // Optional initial payout on client creation
  const [addInitialPayout, setAddInitialPayout] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(getTodayIso());
  const [periodMonth, setPeriodMonth] = useState(getCurrentMonthIso());
  const [payoutComment, setPayoutComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingClient) {
      setFullName(editingClient.fullName);
      setPhone(editingClient.phone);
      setSnils(editingClient.snils);
      setRegion(editingClient.region);
      setChildrenCount(editingClient.childrenCount);
      setChildren(
        editingClient.children.length > 0
          ? editingClient.children.map((c) => ({ ...c }))
          : [{ name: '', birthDate: '' }]
      );
      setBenefitPercent(editingClient.benefitPercent);
      setMonthlyAmount(editingClient.monthlyAmount > 0 ? String(editingClient.monthlyAmount) : '');
      setStatus(editingClient.status);
      setFirstBenefitDate(editingClient.firstBenefitDate);
      setRenewalDate(editingClient.renewalDate);
      setNotes(editingClient.notes);
      setDocsDueDate(editingClient.docsDueDate);
      setDocumentsChecklist({
        application: { ...editingClient.documentsChecklist.application },
        passport: { ...editingClient.documentsChecklist.passport },
        incomeCertificate: { ...editingClient.documentsChecklist.incomeCertificate },
      });
      setAddInitialPayout(false);
    } else {
      setFullName('');
      setPhone('');
      setSnils('');
      setRegion('');
      setChildrenCount(1);
      setChildren([{ name: '', birthDate: '' }]);
      setBenefitPercent(100);
      setMonthlyAmount('');
      setStatus('active');
      setFirstBenefitDate('');
      setRenewalDate('');
      setNotes('');
      setDocsDueDate('');
      setDocumentsChecklist(createEmptyDocumentsChecklist());
      setAddInitialPayout(true);
      setPayoutAmount('');
      setPayoutDate(getTodayIso());
      setPeriodMonth(getCurrentMonthIso());
      setPayoutComment('');
    }
  }, [isOpen, editingClient]);

  if (!isOpen) return null;

  const handleAddChildRow = () => {
    if (children.length >= FIELD_LIMITS.CHILDREN_LIST_MAX) return;
    const next = [...children, { name: '', birthDate: '' }];
    setChildren(next);
    if (next.length > childrenCount) {
      setChildrenCount(next.length);
    }
  };

  const handleRemoveChildRow = (idx: number) => {
    const next = children.filter((_, i) => i !== idx);
    setChildren(next);
  };

  const handleChildChange = (idx: number, field: keyof ChildInfo, value: string) => {
    setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (trimmedName.length < FIELD_LIMITS.FULL_NAME_MIN) {
      setError('Укажите ФИО клиента (минимум 2 символа).');
      return;
    }

    const parsedMonthly = monthlyAmount ? Number(monthlyAmount.replace(/\s+/g, '').replace(',', '.')) : 0;
    if (Number.isNaN(parsedMonthly) || parsedMonthly < 0 || parsedMonthly > FIELD_LIMITS.MONTHLY_AMOUNT_MAX) {
      setError('Некорректная ежемесячная сумма пособия.');
      return;
    }

    const parsedPayoutAmount = payoutAmount
      ? Number(payoutAmount.replace(/\s+/g, '').replace(',', '.'))
      : 0;

    if (!editingClient && addInitialPayout && parsedPayoutAmount > 0) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payoutDate)) {
        setError('Укажите дату полученной выплаты.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const formInput: ClientFormInput = {
        fullName: trimmedName,
        phone: phone.trim(),
        snils: snils.trim(),
        region: region.trim(),
        childrenCount: Math.max(0, Math.min(FIELD_LIMITS.CHILDREN_MAX, Math.round(childrenCount))),
        children: children
          .map((c) => ({ name: c.name.trim(), birthDate: c.birthDate.trim() }))
          .filter((c) => c.name.length > 0 || c.birthDate.length > 0),
        benefitPercent,
        monthlyAmount: parsedMonthly,
        status,
        firstBenefitDate: firstBenefitDate.trim(),
        renewalDate: renewalDate.trim(),
        notes: notes.trim(),
        docsDueDate: docsDueDate.trim(),
        documentsChecklist,
      };

      const initialPayout: InitialPayoutDraft | undefined =
        !editingClient && addInitialPayout && parsedPayoutAmount > 0
          ? {
              enabled: true,
              amount: parsedPayoutAmount,
              payoutDate,
              periodMonth: periodMonth || payoutDate.slice(0, 7),
              benefitPercent: (benefitPercent === 0 ? 50 : benefitPercent) as PayoutPercent,
              childrenCovered: Math.max(0, Math.round(childrenCount)),
              comment: payoutComment.trim(),
            }
          : undefined;

      await onSave(formInput, initialPayout);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить клиента.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="client-modal-title" className="text-lg font-semibold text-slate-900">
            {editingClient ? 'Редактировать клиента' : 'Новый клиент по единому пособию'}
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

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Основные данные</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  ФИО клиента <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.FULL_NAME_MAX}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Например: Иванова Анна Сергеевна"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Телефон</label>
                <input
                  type="tel"
                  maxLength={FIELD_LIMITS.PHONE_MAX}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">СНИЛС</label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.SNILS_MAX}
                  value={snils}
                  onChange={(e) => setSnils(e.target.value)}
                  placeholder="000-000-000 00"
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Регион / Город</label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.REGION_MAX}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Например: Краснодарский край"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Дети в семье</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Укажите количество детей и при необходимости их имена и даты рождения
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-700">Всего детей:</label>
                <input
                  type="number"
                  min={0}
                  max={FIELD_LIMITS.CHILDREN_MAX}
                  value={childrenCount}
                  onChange={(e) =>
                    setChildrenCount(
                      Math.max(0, Math.min(FIELD_LIMITS.CHILDREN_MAX, Number(e.target.value) || 0))
                    )
                  }
                  className="w-20 px-3 py-1.5 text-sm font-mono tabular-nums text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {children.map((child, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.CHILD_NAME_MAX}
                      value={child.name}
                      onChange={(e) => handleChildChange(idx, 'name', e.target.value)}
                      placeholder={`Имя ребёнка №${idx + 1}`}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="date"
                      value={child.birthDate}
                      onChange={(e) => handleChildChange(idx, 'birthDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveChildRow(idx)}
                      aria-label="Удалить ребёнка из списка"
                      className="p-2 text-slate-400 hover:text-red-700 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {children.length < FIELD_LIMITS.CHILDREN_LIST_MAX && (
                <button
                  type="button"
                  onClick={handleAddChildRow}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 py-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Добавить ребёнка в список
                </button>
              )}
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Условия единого пособия</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Статус дела</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClientStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                >
                  <option value="active">Назначено</option>
                  <option value="pending">На рассмотрении</option>
                  <option value="renewal">Требует продления</option>
                  <option value="denied">Отказ</option>
                  {editingClient && <option value="archived">В архиве (без правок)</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Размер (% от ПМ)</label>
                <select
                  value={benefitPercent}
                  onChange={(e) => setBenefitPercent(Number(e.target.value) as BenefitPercent)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                >
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                  <option value={0}>0% (не назначено)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Ежемесячно (₽)
                </label>
                <input
                  type="number"
                  min={0}
                  max={FIELD_LIMITS.MONTHLY_AMOUNT_MAX}
                  step="1"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="15400"
                  className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Дата назначения / 1-й выплаты
                </label>
                <input
                  type="date"
                  value={firstBenefitDate}
                  onChange={(e) => setFirstBenefitDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Дата продления (окончание срока)
                </label>
                <input
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Заметки по клиенту</label>
              <textarea
                rows={2}
                maxLength={FIELD_LIMITS.NOTES_MAX}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Реквизиты, особенности расчёта доходов, недостающие справки..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 resize-none"
              />
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Список подачи документов</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Отметьте сданные документы и укажите, когда нужно подать пакет
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">
                  Когда подавать:
                </label>
                <input
                  type="date"
                  value={docsDueDate}
                  onChange={(e) => setDocsDueDate(e.target.value)}
                  className="px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
              {REQUIRED_DOCUMENT_DEFS.map((docDef) => {
                const state = documentsChecklist[docDef.key];
                const toggleDoc = (key: DocumentKey) => {
                  setDocumentsChecklist((prev) => {
                    const nextSubmitted = !prev[key].submitted;
                    return {
                      ...prev,
                      [key]: {
                        submitted: nextSubmitted,
                        submittedDate: nextSubmitted ? prev[key].submittedDate || getTodayIso() : '',
                      },
                    };
                  });
                };

                return (
                  <div
                    key={docDef.key}
                    className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={state.submitted}
                        onChange={() => toggleDoc(docDef.key)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-900">{docDef.label}</span>
                        <span className="block text-xs text-slate-500">{docDef.hint}</span>
                      </div>
                    </label>
                    {state.submitted && (
                      <input
                        type="date"
                        value={state.submittedDate}
                        onChange={(e) =>
                          setDocumentsChecklist((prev) => ({
                            ...prev,
                            [docDef.key]: { ...prev[docDef.key], submittedDate: e.target.value },
                          }))
                        }
                        aria-label={`Дата сдачи: ${docDef.label}`}
                        className="px-2.5 py-1 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {!editingClient && (
            <section className="border-t border-slate-200 pt-5 space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addInitialPayout}
                  onChange={(e) => setAddInitialPayout(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                <span className="text-sm font-semibold text-slate-900">
                  Сразу записать полученную выплату (сколько и когда получил клиент)
                </span>
              </label>

              {addInitialPayout && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Сумма получено (₽)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={FIELD_LIMITS.PAYOUT_AMOUNT_MAX}
                      step="1"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      placeholder={monthlyAmount || '15400'}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Дата получения
                    </label>
                    <input
                      type="date"
                      value={payoutDate}
                      onChange={(e) => setPayoutDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      За какой месяц
                    </label>
                    <input
                      type="month"
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.COMMENT_MAX}
                      value={payoutComment}
                      onChange={(e) => setPayoutComment(e.target.value)}
                      placeholder="Комментарий к выплате (необязательно)"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    />
                  </div>
                </div>
              )}
            </section>
          )}

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
              {submitting ? 'Сохранение...' : editingClient ? 'Сохранить изменения' : 'Добавить клиента'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
