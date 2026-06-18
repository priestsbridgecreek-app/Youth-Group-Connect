import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Activities from "@/pages/activities";
import Schedule from "@/pages/schedule";
import Lessons from "@/pages/lessons";
import Sacrament from "@/pages/sacrament";
import Requests from "@/pages/requests";
import Members from "@/pages/members";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function PrivateRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      <Layout>
        <Component />
      </Layout>
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <PrivateRoute path="/dashboard" component={Dashboard} />
      <PrivateRoute path="/activities" component={Activities} />
      <PrivateRoute path="/schedule" component={Schedule} />
      <PrivateRoute path="/lessons" component={Lessons} />
      <PrivateRoute path="/sacrament" component={Sacrament} />
      <PrivateRoute path="/requests" component={Requests} />
      <PrivateRoute path="/members" component={Members} />
      <PrivateRoute path="/settings" component={Settings} />
      <Route path="/" component={() => {
        window.location.href = "/dashboard";
        return null;
      }} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
