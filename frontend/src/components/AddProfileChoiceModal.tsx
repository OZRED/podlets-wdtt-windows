import React from 'react';
import { X, Layers, KeyRound, Sliders, ChevronRight } from 'lucide-react';

interface AddProfileChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseSubscription: () => void;
  onChooseKey: () => void;
  onChooseManual: () => void;
}

export const AddProfileChoiceModal: React.FC<AddProfileChoiceModalProps> = ({
  isOpen,
  onClose,
  onChooseSubscription,
  onChooseKey,
  onChooseManual,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white">Добавить профиль</h3>
            <p className="text-xs text-slate-400 mt-0.5">Выберите способ добавления конфигурации</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Grid */}
        <div className="p-5 space-y-3">
          {/* Option 1: Key / Link */}
          <button
            onClick={() => {
              onClose();
              onChooseKey();
            }}
            className="w-full group flex items-center justify-between p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/80 rounded-2xl transition text-left shadow-sm"
          >
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                  Ключ или ссылка конфигурации
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Импорт ссылки <code className="text-slate-300 font-mono text-[11px]">podlets://</code>, <code className="text-slate-300 font-mono text-[11px]">wdtt://</code> или Base64
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition group-hover:translate-x-0.5" />
          </button>

          {/* Option 2: Subscription */}
          <button
            onClick={() => {
              onClose();
              onChooseSubscription();
            }}
            className="w-full group flex items-center justify-between p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/80 rounded-2xl transition text-left shadow-sm"
          >
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                  Ссылка на подписку
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  URL для автоматической загрузки и обновления списка серверов
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition group-hover:translate-x-0.5" />
          </button>

          {/* Option 3: Manual */}
          <button
            onClick={() => {
              onClose();
              onChooseManual();
            }}
            className="w-full group flex items-center justify-between p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/80 rounded-2xl transition text-left shadow-sm"
          >
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                  Указать данные вручную
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Самостоятельный ввод IP адреса сервера, порта, пароля и хешей
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
