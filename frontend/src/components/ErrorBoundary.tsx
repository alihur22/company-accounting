import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
            <h3 className="font-medium text-red-800">Something went wrong</h3>
            <p className="mt-2 text-sm text-red-700">{this.state.error.message}</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
