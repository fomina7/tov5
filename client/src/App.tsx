import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import GameTable from "./pages/GameTable";
import Lobby from "./pages/Lobby";
import Profile from "./pages/Profile";
import Tournaments from "./pages/Tournaments";
import Cashier from "./pages/Cashier";
import More from "./pages/More";
import Admin from "./pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lobby" component={Lobby} />
      <Route path="/game/:tableId" component={GameTable} />
      <Route path="/profile" component={Profile} />
      <Route path="/tournaments" component={Tournaments} />
      <Route path="/cashier" component={Cashier} />
      <Route path="/more" component={More} />
      <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
