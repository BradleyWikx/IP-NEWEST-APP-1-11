
import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, RotateCcw, X } from 'lucide-react';
import { undoManager } from '../../utils/undoManager';

interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'UNDO';
  message: string;
  undoId?: string;
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (e: any) => {
      const newToast: ToastMessage = {
        id: Math.random().toString(36),
        ...e.detail
      };
      setToasts(prev => [...prev, newToast]);

      // Auto-dismiss errors/success after 5s, Undo persists for 30s max (handled by logic, but UI remove here too)
      const duration = newToast.type === 'UNDO' ? 10000 : 5000;
      setTimeout(() => removeToast(newToast.id), duration);
    };

    window.addEventListener('grand-stage-toast', handleToast);
    return () => window.removeEventListener('grand-stage-toast', handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleUndo = (t: ToastMessage) => {
    if (t.undoId) {
      undoManager.performUndo(t.undoId);
      removeToast(t.id);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`
            min-w-[300px] p-4 rounded-xl border shadow-2xl flex items-center justify-between animate-in slide-in-from-right-10 fade-in duration-300
            ${t.type === 'ERROR' ? 'bg-red-950 border-red-800 text-red-100' : 
              t.type === 'UNDO' ? 'bg-slate-900 border-amber-600/50 text-white' : 
              'bg-emerald-950 border-emerald-800 text-emerald-100'}
          `}
        >
          <div className="flex items-center gap-3">
            {t.type === 'ERROR' && <AlertCircle size={20} className="text-red-500" />}
            {t.type === 'SUCCESS' && <CheckCircle2 size={20} className="text-emerald-500" />}
            {t.type === 'UNDO' && <CheckCircle2 size={20} className="text-amber-500" />}
            
            <p className="text-sm font-medium">{t.message}</p>
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-white/10 ml-4">
            {t.type === 'UNDO' && (
              <button 
                onClick={() => handleUndo(t)}
                className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-300 flex items-center"
              >
                <RotateCcw size={14} className="mr-1" /> Undo
              </button>
            )}
            <button onClick={() => removeToast(t.id)} className="text-white/50 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
