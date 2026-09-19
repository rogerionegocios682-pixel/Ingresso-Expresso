import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, X, CheckCircle2, Ticket } from 'lucide-react';
import { onTicketSold, SaleNotificationEvent } from '../services/storage';
import { formatCurrency } from '../services/whatsapp';

interface ToastItem extends SaleNotificationEvent {
  id: string;
  timeStr: string;
}

export const SaleToastNotification: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  useEffect(() => {
    const unsubscribe = onTicketSold((event) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const timeStr = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const newToast: ToastItem = {
        ...event,
        id,
        timeStr
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 4));
      playChime();

      // Auto dismiss after 5.5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5500);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notificações em tempo real"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto bg-slate-900/95 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40 backdrop-blur-md flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <ShoppingBag className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Nova Venda no PDV
                </span>
                <span className="text-[10px] font-mono text-slate-400">{toast.timeStr}</span>
              </div>

              <div className="text-sm font-black text-white truncate">
                {toast.customerName}
              </div>

              <p className="text-xs text-slate-300 truncate">
                {toast.eventName}
              </p>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Ticket className="w-3.5 h-3.5 text-indigo-400" />
                  {toast.ticketCount} {toast.ticketCount === 1 ? 'ingresso' : 'ingressos'}
                </span>
                <span className="font-extrabold text-emerald-400">
                  {formatCurrency(toast.totalAmount)}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0"
              title="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
};
