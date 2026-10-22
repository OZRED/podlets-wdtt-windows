import React, { useState } from 'react';
import { X, Plus, RefreshCw, Layers } from 'lucide-react';
import { config } from '../../wailsjs/go/models';

interface SubscriptionsModalProps {
  isOpen: boolean;
  subscriptions: config.SubscriptionItem[];
  onClose: () => void;
  onAddSubscription: (name: string, url: string) => Promise<void>;
  onRefreshSubscription: (sub: config.SubscriptionItem) => Promise<void>;
  onDeleteSubscription: (id: string) => void;
}

export const SubscriptionsModal: React.FC<SubscriptionsModalProps> = ({
  isOpen,
  onClose,
  onAddSubscription,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAddSubscription(name.trim(), url.trim());
      setName('');
      setUrl('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить подписку');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Добавить подписку</h3>
              <p className="text-xs text-slate-400">Автоматическое получение серверов по ссылке</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAdd} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Ссылка на подписку
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="https://raw.githubusercontent.com/... или https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Название подписки (опционально)
            </label>
            <input
              type="text"
              placeholder="Оставьте пустым для автоназвания из подписки"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Если не указано, автоматически подставится название из источника подписки.
            </span>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-700/60 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>{loading ? 'Загрузка...' : 'Добавить подписку'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
