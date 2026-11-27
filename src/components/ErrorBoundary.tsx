import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let displayMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          displayMsg = `Database permission or sync issue (${parsed.operationType} on ${parsed.path}): ${parsed.error}`;
        }
      } catch {
        // plain string message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-zinc-950 px-6">
          <div className="max-w-md w-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center">
            <p className="text-xs tracking-widest uppercase text-zinc-500 mb-3">
              KOVA ATELIER
            </p>
            <h1 className="font-display text-3xl text-zinc-900 dark:text-zinc-100 mb-3">
              Something went wrong
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 break-words">
              {displayMsg}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 text-sm font-medium bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
