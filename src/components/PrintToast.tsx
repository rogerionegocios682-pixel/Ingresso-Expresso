import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, CheckCircle2, X, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';

export interface PrintToastData {
  id: string;
  ticketLabel: string;
  eventName?: string;
  count: number;
  timestamp: string;
}

interface PrintToastProps {
  toast: PrintToastData | null;
  onClose: () => void;
  onReprint?: () => void;
  autoCloseDuration?: number; // in milliseconds, default 6000
}

export const PrintToast: React.FC<PrintToastProps> = ({
  toast,
  onClose,
  onReprint,
  autoCloseDuration = 6000
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const intervalTime = 50;
    const step = (intervalTime / autoCloseDuration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= step) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast, autoCloseDuration, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.94 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-5 right-5 z-[100] max-w-md w-full sm:w-[420px] bg-slate-900/95 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40 backdrop-blur-md no-print"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-3">
            {/* Animated Printer / Success Icon */}
            <div className="relative shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Printer className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 items-center justify-center text-[10px] text-slate-950 font-black">
                  ✓
                </span>
              </span>
            </div>

            {/* Content Details */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Impressão Acionada
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-500" />
                  <span className="text-[11px] font-mono text-slate-400">{toast.timestamp}</span>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Fechar notificação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm font-semibold text-slate-100 leading-tight">
                {toast.count > 1
                  ? `Comando enviado para ${toast.count} ingressos`
                  : `Ingresso ${toast.ticketLabel}`}
              </p>

              {toast.eventName && (
                <p className="text-xs text-slate-400 truncate">{toast.eventName}</p>
              )}

              <p className="text-[11px] text-emerald-300/90 leading-tight pt-0.5">
                O comando foi transmitido com sucesso ao spooler de impressão do navegador.
              </p>

              {/* Bottom Quick Actions */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80 mt-2">
                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Spooler ativo
                </span>

                {onReprint && (
                  <button
                    type="button"
                    onClick={onReprint}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Reimprimir</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Auto-Dismiss Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-b-2xl overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
