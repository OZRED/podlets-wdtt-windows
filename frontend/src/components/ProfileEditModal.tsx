import React, { useState } from 'react';
import { X, Save, Server } from 'lucide-react';
import { config } from '../../wailsjs/go/models';

interface ProfileEditModalProps {
  profile: config.ConnectionProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: config.ConnectionProfile) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [form, setForm] = useState<config.ConnectionProfile>(
    profile || {
      id: '',
      name: 'Новый сервер',
      peer: '1.2.3.4:56003',
      password: '',
      vk_hashes: '',
      workers: 9,
      port: 9000,
      dns: 'yandex',
      obfs: 'audio',
      mode: 'rawtun',
      group: '',
      notes: '',
      traffic_mb: 0,
      created_at: 0,
      updated_at: 0,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">
              {profile ? 'Редактировать профиль' : 'Добавить профиль'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Название профиля
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="Например: Нидерланды 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Адрес VPS (IP:Порт)
              </label>
              <input
                type="text"
                required
                value={form.peer}
                onChange={(e) => setForm({ ...form, peer: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="45.12.34.56:56003"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Пароль подключения
              </label>
              <input
                type="text"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="Пароль от сервера"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Хеши VK-звонков (через запятую)
            </label>
            <textarea
              rows={3}
              value={form.vk_hashes}
              onChange={(e) => setForm({ ...form, vk_hashes: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono resize-none"
              placeholder="хеш1, хеш2, хеш3..."
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Хеши из ссылок звонков VK (vk.com/call/join/...). Чем больше хешей, тем выше скорость и надежность.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Воркеров (потоков)
              </label>
              <input
                type="number"
                min="1"
                max="108"
                value={form.workers}
                onChange={(e) => setForm({ ...form, workers: parseInt(e.target.value) || 9 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Локальный порт
              </label>
              <input
                type="number"
                min="1024"
                max="65535"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 9000 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-700 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-700 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Сохранить профиль</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
