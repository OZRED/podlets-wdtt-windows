import React, { useState } from 'react';
import { ShieldCheck, Plus, RotateCcw, Save } from 'lucide-react';

interface BypassProps {
  bypassRoutes: string;
  onSave: (routes: string) => void;
}

export const Bypass: React.FC<BypassProps> = ({ bypassRoutes, onSave }) => {
  const [routes, setRoutes] = useState(bypassRoutes);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(routes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddLocalPreset = () => {
    const localPreset = '10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16\n127.0.0.0/8';
    setRoutes((prev) => {
      const existing = prev.trim();
      return existing ? `${existing}\n${localPreset}` : localPreset;
    });
  };

  return (
    <div className="flex flex-col h-full p-6 select-none">
      <div className="pb-4 border-b border-slate-700/60 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>Исключения (Split Tunneling)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            IP-адреса и подсети (CIDR), которые будут идти напрямую в обход VPN
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddLocalPreset}
            className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl transition"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Добавить локальные сети</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg ${
              saved
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saved ? 'Сохранено!' : 'Сохранить'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <label className="text-xs font-medium text-slate-400 mb-2">
          Укажите один IP или CIDR на строку (например, 192.168.1.0/24 или 95.173.136.0/21):
        </label>
        <textarea
          value={routes}
          onChange={(e) => setRoutes(e.target.value)}
          placeholder="10.0.0.0/8&#10;172.16.0.0/12&#10;192.168.0.0/16"
          className="flex-1 w-full bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
        />

        <div className="mt-4 p-3.5 bg-slate-800/50 border border-slate-700/40 rounded-xl text-xs text-slate-400 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            IP-адреса вашего VPS и TURN-серверов VK исключаются автоматически, чтобы не допустить
            зацикливания туннеля.
          </div>
        </div>
      </div>
    </div>
  );
};
