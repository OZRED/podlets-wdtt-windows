import React, { useState, useEffect, useRef } from 'react';
import { Copy, Trash2, ArrowDownCircle, Search, Terminal } from 'lucide-react';

interface LogsProps {
  logs: string[];
  onClear: () => void;
}

export const Logs: React.FC<LogsProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((line) => {
    if (search && !line.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filter === 'network') return line.includes('[TUNNEL]') || line.includes('[WINTUN]') || line.includes('[ROUTE]');
    if (filter === 'client') return line.includes('[КЛИЕНТ]') || line.includes('[ДИСП]');
    if (filter === 'vk') return line.includes('[VK') || line.includes('[КАПЧА]') || line.includes('[TURN]');
    if (filter === 'errors') return line.toLowerCase().includes('err') || line.toLowerCase().includes('fail') || line.toLowerCase().includes('ошибка');
    return true;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(filteredLogs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLineColor = (line: string): string => {
    const l = line.toLowerCase();
    if (l.includes('ошибка') || l.includes('error') || l.includes('fail') || l.includes('panic')) {
      return 'text-rose-400';
    }
    if (l.includes('поднят') || l.includes('success') || l.includes('успеш')) {
      return 'text-emerald-400';
    }
    if (l.includes('[капча]') || l.includes('captcha')) {
      return 'text-amber-300';
    }
    if (l.includes('[wintun]') || l.includes('[tunnel]')) {
      return 'text-cyan-400';
    }
    if (l.includes('[дисп]')) {
      return 'text-indigo-300';
    }
    return 'text-slate-300';
  };

  return (
    <div className="flex flex-col h-full p-6 select-none">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-700/60 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Логи в реальном времени</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
              {logs.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Диагностика туннеля и сетевого стека Wintun</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-xl border transition ${
              autoScroll
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>Автопрокрутка</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
          </button>

          <button
            onClick={onClear}
            className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl transition"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Очистить</span>
          </button>
        </div>
      </div>

      {/* Filter tabs and search */}
      <div className="flex items-center justify-between mb-3 space-x-3">
        <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
          {[
            { id: 'all', label: 'Все' },
            { id: 'network', label: 'Сеть/VPN' },
            { id: 'client', label: 'Ядро' },
            { id: 'vk', label: 'Протокол' },
            { id: 'errors', label: 'Ошибки' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1 rounded-lg transition font-medium ${
                filter === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Поиск по логам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Terminal logs viewport */}
      <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 overflow-y-auto font-mono text-xs select-text shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 text-center py-12">Нет записей в логе</div>
        ) : (
          filteredLogs.map((line, idx) => (
            <div key={idx} className={`py-0.5 leading-relaxed break-all ${getLineColor(line)}`}>
              {line}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
