import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import Dashboard from "@/pages/dashboard";
import TransactionsPage from "@/pages/transactions";
import CreditCardsPage from '@/pages/credit-cards';
import InvoiceHistoryPage from '@/pages/credit-cards/history';
import FuturePlanningPage from '@/pages/credit-cards/planning';
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import AppLayout from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Lazy load heavy pages
const ReportsPage = lazy(() => import("@/pages/reports"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const ProfilePage = lazy(() => import("@/pages/profile"));

// Loading fallback component with animation
function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center min-h-[60vh]"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#00C6B8]/30 border-t-[#00A89C] rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    </motion.div>
  );
}

function ProtectedRoutes() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/transactions" component={TransactionsPage} />
            <Route path="/credit-cards" component={CreditCardsPage} />
            <Route path="/credit-cards/history" component={InvoiceHistoryPage} />
            <Route path="/credit-cards/planning" component={FuturePlanningPage} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/goals" component={GoalsPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AppLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
