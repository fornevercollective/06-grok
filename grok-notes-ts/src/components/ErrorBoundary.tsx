import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b', background: '#1a1a1a' }}>
          <h3>⚠️ System Error</h3>
          <p>Grok Notes encountered an issue.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', margin: '10px', background: '#4a9eff', color: 'white', border: 'none', borderRadius: '5px' }}>
            Reload
          </button>
          <details style={{ marginTop: '10px' }}>
            <summary>Error Details</summary>
            <pre style={{ textAlign: 'left', fontSize: '12px' }}>{this.state.error?.stack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;