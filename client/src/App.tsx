import CustomerOrders from "./pages/CustomerOrders";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import CompanyIntegrations from "./pages/CompanyIntegrations";
import CompanySignUp from "./pages/CompanySignUp";
import Kitchen from "./pages/Kitchen";
import Landing from "./pages/Landing";
import SuperAdmin from "@/pages/SuperAdmin";
import CourierTracking from "@/pages/CourierTracking";
import CustomerOrderTracking from "@/pages/CustomerOrderTracking";

function Router() {
  return <Switch>
    <Route path="/" component={Landing} />
    <Route path="/cadastrar" component={CompanySignUp} />
    <Route path="/admin-login" component={AdminLogin} />
    <Route path="/super-admin" component={SuperAdmin} />
    <Route path="/:slug/admin/integracoes" component={CompanyIntegrations} />
    <Route path="/:slug/admin" component={Admin} />
    <Route path="/:slug/cozinha" component={Kitchen} />
    <Route path="/:slug/pedidos" component={CustomerOrders} />
    <Route path="/entregador/:token" component={CourierTracking} />
    <Route path="/rastrear/:slug/:token" component={CustomerOrderTracking} />
    <Route path="/404" component={NotFound} />
    <Route path="/:slug" component={Home} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
