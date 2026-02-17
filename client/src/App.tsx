import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth";
import NotFound from "@/pages/not-found";
import CreateTournament from "@/pages/create-tournament";
import TournamentDetail from "@/pages/tournament-detail";
import Account from "@/pages/account";
import LeaguesPage from "@/pages/leagues";
import PublicView from "@/pages/public-view";
import BoardView from "@/pages/board-view";
import ScorerPage from "@/pages/scorer";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/scorer/:tournamentId/:boardNumber" component={ScorerPage} />
      <Route path="/public/t/:shareToken/board/:boardNumber" component={BoardView} />
      <Route path="/public/t/:shareToken" component={PublicView} />
      
      {/* Auth Routes */}
      <Route path="/login" component={AuthPage} />
      <Route path="/signup" component={AuthPage} />

      {/* Protected Routes */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/tournaments" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/create" component={() => <ProtectedRoute component={CreateTournament} />} />
      <Route path="/tournaments/:id" component={() => <ProtectedRoute component={TournamentDetail} />} />
      <Route path="/leagues" component={() => <ProtectedRoute component={LeaguesPage} />} />
      <Route path="/account" component={() => <ProtectedRoute component={Account} />} />

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
