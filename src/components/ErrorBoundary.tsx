import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

function logError(error: unknown, errorInfo: ErrorInfo) {
  console.error('Unhandled React render error:', error, errorInfo);
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    logError(error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/app/welcome';
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen max-w-mobile items-center justify-center bg-slate-50 px-6 py-12">
          <section className="w-full rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">
              Something went wrong
            </p>
            <h1 className="mt-3 text-[22px] font-black leading-[28px] text-slate-900">
              We could not load this screen.
            </h1>
            <p className="mt-3 text-[14px] leading-[20px] text-slate-600">
              Something unexpected happened. Reloading the app usually fixes this.
            </p>
            <button
              type="button"
              className="mt-6 h-11 w-full rounded-lg bg-primary px-4 text-sm font-bold text-white active:opacity-80"
              onClick={this.handleReload}
            >
              Reload app
            </button>
            <button
              type="button"
              className="mt-3 h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 active:opacity-70"
              onClick={this.handleGoHome}
            >
              Go home
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
