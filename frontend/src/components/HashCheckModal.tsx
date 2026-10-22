import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { main, config } from '../../wailsjs/go/models';
import { CheckHashes } from '../../wailsjs/go/main/App';

interface HashCheckModalProps {
  isOpen: boolean;
  profile: config.ConnectionProfile | null;
  onClose: () => void;
}

export const HashCheckModal: React.FC<HashCheckModalProps> = ({ isOpen, profile, onClose }) => {
  if (!isOpen || !profile) return null;

  const [results, setResults] = useState<main.HashCheckResult[]>([]);
  const [checking, setChecking] = useState(false);

  const hashes = profile.vk_hashes
    ? profile.vk_hashes.split(',').map((h: string) => h.trim()).filter(Boolean)
    : [];

  const handleStartCheck = async () => {
    if (hashes.length === 0) return;
    setChecking(true);
    try {
      const res = await CheckHashes(hashes);
      setResults(res);
    } catch (err: any) {
      alert(`Ошибка проверки: ${err?.message || err}`);
    } finally {
      setChecking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return (
          <span className="flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Работает</span>
          </span>
        );
      case 'captcha':
        return (
          <span className="flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Капча VK</span>
          </span>
        );
      case 'dead':
        return (
          <span className="flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Звонок закрыт</span>
          </span>
        );
      case 'limited':
        return (
          <span className="flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Лимит запросов</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            <span>Ошибка сети</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Проверка хешей звонков VK</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
                {profile.name}
              </span>
            </h3>
            <p className="text-xs text-slate-400">Проверка доступности TURN-серверов звонков VK</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-3.5 rounded-2xl border border-slate-700/60">
            <div className="text-xs text-slate-300">
              В профиле найдено <span className="font-bold text-white">{hashes.length}</span> хешей VK.
            </div>
            <button
              onClick={handleStartCheck}
              disabled={checking || hashes.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Проверка...' : 'Запустить тест'}</span>
            </button>
          </div>

          {results.length > 0 && (
            <div className="border border-slate-700/60 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/60">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Хеш звонка</th>
                    <th className="py-2.5 px-3">Статус</th>
                    <th className="py-2.5 px-3">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40 font-mono">
                  {results.map((r) => (
                    <tr key={r.index} className="hover:bg-slate-750/50">
                      <td className="py-2.5 px-3 text-slate-500">{r.index}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">
                        {r.hash.length > 20 ? `${r.hash.slice(0, 10)}...${r.hash.slice(-8)}` : r.hash}
                      </td>
                      <td className="py-2.5 px-3">{getStatusBadge(r.status)}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans truncate max-w-xs">
                        {r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
