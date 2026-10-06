import React from 'react';

interface Props {
  children: React.ReactNode;
  sectionName: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class DashboardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`DashboardErrorBoundary caught an error in ${this.props.sectionName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-bg-surface/30 rounded-xl border border-border/50">
          <div className="text-center">
            <h3 className="font-medium text-text-primary mb-1">{this.props.sectionName}</h3>
            <p className="text-sm text-text-tertiary mb-3">
              {this.state.error?.message || 'Something went wrong'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                if (this.props.onRetry) this.props.onRetry();
              }}
              className="text-xs px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;