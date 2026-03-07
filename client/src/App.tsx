import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth";
import NotFound from "@/pages/not-found";
import CreateTournament from "@/pages/create-tournament";
import TournamentDetail from "@/pages/tournament-detail";
import Account from "@/pages/account";
import LeaguesPage from "@/pages/leagues";
import LeagueDetail from "@/pages/league-detail";
import PublicView from "@/pages/public-view";
import BoardView from "@/pages/board-view";
import ScorerPage from "@/pages/scorer";
import CompleteProfile from "@/pages/complete-profile";
import PublicLeague from "@/pages/public-league";
import AdminDashboard from "@/pages/admin-dashboard";
import OverlayPage from "@/pages/overlay";

function isProfileComplete(user: any): boolean {
  return !!user.dateOfBirth && !!user.hasMemorableWord;
}

function ProtectedRoute({ component: Component, skipProfileCheck }: { component: React.ComponentType; skipProfileCheck?: boolean }) {
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

  if (!skipProfileCheck && !isProfileComplete(user)) {
    return <CompleteProfile />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/overlay/:matchId" component={OverlayPage} />
      <Route path="/scorer/:tournamentId/:boardNumber" component={ScorerPage} />
      <Route path="/scorer" component={ScorerPage} />
      <Route path="/public/t/:shareToken/board/:boardNumber" component={BoardView} />
      <Route path="/public/t/:shareToken" component={PublicView} />
      <Route path="/public/league/:shareToken" component={PublicLeague} />
      
      {/* Auth Routes */}
      <Route path="/login" component={AuthPage} />
      <Route path="/signup" component={AuthPage} />

      {/* Protected Routes */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/tournaments" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/create" component={() => <ProtectedRoute component={CreateTournament} />} />
      <Route path="/tournaments/:id" component={() => <ProtectedRoute component={TournamentDetail} />} />
      <Route path="/leagues" component={() => <ProtectedRoute component={LeaguesPage} />} />
      <Route path="/leagues/:id" component={() => <ProtectedRoute component={LeagueDetail} />} />
      <Route path="/account" component={() => <ProtectedRoute component={Account} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} />} />

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
