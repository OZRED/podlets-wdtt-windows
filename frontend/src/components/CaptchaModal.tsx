import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ExternalLink, X, ClipboardPaste, Globe, RefreshCw } from 'lucide-react';

interface CaptchaModalProps {
  isOpen: boolean;
  redirectUri: string;
  sessionToken: string;
  mode: string;
  onSubmit: (token: string) => void;
  onCancel: () => void;
}

export const CaptchaModal: React.FC<CaptchaModalProps> = ({
  isOpen,
  redirectUri,
  sessionToken,
  mode,
  onSubmit,
  onCancel,
}) => {
  if (!isOpen) return null;

  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Автоматический перехват сообщений от капчи VK / Cloudflare Turnstile / SmartCaptcha
    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          if (event.data.includes('success_token=')) {
            const match = event.data.match(/success_token=([^&]+)/);
            if (match) onSubmit(match[1]);
          } else if (event.data.startsWith('vk_captcha_')) {
            onSubmit(event.data);
          }
        } else if (event.data && typeof event.data === 'object') {
          if (event.data.success_token) {
            onSubmit(event.data.success_token);
          } else if (event.data.token) {
            onSubmit(event.data.token);
          }
        }
      } catch (e) {
        console.error('Error parsing captcha message:', e);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSubmit]);

  const handleIframeLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        const href = iframe.contentWindow.location.href;
        if (href && href.includes('success_token=')) {
          const match = href.match(/success_token=([^&]+)/);
          if (match) {
            onSubmit(match[1]);
          }
        }
      }
    } catch {
      // Игнорируем кросс-доменный доступ к location
    }
  };

  const handleOpenBrowser = () => {
    if (redirectUri) {
      window.open(redirectUri, '_blank');
      setShowManual(true);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setManualToken(text.trim());
      }
    } catch (err) {
      console.error('Clipboard read failed:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      onSubmit(manualToken.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-800 border border-amber-500/50 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/60 bg-amber-500/10 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Подтверждение VK (Капча)</h3>
              <p className="text-xs text-amber-300">Поставьте галочку «Я не робот» прямо в окне ниже</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 flex-1 flex flex-col overflow-y-auto">
          {/* Встроенный фрейм с капчей */}
          {redirectUri && !showManual && (
            <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700 bg-white min-h-[320px] flex-1">
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={redirectUri}
                onLoad={handleIframeLoad}
                className="w-full h-full min-h-[320px] border-0"
                allow="clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}

          {/* Панель переключения или ручного ввода */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => setIframeKey((prev) => prev + 1)}
              className="flex items-center space-x-1.5 text-slate-400 hover:text-white transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Обновить форму</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              {showManual ? '← Вернуться к встроенной капче' : 'Открыть в браузере / ручной ввод →'}
            </button>
          </div>

          {showManual && (
            <div className="space-y-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Пройдите капчу во внешнем браузере:</span>
                <button
                  type="button"
                  onClick={handleOpenBrowser}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Открыть браузер</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Итоговый URL или токен:
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 transition"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Вставить из буфера</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="Вставьте ссылку https://... или токен..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!manualToken.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition"
                  >
                    Готово
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-700/60 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-700 transition"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
