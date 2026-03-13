import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Invoices from "./pages/Invoices";
import Estimates from "./pages/Estimates";
import Appointments from "./pages/Appointments";
import ServiceHistoryPage from "./pages/ServiceHistory";
import SettingsPage from "./pages/Settings";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import Bookings from "./pages/Bookings";
import PublicBooking from "@/pages/PublicBooking";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/book" component={PublicBooking} />
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/clients" component={Clients} />
            <Route path="/invoices" component={Invoices} />
            <Route path="/estimates" component={Estimates} />
            <Route path="/appointments" component={Appointments} />
            <Route path="/bookings" component={Bookings} />
            <Route path="/service-history" component={ServiceHistoryPage} />
            <Route path="/reports" component={Reports} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
