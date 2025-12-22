'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // You can also log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI or use provided fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="bg-stone-100 dark:bg-neutral-700 min-h-screen flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-neutral-100">
              部分组件加载失败
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              页面遇到了一个错误，但其他部分仍然可以正常使用。请刷新页面重试。
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black rounded-lg hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors"
            >
              刷新页面
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                  错误详情（开发模式）
                </summary>
                <pre className="text-xs bg-neutral-200 dark:bg-neutral-800 p-4 rounded overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

