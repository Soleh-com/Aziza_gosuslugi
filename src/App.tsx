import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  CalendarClock,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ClientDrawer } from './components/ClientDrawer';
import { ClientModal } from './components/ClientModal';
import { ClientsView } from './components/ClientsView';
import { DocumentsView } from './components/DocumentsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OverviewView } from './components/OverviewView';
import { PayoutModal } from './components/PayoutModal';
import { PayoutsView } from './components/PayoutsView';
import { RenewalsView } from './components/RenewalsView';
import {
  createClientWithOptionalPayout,
  createPayout,
  deleteClientWithPayouts,
  deletePayout,
  subscribeToClients,
  subscribeToPayouts,
  updateClient,
  updateClientDocuments,
  updateClientStatus,
  updatePayout,
  type InitialPayoutDraft,
} from './lib/crmService';
import { auth } from './lib/firebase';
import { getDaysUntil } from './lib/formatters';
import {
  REQUIRED_DOCUMENT_DEFS,
  type ClientFormInput,
  type ClientRecord,
  type ClientStatus,
  type DocumentsChecklist,
  type PayoutFormInput,
  type PayoutRecord,
} from './types/crm';

type NavTab = 'overview' | 'clients' | 'payouts' | 'documents' | 'renewals';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'clients', label: 'Клиенты', icon: Users },
  { id: 'payouts', label: 'Выплаты', icon: Wallet },
  { id: 'documents', label: 'Документы', icon: FileCheck2 },
  { id: 'renewals', label: 'Продления', icon: CalendarClock },
];

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Обзор',
  clients: 'Клиенты',
  payouts: 'Журнал выплат',
  documents: 'Подача документов',
  renewals: 'Продления сроков',
};

