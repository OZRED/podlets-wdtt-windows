import React from 'react';
import { Power, ArrowDown, ArrowUp, Activity, Clock, Server, Sparkles } from 'lucide-react';
import { config, vpn } from '../../wailsjs/go/models';
import { maskPeer } from '../utils/mask';

interface DashboardProps {
  activeProfile: config.ConnectionProfile | null;
  stats: vpn.TunnelStats;
  isConnecting: boolean;
  isConnected: boolean;
  onToggleConnect: () => void;
  onSelectProfile: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeProfile,
  stats,
  isConnecting,
  isConnected,
  onToggleConnect,
  onSelectProfile,
}) => {
  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (connectedAt: number): string => {
    if (!connectedAt || !isConnected) return '00:00:00';
    const seconds = Math.floor(Date.now() / 1000) - connectedAt;
    if (seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="relative flex flex-col h-full items-center justify-between p-5 select-none overflow-hidden animate-in fade-in duration-300">
      {/* Background ambient neon glow */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${
          isConnected
            ? 'bg-emerald-500/15 scale-125'
            : isConnecting
            ? 'bg-amber-500/15 animate-pulse scale-110'
            : 'bg-indigo-600/10 scale-90'
        }`}
      />

      {/* Top Active profile card */}
      <div
        onClick={onSelectProfile}
        className={`w-full max-w-md bg-slate-900/80 hover:bg-slate-900 border rounded-2xl p-3.5 backdrop-blur-xl shadow-xl transition-all duration-200 cursor-pointer group ${
          isConnected
            ? 'border-emerald-500/30 shadow-emerald-500/5'
            : isConnecting
            ? 'border-amber-500/30'
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`p-2 rounded-xl transition duration-300 ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : isConnecting
                  ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                  : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400 group-hover:bg-slate-750'
              }`}
            >
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Выбранный сервер
              </div>
              <div className="text-sm font-bold text-white flex items-center space-x-2 truncate">
                <span className="truncate">{activeProfile ? activeProfile.name : 'Профиль не выбран'}</span>
                {activeProfile && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                    {activeProfile.mode || 'rawtun'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            disabled={isConnected || isConnecting}
            className="text-[11px] font-semibold bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white text-slate-300 px-3 py-1 rounded-xl transition shrink-0 ml-2"
          >
            Сменить
          </button>
        </div>

        {activeProfile && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="truncate">{maskPeer(activeProfile.peer)}</span>
            <span className="text-slate-500">•</span>
            <span>{activeProfile.workers} потоков</span>
            <span className="text-slate-500">•</span>
            <span className="capitalize">{activeProfile.obfs}</span>
          </div>
        )}
      </div>

      {/* Centerpiece Power Button with layered animated rings */}
      <div className="relative flex flex-col items-center my-auto py-2">
        {/* Layer 1: Outer Pulse Wave */}
        {isConnected && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-emerald-500/20 animate-ping pointer-events-none" />
        )}
        {/* Layer 2: Glowing Halo */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-md transition duration-500 ${
            isConnected
              ? 'bg-emerald-500/30'
              : isConnecting
              ? 'bg-amber-500/30 animate-pulse'
              : 'bg-indigo-600/10'
          }`}
        />

        <button
          onClick={onToggleConnect}
          title={isConnected ? 'Нажмите для отключения' : isConnecting ? 'Нажмите для отмены подключения' : 'Нажмите для подключения'}
          className={`relative group w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl focus:outline-none cursor-pointer z-10 ${
            isConnected
              ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-105'
              : isConnecting
              ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 shadow-amber-500/40 hover:from-rose-600 hover:to-rose-500 hover:shadow-rose-500/40'
              : 'bg-gradient-to-tr from-slate-800 to-slate-900 hover:from-slate-750 hover:to-indigo-950 border border-slate-700/60 shadow-black/60 hover:scale-105'
          }`}
        >
          {/* Inner ring */}
          <div
            className={`absolute inset-1.5 rounded-full border transition duration-300 ${
              isConnected
                ? 'border-white/25'
                : isConnecting
                ? 'border-amber-300/40'
                : 'border-slate-700/50 group-hover:border-indigo-500/40'
            }`}
          />

          <Power
            className={`w-12 h-12 transition-all duration-300 ${
              isConnected
                ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] scale-105'
                : isConnecting
                ? 'text-amber-100 group-hover:text-white'
                : 'text-slate-400 group-hover:text-indigo-300 group-hover:scale-110'
            }`}
          />

          <span className="mt-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white/95">
            {isConnected ? 'ОТКЛЮЧИТЬ' : isConnecting ? 'ОТМЕНА' : activeProfile ? 'ПОДКЛЮЧИТЬ' : 'ВЫБРАТЬ'}
          </span>
        </button>

        {/* Status text */}
        <div className="mt-3 text-center z-10">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full transition ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-bounce'
                  : 'bg-slate-600'
              }`}
            />
            <span className="tracking-wide">
              {isConnected
                ? 'Защищённый туннель активен'
                : isConnecting
                ? 'Согласование соединения...'
                : activeProfile
                ? 'Готов к подключению'
                : 'Выберите профиль для старта'}
            </span>
          </div>
          {stats.error_message && (
            <div className="mt-1 text-[11px] text-rose-400 max-w-xs text-center font-medium">
              {stats.error_message}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="w-full max-w-xl grid grid-cols-4 gap-2.5 z-10">
        {/* Download Speed */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-2.5 flex flex-col items-center backdrop-blur-xl transition">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 mb-0.5">
            <ArrowDown className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-bounce' : 'text-slate-500'}`} />
            <span>Входящая</span>
          </div>
          <div className="text-xs font-extrabold text-white font-mono">
            {isConnected ? formatSpeed(stats.speed_down) : '0 B/s'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {formatBytes(stats.bytes_down)}
          </div>
        </div>

        {/* Upload Speed */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-2.5 flex flex-col items-center backdrop-blur-xl transition">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 mb-0.5">
            <ArrowUp className={`w-3.5 h-3.5 ${isConnected ? 'text-blue-400 animate-bounce' : 'text-slate-500'}`} />
            <span>Исходящая</span>
          </div>
          <div className="text-xs font-extrabold text-white font-mono">
            {isConnected ? formatSpeed(stats.speed_up) : '0 B/s'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {formatBytes(stats.bytes_up)}
          </div>
        </div>

        {/* Workers */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-2.5 flex flex-col items-center backdrop-blur-xl transition">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 mb-0.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Потоки</span>
          </div>
          <div className="text-xs font-extrabold text-white font-mono">
            {isConnected ? `${stats.active_relays || (activeProfile ? activeProfile.workers : 0)}` : '0'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Активные
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-2.5 flex flex-col items-center backdrop-blur-xl transition">
          <div className="flex items-center space-x-1 text-[11px] text-slate-400 mb-0.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Время</span>
          </div>
          <div className="text-xs font-extrabold text-white font-mono">
            {formatUptime(stats.connected_at)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Сессия
          </div>
        </div>
      </div>
    </div>
  );
};
