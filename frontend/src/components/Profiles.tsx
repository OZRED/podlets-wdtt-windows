import React, { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Trash2,
  Edit2,
  Share2,
  Layers,
  RefreshCw,
  Radio,
  User,
  Clock,
  HardDrive,
  Info,
} from 'lucide-react';
import { config } from '../../wailsjs/go/models';
import { maskPeer } from '../utils/mask';

interface ProfilesProps {
  profiles: config.ConnectionProfile[];
  subscriptions: config.SubscriptionItem[];
  activeProfileId: string;
  isConnected: boolean;
  onSelectActive: (id: string) => void;
  onAddProfile: () => void;
  onEditProfile: (profile: config.ConnectionProfile) => void;
  onDeleteProfile: (id: string) => void;
  onExportProfile: (profile: config.ConnectionProfile) => void;
  onImportUri: () => void;
  onOpenSubscriptions: () => void;
  onRefreshSubscription: (sub: config.SubscriptionItem) => Promise<void>;
  onDeleteSubscription: (id: string) => void;
  onCheckHashes: (profile: config.ConnectionProfile) => void;
}

function formatHashes(count: number): string {
  if (count === 0) return 'Без хешей';
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} хеш`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} хеша`;
  return `${count} хешей`;
}

function formatWorkers(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} воркер`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} воркера`;
  return `${count} воркеров`;
}

