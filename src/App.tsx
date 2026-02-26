import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { DashboardOrRedirect } from "@/components/DashboardOrRedirect";
import TransactionsPage from "@/pages/transactions";
import CreditCardsPage from '@/pages/credit-cards';
import InvoiceHistoryPage from '@/pages/credit-cards/history';
import FuturePlanningPage from '@/pages/credit-cards/planning';
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import AppLayout from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireOrganization } from "@/components/RequireOrganization";
import { RequireConsultant } from "@/components/RequireConsultant";

// Lazy load heavy pages
const ReportsPage = lazy(() => import("@/pages/reports"));
const GoalsPage = lazy(() => import("@/pages/goals"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const ChangePasswordPage = lazy(() => import("@/pages/profile/change-password"));
const CreateOrganizationPage = lazy(() => import("@/pages/onboarding/create-organization"));
const NoOrganizationPage = lazy(() => import("@/pages/no-organization"));
const ConsultantDashboard = lazy(() => import("@/pages/consultant"));
const ConsultantClientsPage = lazy(() => import("@/pages/consultant/clients"));
const ConsultantClientLayout = lazy(() => import("@/layouts/ConsultantClientLayout").then((m) => ({ default: m.ConsultantClientLayout })));

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
      <RequireOrganization>
        <RequireConsultant>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={DashboardOrRedirect} />
                <Route path="/consultant" component={ConsultantDashboard} />
                <Route path="/consultant/clients" component={ConsultantClientsPage} />
                <Route path="/consultant/clients/:organizationId" component={ConsultantClientLayout} />
                <Route path="/consultant/clients/:organizationId/transactions" component={TransactionsPage} />
                <Route path="/consultant/clients/:organizationId/credit-cards" component={CreditCardsPage} />
                <Route path="/consultant/clients/:organizationId/credit-cards/history" component={InvoiceHistoryPage} />
                <Route path="/consultant/clients/:organizationId/credit-cards/planning" component={FuturePlanningPage} />
                <Route path="/consultant/clients/:organizationId/reports" component={ReportsPage} />
                <Route path="/consultant/clients/:organizationId/goals" component={GoalsPage} />
                <Route path="/transactions" component={TransactionsPage} />
                <Route path="/credit-cards" component={CreditCardsPage} />
                <Route path="/credit-cards/history" component={InvoiceHistoryPage} />
                <Route path="/credit-cards/planning" component={FuturePlanningPage} />
                <Route path="/reports" component={ReportsPage} />
                <Route path="/goals" component={GoalsPage} />
                <Route path="/profile/change-password" component={ChangePasswordPage} />
                <Route path="/profile/me" component={ProfilePage} />
                <Route path="/profile/organizacoes" component={ProfilePage} />
                <Route path="/profile/seguranca" component={ProfilePage} />
                <Route path="/profile/whatsapp" component={ProfilePage} />
                <Route path="/profile/categorias" component={ProfilePage} />
                <Route path="/profile/assinatura" component={ProfilePage} />
                <Route path="/profile" component={ProfilePage} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </AppLayout>
        </RequireConsultant>
      </RequireOrganization>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Rotas de onboarding - protegidas mas sem AppLayout */}
      <Route path="/onboarding/create-organization">
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <CreateOrganizationPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      
      <Route path="/no-organization">
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <NoOrganizationPage />
          </Suspense>
        </ProtectedRoute>
      </Route>
      
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
