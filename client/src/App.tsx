import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import SuperAdmin from "./pages/SuperAdmin";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/admin" component={Admin} />
    <Route path="/cozinha" component={Admin} />
    <Route path="/admin-login" component={AdminLogin} />
    <Route path="/super-admin" component={SuperAdmin} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
