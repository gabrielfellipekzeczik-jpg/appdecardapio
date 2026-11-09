import CustomerOrders from "./pages/CustomerOrders";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useParams } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import CompanySignUp from "./pages/CompanySignUp";
import Kitchen from "./pages/Kitchen";
import Landing from "./pages/Landing";
import SuperAdmin from "@/pages/SuperAdmin";
import CourierTracking from "@/pages/CourierTracking";
import CustomerOrderTracking from "@/pages/CustomerOrderTracking";

/** Integrações agora ficam dentro de Configurações no painel. */
function IntegrationsRedirect() {
  const { slug = "" } = useParams<{ slug: string }>();
  const query = window.location.search ? window.location.search.slice(1) : "config=1";
  return <Redirect to={`/${slug}/admin?${query}`} replace />;
}

function Router() {
  return <Switch>
    <Route path="/" component={Landing} />
    <Route path="/cadastrar" component={CompanySignUp} />
    <Route path="/admin-login" component={AdminLogin} />
    <Route path="/super-admin" component={SuperAdmin} />
    <Route path="/:slug/admin/integracoes" component={IntegrationsRedirect} />
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
