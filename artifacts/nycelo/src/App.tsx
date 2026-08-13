import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Layout } from '@/components/layout';
import Home from '@/pages/home';
import Rank from '@/pages/rank';
import Leaderboard from '@/pages/leaderboard';
import NeighborhoodDetail from '@/pages/neighborhood';
import Experience from '@/pages/experience';

const queryClient = new QueryClient();

// Simple NotFound component matching brutalist aesthetic
function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background p-6">
      <div className="brutal-card p-12 text-center max-w-md w-full border-4 border-primary">
        <div className="font-display font-black text-8xl text-primary mb-4">404</div>
        <h2 className="font-display font-black text-2xl uppercase mb-2">Dead End</h2>
        <p className="font-mono text-muted-foreground mb-8">
          You took a wrong turn. This page doesn't exist.
        </p>
        <a 
          href="/" 
          className="inline-block bg-primary text-primary-foreground font-display font-bold uppercase tracking-wide px-8 py-4 border-2 border-border shadow-brutal hover:shadow-brutal-sm hover:translate-y-[2px] hover:translate-x-[2px] transition-all"
        >
          Take me home
        </a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/rank" component={Rank} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/neighborhood/:id" component={NeighborhoodDetail} />
          <Route path="/experience" component={Experience} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
