import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCache = () => {
    localStorage.removeItem('SIM_PKL_ACTIVE_SESSION');
    localStorage.removeItem('SIM_PKL_LAST_ACTIVITY');
    window.location.reload();
  };

  render() {
    const currentState = (this as any).state as State;
    if (currentState?.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Terjadi Kesalahan Aplikasi</h2>
              <p className="text-xs text-slate-500 mt-1">
                Aplikasi mengalami kendala saat memuat komponen tampilan.
              </p>
            </div>

            {currentState.error?.message && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                <p className="text-[11px] font-mono text-slate-600 break-words leading-relaxed">
                  {currentState.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Muat Ulang Halaman
              </button>
              <button
                onClick={this.handleResetCache}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all border border-slate-200 cursor-pointer"
              >
                Reset Sesi & Login Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
