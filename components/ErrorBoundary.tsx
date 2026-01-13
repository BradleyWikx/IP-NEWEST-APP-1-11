import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './UI';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-red-600 blur-2xl opacity-20 rounded-full animate-pulse"></div>
            <div className="relative p-6 bg-slate-900 border border-red-900/50 rounded-full">
              <AlertTriangle size={48} className="text-red-500" />
            </div>
          </div>
          
          <h1 className="text-4xl font-serif text-white mb-4">Er ging iets mis op het podium</h1>
          
          <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
            Onze excuses. Er is een onverwachte fout opgetreden in de applicatie. 
            Onze technici zijn op de hoogte gesteld.
          </p>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 mb-8 max-w-lg w-full text-left overflow-hidden">
            <p className="text-xs font-mono text-red-400 break-all">
              {this.state.error?.toString()}
            </p>
          </div>

          <Button onClick={this.handleReload} className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20">
            <RefreshCw size={18} className="mr-2" /> Herlaad Pagina
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
