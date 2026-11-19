import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowRight, CalendarClock, ShieldCheck, Users, Wallet } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось выполнить вход.';
      if (message.includes('popup-closed-by-user')) {
        setError('Окно входа было закрыто. Нажмите кнопку ещё раз для авторизации.');
      } else {
        setError('Ошибка входа через Google. Пожалуйста, попробуйте снова.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            ЕдиноеПособие
          </span>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? 'Вход...' : 'Войти в CRM'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-xs font-medium text-blue-700 mb-3">Рабочее пространство специалиста</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight text-balance mb-4">
              Единая CRM-система для учёта клиентов по единому пособию
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
              Храните карточки всех семей в одном месте: состав детей и их возраст, назначенный размер
              пособия (50%, 75%, 100%), историю каждой выплаты с точными датами и контроль сроков
              продления.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{loading ? 'Подключение...' : 'Войти через Google'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </p>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-start gap-3.5">
                <Users className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">База клиентов и дети</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    ФИО, контакты, СНИЛС, количество детей и дата рождения каждого ребёнка.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 flex items-start gap-3.5">
                <Wallet className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Журнал выплат по датам</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Фиксация каждой полученной суммы, расчётного месяца и процента от прожиточного минимума.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 flex items-start gap-3.5">
                <CalendarClock className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Контроль продлений</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Отдельная очередь семей, у которых заканчивается 12-месячный срок назначения.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 mt-6 pt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Персональная база изолирована и защищена вашим аккаунтом Google</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
