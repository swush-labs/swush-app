'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
    // Add error reporting service here in the future
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-cyan-900 to-slate-900 flex items-center justify-center">
          <div className="text-center space-y-4 p-8 bg-slate-800/90 rounded-xl border border-slate-700">
            <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
            <p className="text-slate-300">We encountered an unexpected error. Please try again.</p>
            <Button 
              onClick={() => this.setState({ hasError: false })}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
} 