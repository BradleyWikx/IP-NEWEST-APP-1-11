
import React from 'react';
import { AlertCircle, XCircle } from 'lucide-react';

interface ErrorBannerProps {
  message?: string | null;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, title = 'Er is een fout opgetreden', onDismiss, className = '' }) => {
  if (!message) return null;

  return (
    <div className={`p-4 bg-red-900/20 border border-red-900/50 rounded-xl flex items-start animate-in slide-in-from-top-2 ${className}`}>
      <AlertCircle size={20} className="text-red-500 mt-0.5 shrink-0 mr-3" />
      <div className="flex-grow">
        <h4 className="text-sm font-bold text-red-400">{title}</h4>
        <p className="text-xs text-red-300 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-200">
          <XCircle size={18} />
        </button>
      )}
    </div>
  );
};
