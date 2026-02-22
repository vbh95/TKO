import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md space-y-6">
            <AlertTriangle className="w-16 h-16 mx-auto text-destructive opacity-60" />
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">Something went wrong</h1>
              <p className="text-muted-foreground">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => window.location.reload()} data-testid="button-refresh-page">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
              <Button onClick={() => { window.location.href = "/"; }} data-testid="button-error-home">
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
