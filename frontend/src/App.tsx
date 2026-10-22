import React, { useState, useEffect } from 'react';
import {
  Rocket,
  Layers,
  ShieldCheck,
  Terminal,
  Settings as SettingsIcon,
  Server,
  Power,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import {
  GetConfig,
  SaveConfig,
  Connect,
  Disconnect,
  GetTunnelStats,
  GetLogs,
  ClearLogs,
  ImportUri,
  ExportUri,
  SubmitCaptcha,
  FetchSubscription,
} from '../wailsjs/go/main/App';

import { config, vpn, main } from '../wailsjs/go/models';

import { Dashboard } from './components/Dashboard';
import { Profiles } from './components/Profiles';
import { Bypass } from './components/Bypass';
import { Logs } from './components/Logs';
import { Settings } from './components/Settings';
import { ProfileEditModal } from './components/ProfileEditModal';
import { SubscriptionsModal } from './components/SubscriptionsModal';
import { HashCheckModal } from './components/HashCheckModal';
import { CaptchaModal } from './components/CaptchaModal';
import { AddProfileChoiceModal } from './components/AddProfileChoiceModal';

// Wails events runtime
declare global {
  interface Window {
    runtime?: {
      EventsOn: (eventName: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'bypass' | 'logs' | 'settings'>('dashboard');
  const [cfg, setCfg] = useState<config.AppConfig | null>(null);
  const [stats, setStats] = useState<vpn.TunnelStats>({
    state: 'DISCONNECTED',
    error_message: '',
    bytes_up: 0,
    bytes_down: 0,
    speed_up: 0,
    speed_down: 0,
    ping_ms: 0,
    active_relays: 0,
    connected_at: 0,
  });
  const [logs, setLogs] = useState<string[]>([]);

  // Modals state
  const [editingProfile, setEditingProfile] = useState<config.ConnectionProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSubscriptionsOpen, setIsSubscriptionsOpen] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState<config.ConnectionProfile | null>(null);
  const [isHashCheckOpen, setIsHashCheckOpen] = useState(false);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);

  // Captcha modal state
  const [captchaData, setCaptchaData] = useState<{
    mode: string;
    redirectUri: string;
    sessionToken: string;
  } | null>(null);

  // Initial load
  useEffect(() => {
    loadConfig();
    loadInitialLogs();

    // Setup Wails runtime listeners
    if (window.runtime) {
      window.runtime.EventsOn('tunnel-state', (data: { state: string; error: string }) => {
        setStats((prev) => ({
          ...prev,
          state: data.state as any,
          error_message: data.error || '',
        }));
      });

      window.runtime.EventsOn('tunnel-stats', (newStats: vpn.TunnelStats) => {
        setStats(newStats);
      });

      window.runtime.EventsOn('log', (line: string) => {
        setLogs((prev) => [...prev.slice(-499), line]);
      });

      window.runtime.EventsOn('captcha-required', (data: { mode: string; redirect_uri: string; session_token: string }) => {
        setCaptchaData({
          mode: data.mode,
          redirectUri: data.redirect_uri,
          sessionToken: data.session_token,
        });
      });
    }
  }, []);

  const loadConfig = async () => {
    try {
      const c = await GetConfig();
      setCfg(c);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const loadInitialLogs = async () => {
    try {
      const initialLogs = await GetLogs();
      setLogs(initialLogs);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const isConnected = stats.state === 'CONNECTED';
  const isConnecting = stats.state === 'CONNECTING';

  const activeProfile =
    cfg?.profiles.find((p) => p.id === cfg.active_profile_id) ||
    cfg?.profiles[0] ||
    null;

  const handleToggleConnect = async () => {
    if (isConnected || isConnecting) {
      try {
        await Disconnect();
      } catch (err: any) {
        console.error('Failed to disconnect:', err);
      }
    } else {
      if (!activeProfile) {
        setActiveTab('profiles');
        setIsChoiceModalOpen(true);
        return;
      }
      try {
        await Connect(activeProfile.id);
      } catch (err: any) {
        alert(`Ошибка подключения: ${err?.message || err}`);
      }
    }
  };

  const handleSelectActiveProfile = async (id: string) => {
    if (!cfg) return;
    const updated = new config.AppConfig({ ...cfg, active_profile_id: id });
    setCfg(updated);
    await SaveConfig(updated);
  };

  const handleSaveProfile = async (profile: config.ConnectionProfile) => {
    if (!cfg) return;
    const isFirst = cfg.profiles.length === 0;
    const exists = cfg.profiles.some((p) => p.id === profile.id);
    let updatedProfiles = [...cfg.profiles];

    if (exists) {
      updatedProfiles = updatedProfiles.map((p) => (p.id === profile.id ? profile : p));
    } else {
      updatedProfiles.push(profile);
    }

    const updated = new config.AppConfig({
      ...cfg,
      profiles: updatedProfiles,
      active_profile_id: profile.id, // Сразу делаем активным добавленный профиль
    });

    setCfg(updated);
    await SaveConfig(updated);

    if (isFirst) {
      setActiveTab('dashboard');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!cfg) return;
    const updatedProfiles = cfg.profiles.filter((p) => p.id !== id);
    const updatedActiveId =
      cfg.active_profile_id === id
        ? updatedProfiles[0]?.id || ''
        : cfg.active_profile_id;

    const updated = new config.AppConfig({
      ...cfg,
      profiles: updatedProfiles,
      active_profile_id: updatedActiveId,
    });

    setCfg(updated);
    await SaveConfig(updated);
  };

  const handleImportUri = async () => {
    const raw = prompt('Вставьте ссылку конфигурации (podlets://config?... или wdtt://config?... или Base64):');
    if (!raw) return;

    try {
      const imported = await ImportUri(raw);
      if (imported && cfg) {
        await handleSaveProfile(imported);
        setActiveTab('dashboard');
        alert(`Профиль "${imported.name}" успешно импортирован и выбран!`);
      }
    } catch (err: any) {
      alert(`Ошибка разбора ссылки: ${err?.message || err}`);
    }
  };

  const handleExportProfile = async (p: config.ConnectionProfile) => {
    try {
      const uri = await ExportUri(p);
      await navigator.clipboard.writeText(uri);
      alert(`Ссылка wdtt:// для профиля "${p.name}" скопирована в буфер обмена!`);
    } catch (err: any) {
      alert(`Ошибка экспорта: ${err?.message || err}`);
    }
  };

  const handleAddSubscription = async (name: string, url: string) => {
    if (!cfg) return;
    const res = await FetchSubscription(url);
    if (!res || !res.profiles || res.profiles.length === 0) {
      throw new Error('В подписке нет профилей');
    }

    const subId = Math.random().toString(36).substring(2, 9);
    const subName = name || res.subscription_name || 'Подписка';

    const newSubItem = new config.SubscriptionItem({
      id: subId,
      name: subName,
      url: url,
      description: res.description || '',
      updated_at: res.updated_at || new Date().toLocaleString(),
      traffic_used_mb: res.traffic_used_mb || 0,
      traffic_limit_mb: res.traffic_limit_mb || 0,
      version: res.version || 0,
    });

    // Привязываем профили к этой подписке
    const taggedProfiles = res.profiles.map((p) => ({
      ...p,
      subscription_id: subId,
      group: subName,
    }));

    // Исключаем старые профили с такими же IP:port, чтобы не дублировать
    const incomingPeers = new Set(taggedProfiles.map((p) => p.peer));
    const cleanOldProfiles = cfg.profiles.filter((p) => !incomingPeers.has(p.peer));

    const wasEmpty = cfg.profiles.length === 0;
    const allProfiles = [...cleanOldProfiles, ...taggedProfiles];
    const newActiveId = cfg.active_profile_id && allProfiles.some((p) => p.id === cfg.active_profile_id)
      ? cfg.active_profile_id
      : allProfiles[0]?.id || '';

    const updated = new config.AppConfig({
      ...cfg,
      subscriptions: [...cfg.subscriptions, newSubItem],
      profiles: allProfiles,
      active_profile_id: newActiveId,
    });

    setCfg(updated);
    await SaveConfig(updated);

    if (wasEmpty && newActiveId) {
      setActiveTab('dashboard');
    }
  };

  const handleRefreshSubscription = async (sub: config.SubscriptionItem) => {
    if (!cfg) return;
    const res = await FetchSubscription(sub.url);
    if (!res || !res.profiles) return;

    const updatedSubs = cfg.subscriptions.map((s) =>
      s.id === sub.id
        ? new config.SubscriptionItem({
            ...s,
            name: res.subscription_name || s.name,
            description: res.description !== undefined ? res.description : s.description,
            updated_at: res.updated_at || new Date().toLocaleString(),
            traffic_used_mb: res.traffic_used_mb ?? s.traffic_used_mb,
            traffic_limit_mb: res.traffic_limit_mb ?? s.traffic_limit_mb,
            version: res.version ?? s.version,
          })
        : s
    );

    // Сохраняем профили, не относящиеся к этой подписке
    const otherProfiles = cfg.profiles.filter(
      (p) => p.subscription_id !== sub.id && p.group !== sub.name
    );

    // Новые профили от подписки
    const refreshedProfiles = res.profiles.map((p) => ({
      ...p,
      subscription_id: sub.id,
      group: res.subscription_name || sub.name,
    }));

    const allProfiles = [...otherProfiles, ...refreshedProfiles];
    const activeStillExists = allProfiles.some((p) => p.id === cfg.active_profile_id);
    const newActiveId = activeStillExists ? cfg.active_profile_id : allProfiles[0]?.id || '';

    const updated = new config.AppConfig({
      ...cfg,
      subscriptions: updatedSubs,
      profiles: allProfiles,
      active_profile_id: newActiveId,
    });

    setCfg(updated);
    await SaveConfig(updated);
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!cfg) return;
    const subToDelete = cfg.subscriptions.find((s) => s.id === id);
    const subName = subToDelete?.name;

    // Каскадное удаление: удаляем и саму подписку, и все её профили
    const remainingProfiles = cfg.profiles.filter(
      (p) => p.subscription_id !== id && (subName ? p.group !== subName : true)
    );
    const activeStillExists = remainingProfiles.some((p) => p.id === cfg.active_profile_id);
    const newActiveId = activeStillExists ? cfg.active_profile_id : remainingProfiles[0]?.id || '';

    const updated = new config.AppConfig({
      ...cfg,
      subscriptions: cfg.subscriptions.filter((s) => s.id !== id),
      profiles: remainingProfiles,
      active_profile_id: newActiveId,
    });
    setCfg(updated);
    await SaveConfig(updated);
  };

  const handleSaveBypassRoutes = async (routes: string) => {
    if (!cfg) return;
    const updated = new config.AppConfig({
      ...cfg,
      settings: new config.AppSettings({ ...cfg.settings, bypass_routes: routes }),
    });
    setCfg(updated);
    await SaveConfig(updated);
  };

  const handleSaveSettings = async (settings: config.AppSettings) => {
    if (!cfg) return;
    const updated = new config.AppConfig({
      ...cfg,
      settings: settings,
    });
    setCfg(updated);
    await SaveConfig(updated);
  };

  const handleCaptchaSubmit = (token: string) => {
    SubmitCaptcha(token);
    setCaptchaData(null);
  };

  const handleCaptchaCancel = () => {
    SubmitCaptcha('error:canceled');
    setCaptchaData(null);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <div className="w-52 bg-slate-900/95 border-r border-slate-800 flex flex-col justify-between p-3.5 shrink-0 select-none backdrop-blur-2xl">
        <div>
          {/* App Brand Header */}
          <div className="flex items-center space-x-2.5 px-2 py-3 mb-3 border-b border-slate-800/80">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white tracking-wide">
                Podlets WDTT
              </div>
              <div className="text-[10px] text-indigo-400 font-mono font-medium">v0.1 • Windows</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Главная', icon: Rocket },
              { id: 'profiles', label: 'Профили', icon: Server, badge: cfg?.profiles.length },
              { id: 'bypass', label: 'Исключения', icon: ShieldCheck },
              { id: 'logs', label: 'Логи', icon: Terminal },
              { id: 'settings', label: 'Настройки', icon: SettingsIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status Pill */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-bounce'
                  : 'bg-slate-600'
              }`}
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-white truncate">
                {isConnected ? 'Защищено' : isConnecting ? 'Подключение' : 'Отключено'}
              </div>
              <div className="text-[9px] text-slate-400 truncate">
                {activeProfile ? activeProfile.name : 'Нет профиля'}
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleConnect}
            title={isConnected || isConnecting ? 'Остановить подключение' : 'Подключить'}
            className={`p-1.5 rounded-lg transition ${
              isConnected
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : isConnecting
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 animate-pulse'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900/40">
        {activeTab === 'dashboard' && (
          <Dashboard
            activeProfile={activeProfile}
            stats={stats}
            isConnecting={isConnecting}
            isConnected={isConnected}
            onToggleConnect={handleToggleConnect}
            onSelectProfile={() => setActiveTab('profiles')}
          />
        )}

        {activeTab === 'profiles' && (
          <Profiles
            profiles={cfg?.profiles || []}
            subscriptions={cfg?.subscriptions || []}
            activeProfileId={cfg?.active_profile_id || ''}
            isConnected={isConnected}
            onSelectActive={handleSelectActiveProfile}
            onAddProfile={() => {
              setIsChoiceModalOpen(true);
            }}
            onEditProfile={(p) => {
              setEditingProfile(p);
              setIsProfileModalOpen(true);
            }}
            onDeleteProfile={handleDeleteProfile}
            onExportProfile={handleExportProfile}
            onImportUri={handleImportUri}
            onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
            onRefreshSubscription={handleRefreshSubscription}
            onDeleteSubscription={handleDeleteSubscription}
            onCheckHashes={(p) => {
              setCheckingProfile(p);
              setIsHashCheckOpen(true);
            }}
          />
        )}

        {activeTab === 'bypass' && (
          <Bypass
            bypassRoutes={cfg?.settings.bypass_routes || ''}
            onSave={handleSaveBypassRoutes}
          />
        )}

        {activeTab === 'logs' && (
          <Logs
            logs={logs}
            onClear={() => {
              ClearLogs();
              setLogs([]);
            }}
          />
        )}

        {activeTab === 'settings' && cfg && (
          <Settings settings={cfg.settings} onSave={handleSaveSettings} />
        )}
      </div>

      {/* Profile Add/Edit Modal */}
      <ProfileEditModal
        isOpen={isProfileModalOpen}
        profile={editingProfile}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveProfile}
      />

      {/* Subscriptions Modal */}
      <SubscriptionsModal
        isOpen={isSubscriptionsOpen}
        subscriptions={cfg?.subscriptions || []}
        onClose={() => setIsSubscriptionsOpen(false)}
        onAddSubscription={handleAddSubscription}
        onRefreshSubscription={handleRefreshSubscription}
        onDeleteSubscription={handleDeleteSubscription}
      />

      {/* Hash Checker Modal */}
      <HashCheckModal
        isOpen={isHashCheckOpen}
        profile={checkingProfile}
        onClose={() => setIsHashCheckOpen(false)}
      />

      {/* Interactive VK Captcha Modal */}
      <CaptchaModal
        isOpen={Boolean(captchaData)}
        redirectUri={captchaData?.redirectUri || ''}
        sessionToken={captchaData?.sessionToken || ''}
        mode={captchaData?.mode || ''}
        onSubmit={handleCaptchaSubmit}
        onCancel={handleCaptchaCancel}
      />

      {/* Add Profile Choice Modal */}
      <AddProfileChoiceModal
        isOpen={isChoiceModalOpen}
        onClose={() => setIsChoiceModalOpen(false)}
        onChooseSubscription={() => setIsSubscriptionsOpen(true)}
        onChooseKey={handleImportUri}
        onChooseManual={() => {
          setEditingProfile(null);
          setIsProfileModalOpen(true);
        }}
      />
    </div>
  );
}
export default App;
