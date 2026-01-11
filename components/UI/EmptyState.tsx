
import React from 'react';
import { Search } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: any;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title = "Geen resultaten", 
  message = "Er zijn geen items gevonden.", 
  icon: Icon = Search,
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
      <div className="p-4 bg-slate-900 rounded-full mb-4">
        <Icon size={32} className="text-slate-500 opacity-50" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