function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} ГБ`;
  }
  return `${mb.toFixed(1)} МБ`;
}

export const Profiles: React.FC<ProfilesProps> = ({
  profiles,
  subscriptions,
  activeProfileId,
  isConnected,
  onSelectActive,
  onAddProfile,
  onEditProfile,
  onDeleteProfile,
  onExportProfile,
  onOpenSubscriptions,
  onRefreshSubscription,
  onDeleteSubscription,
  onCheckHashes,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [refreshingSubId, setRefreshingSubId] = useState<string | null>(null);

  // Подсчёт личных профилей (без подписки)
  const personalProfiles = profiles.filter((p) => !p.subscription_id);

  // Фильтрация по выбранной вкладке (закладке)
  const tabProfiles = profiles.filter((p) => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'personal') return !p.subscription_id;
    return p.subscription_id === selectedTab;
  });

  // Фильтрация по поисковой строке
  const filtered = tabProfiles.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.peer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.group && p.group.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Текущая выбранная подписка (если активна её закладка)
  const activeSub = subscriptions.find((s) => s.id === selectedTab);

  const handleRefreshSub = async (sub: config.SubscriptionItem) => {
    setRefreshingSubId(sub.id);
    try {
      await onRefreshSubscription(sub);
    } catch (err: any) {
      alert(`Ошибка обновления: ${err?.message || err}`);
    } finally {
      setRefreshingSubId(null);
    }
  };

  const handleDeleteSub = (sub: config.SubscriptionItem) => {
    if (confirm(`Удалить подписку "${sub.name}" и все её профили?`)) {
      onDeleteSubscription(sub.id);
      setSelectedTab('all');
    }
  };

  return (
    <div className="flex flex-col h-full p-5 select-none overflow-hidden">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Профили подключения</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {profiles.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Управление серверами и конфигурациями</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onAddProfile}
            className="flex items-center space-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3.5 py-1.5 rounded-xl shadow-lg shadow-indigo-600/30 transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить профиль</span>
          </button>
        </div>
      </div>

      {/* Tabs / Bookmarks for Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="flex items-center space-x-1.5 pt-3 pb-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedTab('all')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
              selectedTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Все</span>
            <span className="text-[10px] opacity-75 font-mono">({profiles.length})</span>
          </button>

          {subscriptions.map((sub) => {
            const count = profiles.filter((p) => p.subscription_id === sub.id).length;
            const isTabActive = selectedTab === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedTab(sub.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                  isTabActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate max-w-[130px]">{sub.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}

          {personalProfiles.length > 0 && (
            <button
              onClick={() => setSelectedTab('personal')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                selectedTab === 'personal'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Личные</span>
              <span className="text-[10px] opacity-75 font-mono">({personalProfiles.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Subscription Card (when active subscription tab is selected) */}
      {activeSub && (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-indigo-500/30 rounded-2xl p-3.5 my-2 shrink-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Radio className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white truncate">{activeSub.name}</span>
                  {activeSub.version ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                      v{activeSub.version}
                    </span>
                  ) : null}
                </div>
                {activeSub.description && (
                  <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                    {activeSub.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0 ml-3">
              <button
                onClick={() => handleRefreshSub(activeSub)}
                disabled={refreshingSubId === activeSub.id}
                title="Обновить подписку"
                className="flex items-center space-x-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-700 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    refreshingSubId === activeSub.id ? 'animate-spin text-indigo-400' : ''
                  }`}
                />
                <span>Обновить</span>
              </button>
              <button
                onClick={() => handleDeleteSub(activeSub)}
                title="Удалить подписку и серверы"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Traffic progress & metadata row */}
          {(activeSub.traffic_limit_mb > 0 || activeSub.updated_at) && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center space-x-3">
                {activeSub.traffic_limit_mb > 0 && (
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-3 h-3 text-slate-400" />
                    <span>
                      {formatMb(activeSub.traffic_used_mb)} из {formatMb(activeSub.traffic_limit_mb)}
                    </span>
                    <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((activeSub.traffic_used_mb / activeSub.traffic_limit_mb) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {activeSub.updated_at && (
                  <div className="flex items-center space-x-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>Обновлено: {activeSub.updated_at}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Input */}
      {profiles.length > 4 && (
        <div className="my-2 shrink-0">
          <input
            type="text"
            placeholder="Поиск по названию или IP:порту..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Profiles list */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 mt-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <p className="text-xs">
              {profiles.length === 0 ? 'Профили ещё не добавлены' : 'Нет серверов в этой категории'}
            </p>
            <button
              onClick={onAddProfile}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Добавить первый профиль
            </button>
          </div>
        ) : (
          filtered.map((p) => {
            const isActive = p.id === activeProfileId;
            const hashesCount = p.vk_hashes ? p.vk_hashes.split(',').filter(Boolean).length : 0;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-slate-800/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-900/60 hover:bg-slate-800/70 border-slate-800/80'
                }`}
              >
                {/* Left select radio & info */}
                <div
                  className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                  onClick={() => !isConnected && onSelectActive(p.id)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition shrink-0 ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Title row */}
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-xs font-bold text-white truncate">{p.name}</span>
                      {isActive && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          Активен
                        </span>
                      )}
                      {p.group && selectedTab === 'all' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 truncate max-w-[120px]">
                          {p.group}
                        </span>
                      )}
                    </div>

                    {/* Info row - Strict single line */}
                    <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                      <span className="font-mono text-slate-300 shrink-0">{maskPeer(p.peer)}</span>
                      <span className="text-slate-600 shrink-0">•</span>
                      <span className="text-indigo-300 font-medium shrink-0">
                        {formatHashes(hashesCount)}
                      </span>
                      <span className="text-slate-600 shrink-0">•</span>
                      <span className="shrink-0">{formatWorkers(p.workers || 9)}</span>
                      <span className="text-slate-600 shrink-0">•</span>
                      <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-slate-800/90 text-slate-400 shrink-0">
                        {p.obfs || 'audio'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right action buttons */}
                <div className="flex items-center space-x-1 pl-2 shrink-0">
                  <button
                    onClick={() => onCheckHashes(p)}
                    title="Проверить хеши"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onExportProfile(p)}
                    title="Экспорт ссылки wdtt://"
                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onEditProfile(p)}
                    title="Редактировать"
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteProfile(p.id)}
                    disabled={isActive && isConnected}
                    title="Удалить профиль"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