function CrmWorkspace({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<NavTab>('clients');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [syncError, setSyncError] = useState<Error | null>(null);

  // Modals & Drawer state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);

  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [editingPayout, setEditingPayout] = useState<PayoutRecord | null>(null);
  const [payoutDefaultClientId, setPayoutDefaultClientId] = useState<string | undefined>(undefined);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (syncError) {
    throw syncError;
  }

  useEffect(() => {
    setLoadingClients(true);
    setLoadingPayouts(true);

    const unsubClients = subscribeToClients(
      user.uid,
      (records) => {
        setClients(records);
        setLoadingClients(false);
      },
      (err) => {
        setLoadingClients(false);
        setSyncError(err);
      }
    );

    const unsubPayouts = subscribeToPayouts(
      user.uid,
      (records) => {
        setPayouts(records);
        setLoadingPayouts(false);
      },
      (err) => {
        setLoadingPayouts(false);
        setSyncError(err);
      }
    );

    return () => {
      unsubClients();
      unsubPayouts();
    };
  }, [user.uid]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const selectedClientPayouts = useMemo(
    () => (selectedClientId ? payouts.filter((p) => p.clientId === selectedClientId) : []),
    [payouts, selectedClientId]
  );

  const urgentRenewalsCount = useMemo(
    () =>
      clients.filter((c) => {
        if (c.status === 'archived' || !c.renewalDate) return false;
        const d = getDaysUntil(c.renewalDate);
        return d !== null && d <= 30;
      }).length,
    [clients]
  );

  const activeClientsCount = useMemo(
    () => clients.filter((c) => c.status !== 'archived').length,
    [clients]
  );

  const pendingDocsCount = useMemo(
    () =>
      clients.filter((c) => {
        if (c.status === 'archived') return false;
        const done = REQUIRED_DOCUMENT_DEFS.filter(
          (d) => c.documentsChecklist[d.key].submitted
        ).length;
        return done < REQUIRED_DOCUMENT_DEFS.length;
      }).length,
    [clients]
  );

  const handleOpenAddClient = () => {
    setEditingClient(null);
    setClientModalOpen(true);
  };

  const handleOpenEditClient = (client: ClientRecord) => {
    setEditingClient(client);
    setClientModalOpen(true);
  };

  const handleSaveClient = async (input: ClientFormInput, initialPayout?: InitialPayoutDraft) => {
    if (editingClient) {
      const clientPayouts = payouts.filter((p) => p.clientId === editingClient.id);
      await updateClient(editingClient.id, input, clientPayouts);
      setToastMessage('Данные клиента обновлены');
    } else {
      const newId = await createClientWithOptionalPayout(user.uid, input, initialPayout);
      setSelectedClientId(newId);
      setToastMessage('Клиент добавлен в базу');
    }
  };

  const handleChangeClientStatus = async (clientId: string, status: ClientStatus) => {
    await updateClientStatus(clientId, status);
    setToastMessage('Статус обновлён');
  };

  const handleUpdateClientDocuments = async (
    clientId: string,
    docsDueDate: string,
    checklist: DocumentsChecklist
  ) => {
    await updateClientDocuments(clientId, docsDueDate, checklist);
    setToastMessage('Список документов обновлён');
  };

  const handleDeleteClient = async (client: ClientRecord, clientPayouts: PayoutRecord[]) => {
    await deleteClientWithPayouts(client.id, clientPayouts);
    setToastMessage(`Клиент «${client.fullName}» удалён`);
  };

  const handleOpenQuickPayout = (clientId?: string) => {
    setEditingPayout(null);
    setPayoutDefaultClientId(clientId);
    setPayoutModalOpen(true);
  };

  const handleSavePayout = async (input: PayoutFormInput, payoutId?: string) => {
    if (payoutId) {
      await updatePayout(payoutId, {
        clientName: input.clientName,
        amount: input.amount,
        payoutDate: input.payoutDate,
        periodMonth: input.periodMonth,
        benefitPercent: input.benefitPercent,
        childrenCovered: input.childrenCovered,
        comment: input.comment,
      });
      setToastMessage('Запись о выплате обновлена');
    } else {
      await createPayout(user.uid, input);
      setToastMessage('Выплата записана');
    }
  };

  const handleDrawerCreatePayout = async (input: PayoutFormInput) => {
    await createPayout(user.uid, input);
    setToastMessage('Выплата записана');
  };

  const handleDrawerUpdatePayout = async (
    payoutId: string,
    input: Omit<PayoutFormInput, 'clientId'>
  ) => {
    await updatePayout(payoutId, input);
    setToastMessage('Запись о выплате обновлена');
  };

  const handleDeletePayout = async (payoutId: string) => {
    await deletePayout(payoutId);
    setToastMessage('Выплата удалена');
  };

  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const dataLoading = loadingClients || loadingPayouts;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 shrink-0">
        <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          ЕдиноеПособие
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Закрыть меню"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Разделы CRM">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          let countLabel: string | null = null;
          if (item.id === 'clients' && activeClientsCount > 0) countLabel = String(activeClientsCount);
          if (item.id === 'payouts' && payouts.length > 0) countLabel = String(payouts.length);
          if (item.id === 'documents' && pendingDocsCount > 0) countLabel = String(pendingDocsCount);
          if (item.id === 'renewals' && urgentRenewalsCount > 0) {
            countLabel = String(urgentRenewalsCount);
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {countLabel && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    item.id === 'renewals' && urgentRenewalsCount > 0
                      ? 'text-amber-700 font-semibold'
                      : isActive
                        ? 'text-blue-700'
                        : 'text-slate-400'
                  }`}
                >
                  {countLabel}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Специалист'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center shrink-0">
              {(user.displayName || user.email || 'С').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {user.displayName || 'Специалист'}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">{sidebarContent}</aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Открыть меню"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav className="flex items-center gap-2 text-sm min-w-0" aria-label="Навигация">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">CRM</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{TAB_TITLES[activeTab]}</h1>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddClient}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить клиента</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewView
              clients={clients}
              payouts={payouts}
              loading={dataLoading}
              onOpenClient={(id) => setSelectedClientId(id)}
              onAddClient={handleOpenAddClient}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsView
              clients={clients}
              payouts={payouts}
              loading={dataLoading}
              onOpenClient={(id) => setSelectedClientId(id)}
              onAddClient={handleOpenAddClient}
              onQuickAddPayout={(clientId) => handleOpenQuickPayout(clientId)}
            />
          )}

          {activeTab === 'payouts' && (
            <PayoutsView
              clients={clients}
              payouts={payouts}
              loading={dataLoading}
              onOpenClient={(id) => setSelectedClientId(id)}
              onAddPayout={() => handleOpenQuickPayout(undefined)}
              onEditPayout={(payout) => {
                setEditingPayout(payout);
                setPayoutDefaultClientId(payout.clientId);
                setPayoutModalOpen(true);
              }}
              onDeletePayout={handleDeletePayout}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView
              clients={clients}
              loading={dataLoading}
              onOpenClient={(id) => setSelectedClientId(id)}
              onUpdateClientDocuments={handleUpdateClientDocuments}
            />
          )}

          {activeTab === 'renewals' && (
            <RenewalsView
              clients={clients}
              payouts={payouts}
              loading={dataLoading}
              onOpenClient={(id) => setSelectedClientId(id)}
            />
          )}
        </main>
      </div>

      {/* Modals & Drawer */}
      <ClientModal
        isOpen={clientModalOpen}
        editingClient={editingClient}
        onClose={() => setClientModalOpen(false)}
        onSave={handleSaveClient}
      />

      <PayoutModal
        isOpen={payoutModalOpen}
        clients={clients}
        editingPayout={editingPayout}
        defaultClientId={payoutDefaultClientId}
        onClose={() => setPayoutModalOpen(false)}
        onSave={handleSavePayout}
      />

      <ClientDrawer
        client={selectedClient}
        payouts={selectedClientPayouts}
        onClose={() => setSelectedClientId(null)}
        onEditClient={handleOpenEditClient}
        onChangeStatus={handleChangeClientStatus}
        onUpdateClientDocuments={handleUpdateClientDocuments}
        onDeleteClient={handleDeleteClient}
        onCreatePayout={handleDrawerCreatePayout}
        onUpdatePayout={handleDrawerUpdatePayout}
        onDeletePayout={handleDeletePayout}
      />

      {/* Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <ErrorBoundary>
      {!authReady ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="text-sm text-slate-500">Загрузка рабочего пространства...</div>
        </div>
      ) : user ? (
        <CrmWorkspace user={user} />
      ) : (
        <AuthScreen />
      )}
    </ErrorBoundary>
  );
}
