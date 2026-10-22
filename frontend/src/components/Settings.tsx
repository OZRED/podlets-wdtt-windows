import React, { useState } from 'react';
import { Settings as SettingsIcon, Shield, Globe, Cpu, Sliders, ExternalLink, Save } from 'lucide-react';
import { config } from '../../wailsjs/go/models';

interface SettingsProps {
  settings: config.AppSettings;
  onSave: (settings: config.AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const [form, setForm] = useState<config.AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full p-6 select-none overflow-y-auto">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-700/60 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Настройки приложения</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Параметры соединения, DNS и поведение в системе</p>
        </div>

        <button
          onClick={handleSave}
          className={`flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg ${
            saved
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saved ? 'Сохранено!' : 'Сохранить настройки'}</span>
        </button>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Network & Protocol */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Сеть и DNS</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                DNS-резолвер для VK
              </label>
              <select
                value={form.default_dns}
                onChange={(e) => setForm({ ...form, default_dns: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="yandex">Яндекс DNS (77.88.8.8, быстрый в РФ)</option>
                <option value="cloudflare">Cloudflare (1.1.1.1)</option>
                <option value="google">Google DNS (8.8.8.8)</option>
                <option value="doh-yandex">DoH Яндекс (DNS over HTTPS)</option>
                <option value="doh-cloudflare">DoH Cloudflare (DNS over HTTPS)</option>
                <option value="doh-google">DoH Google (DNS over HTTPS)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                TURN-транспорт
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, turn_transport: 'tcp' })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                    (form.turn_transport || 'tcp') === 'tcp'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  TCP (Рекомендуется)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, turn_transport: 'udp' })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                    form.turn_transport === 'udp'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  UDP
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                TCP стабильнее при замедлении и дропах UDP провайдером
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Режим обфускации трафика
              </label>
              <select
                value={form.default_obfs}
                onChange={(e) => setForm({ ...form, default_obfs: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="audio">Аудио WebRTC (рекомендуется)</option>
                <option value="video">Видео WebRTC</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                VK Путь авторизации
              </label>
              <select
                value={form.vk_anon_path}
                onChange={(e) => setForm({ ...form, vk_anon_path: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="vkcalls">vkcalls (современный путь)</option>
                <option value="legacy">legacy (устаревший)</option>
              </select>
            </div>
          </div>
        </div>

        {/* System & Tray Behavior */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 mb-4">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Интерфейс и системный трей Windows</span>
          </h3>

          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.close_to_tray}
                onChange={(e) => setForm({ ...form, close_to_tray: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div>
                <div className="text-xs font-semibold text-white">Сворачивать в системный трей при закрытии (крестиком)</div>
                <div className="text-[11px] text-slate-400">Приложение останется активным в области уведомлений</div>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_connect}
                onChange={(e) => setForm({ ...form, auto_connect: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded bg-slate-900 border-slate-700 focus:ring-0"
              />
              <div>
                <div className="text-xs font-semibold text-white">Автоматически подключаться при запуске приложения</div>
                <div className="text-[11px] text-slate-400">Сразу активирует активный профиль</div>
              </div>
            </label>
          </div>
        </div>

        {/* About Card */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">Podlets WDTT</div>
              <div className="text-xs text-slate-400 mt-0.5">Версия 0.1 • Windows Wintun Edition • Форк qWDTT</div>
              <div className="text-[11px] text-slate-500 mt-2">
                Лицензия GNU GPL v3 • Настройки и драйвер в папке <code className="text-slate-300">resources/</code>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <a
                href="https://t.me/podlets_tool"
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition flex items-center space-x-1"
              >
                <span>Telegram Канал</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
