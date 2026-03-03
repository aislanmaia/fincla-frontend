import { Link, useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LayoutGrid, ListOrdered, PieChart, Target, User, LogOut, Plus, CreditCard, Settings, Users } from "lucide-react";
import { PropsWithChildren, useState } from "react";
// import { useAIChat } from "@/hooks/useAIChat"; // TODO: Reativar no futuro quando a feature estiver pronta
// import { ChatBar } from "@/components/ChatBar"; // TODO: Reativar no futuro quando a feature estiver pronta
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useCanAccess } from "@/hooks/useCanAccess";
import { PermissionGate } from "@/components/PermissionGate";
import { ConsultantBreadcrumb } from "@/components/consultant/ConsultantBreadcrumb";
import { NewTransactionSheet } from "@/components/NewTransactionSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Mapeamento de rotas para títulos das páginas
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transações',
  '/credit-cards': 'Cartões',
  '/credit-cards/history': 'Histórico de Faturas',
  '/credit-cards/planning': 'Planejamento',
  '/reports': 'Relatórios',
  '/goals': 'Metas',
  '/profile': 'Configurações',
  '/profile/me': 'Configurações',
  '/profile/organizacoes': 'Configurações',
  '/profile/seguranca': 'Configurações',
  '/profile/whatsapp': 'Configurações',
  '/profile/categorias': 'Configurações',
  '/profile/assinatura': 'Configurações',
  '/profile/change-password': 'Alterar Senha',
  '/consultant': 'Dashboard',
  '/consultant/clients': 'Meus Clientes',
  '/consultant/reports': 'Relatórios',
  '/consultant/clients-goals': 'Metas dos Clientes',
};

function getPageTitle(location: string): string {
  if (ROUTE_TITLES[location]) return ROUTE_TITLES[location];
  if (/^\/consultant\/clients\/[^/]+$/.test(location)) return 'Dashboard';
  if (/^\/consultant\/clients\/[^/]+\/transactions/.test(location)) return 'Transações';
  if (/^\/consultant\/clients\/[^/]+\/credit-cards/.test(location)) return 'Cartões';
  if (/^\/consultant\/clients\/[^/]+\/reports/.test(location)) return 'Relatórios';
  if (/^\/consultant\/clients\/[^/]+\/goals/.test(location)) return 'Metas';
  return 'Dashboard';
}

export function AppLayout({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  // const { messages, isProcessing, processUserMessage } = useAIChat(); // TODO: Reativar no futuro quando a feature estiver pronta
  const { user, signOut } = useAuth();
  const { organizations, activeOrgId, selectOrganization } = useOrganization();
  const [location, setLocation] = useLocation();
  const [isDashboard] = useRoute("/");
  const [isConsultantDashboard] = useRoute("/consultant");
  const [isConsultantClients] = useRoute("/consultant/clients");
  const [isConsultantReports] = useRoute("/consultant/reports");
  const [isConsultantGoals] = useRoute("/consultant/clients-goals");
  const clientRouteMatch = /^\/consultant\/clients\/([^/]+)/.exec(location);
  const linkBase = clientRouteMatch ? clientRouteMatch[0] : "";
  const isInConsultantClientView = !!linkBase;
  const [isTransactions] = useRoute("/transactions");
  const [isTransactionsClient] = useRoute("/consultant/clients/:organizationId/transactions");
  const [isCreditCards] = useRoute("/credit-cards");
  const [isCreditCardsClient] = useRoute("/consultant/clients/:organizationId/credit-cards");
  const [isReports] = useRoute("/reports");
  const [isReportsClient] = useRoute("/consultant/clients/:organizationId/reports");
  const [isGoals] = useRoute("/goals");
  const [isGoalsClient] = useRoute("/consultant/clients/:organizationId/goals");
  const isProfile = location.startsWith("/profile");
  const consultantUser = useCanAccess('consultant');
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const { toast } = useToast();
  const pageTitle = getPageTitle(location);

  const handleLogout = () => {
    signOut();
    setLocation("/login");
  };

  const handleOrgChange = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    selectOrganization(orgId);

    if (org) {
      toast({
        title: "Organização alterada",
        description: `Agora visualizando: ${org.name}`,
        duration: 2000,
      });
    }
  };

  const getUserDisplayName = () => {
    if (user?.first_name || user?.last_name) {
      // Usar first_name e last_name se disponíveis
      const parts = [user.first_name, user.last_name].filter(Boolean);
      return parts.join(' ').trim();
    }
    // Fallback: extrair o nome do email (parte antes do @)
    if (user?.email) {
      const emailName = user.email.split("@")[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return "Usuário";
  };

  const getUserInitials = () => {
    if (user?.first_name || user?.last_name) {
      // Usar primeira letra do first_name e last_name
      const first = user.first_name?.charAt(0).toUpperCase() || '';
      const last = user.last_name?.charAt(0).toUpperCase() || '';
      return (first + last).trim() || 'US';
    }
    // Fallback: usar primeiras letras do email
    if (user?.email) {
      const emailName = user.email.split("@")[0];
      return emailName.substring(0, 2).toUpperCase();
    }
    return "US";
  };

  return (
    <SidebarProvider>
      <Sidebar className="gradient-sidebar text-white shadow-2xl !rounded-r-2xl border-none">
        <div className="flex h-full flex-col">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="bg-white/20 p-1.5 rounded-xl ring-1 ring-white/25 shrink-0">
                <img src="/logo.png" alt="Fincla" className="w-6 h-6 object-contain" />
              </div>
              <div className="font-semibold tracking-tight">Fincla</div>
            </div>
          </SidebarHeader>
          <SidebarSeparator className="bg-white/20" />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-white/80">Navegação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Área do Consultor - apenas para consultores */}
                  {consultantUser ? (
                    <>
                      <SidebarMenuItem>
                        <Link href="/consultant">
                          <SidebarMenuButton asChild isActive={!!isConsultantDashboard} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <LayoutGrid />
                              <span>Dashboard</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/consultant/clients">
                          <SidebarMenuButton asChild isActive={!!isConsultantClients && !clientRouteMatch} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <Users />
                              <span>Meus Clientes</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/consultant/reports">
                          <SidebarMenuButton asChild isActive={!!isConsultantReports} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <PieChart />
                              <span>Relatórios</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/consultant/clients-goals">
                          <SidebarMenuButton asChild isActive={!!isConsultantGoals} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <Target />
                              <span>Metas</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      {isInConsultantClientView && (
                        <>
                          <SidebarSeparator className="bg-white/20 my-2" />
                          <SidebarGroupLabel className="text-white/60 text-xs px-2">Cliente</SidebarGroupLabel>
                          <SidebarMenuItem>
                            <Link href={linkBase}>
                              <SidebarMenuButton asChild isActive={!location.split("/").slice(4).filter(Boolean).length} className="hover:bg-white/10 data-[active=true]:bg-white">
                                <a className="text-white data-[active=true]:!text-[#111827]">
                                  <LayoutGrid />
                                  <span>Dashboard</span>
                                </a>
                              </SidebarMenuButton>
                            </Link>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <Link href={`${linkBase}/transactions`}>
                              <SidebarMenuButton asChild isActive={!!isTransactionsClient} className="hover:bg-white/10 data-[active=true]:bg-white">
                                <a className="text-white data-[active=true]:!text-[#111827]">
                                  <ListOrdered />
                                  <span>Transações</span>
                                </a>
                              </SidebarMenuButton>
                            </Link>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <Link href={`${linkBase}/credit-cards`}>
                              <SidebarMenuButton asChild isActive={!!isCreditCardsClient} className="hover:bg-white/10 data-[active=true]:bg-white">
                                <a className="text-white data-[active=true]:!text-[#111827]">
                                  <CreditCard />
                                  <span>Cartões</span>
                                </a>
                              </SidebarMenuButton>
                            </Link>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <Link href={`${linkBase}/reports`}>
                              <SidebarMenuButton asChild isActive={!!isReportsClient} className="hover:bg-white/10 data-[active=true]:bg-white">
                                <a className="text-white data-[active=true]:!text-[#111827]">
                                  <PieChart />
                                  <span>Relatórios</span>
                                </a>
                              </SidebarMenuButton>
                            </Link>
                          </SidebarMenuItem>
                          <SidebarMenuItem>
                            <Link href={`${linkBase}/goals`}>
                              <SidebarMenuButton asChild isActive={!!isGoalsClient} className="hover:bg-white/10 data-[active=true]:bg-white">
                                <a className="text-white data-[active=true]:!text-[#111827]">
                                  <Target />
                                  <span>Metas</span>
                                </a>
                              </SidebarMenuButton>
                            </Link>
                          </SidebarMenuItem>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Dashboard padrão - para usuários não-consultores */}
                      <SidebarMenuItem>
                        <Link href="/">
                          <SidebarMenuButton asChild isActive={!!isDashboard} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <LayoutGrid />
                              <span>Dashboard</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/transactions">
                          <SidebarMenuButton asChild isActive={!!isTransactions} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <ListOrdered />
                              <span>Transações</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/credit-cards">
                          <SidebarMenuButton asChild isActive={!!isCreditCards} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <CreditCard />
                              <span>Cartões</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/reports">
                          <SidebarMenuButton asChild isActive={!!isReports} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <PieChart />
                              <span>Relatórios</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/goals">
                          <SidebarMenuButton asChild isActive={!!isGoals} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <Target />
                              <span>Metas</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/profile/me">
                          <SidebarMenuButton asChild isActive={!!isProfile} className="hover:bg-white/10 data-[active=true]:bg-white">
                            <a className="text-white data-[active=true]:!text-[#111827]">
                              <User />
                              <span>Perfil</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Link href="/profile/me">
              <Button 
                variant="outline" 
                className="w-full justify-start bg-white/10 hover:bg-white/15 hover:text-white text-white border-white/20"
                asChild
              >
                <a>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações
                </a>
              </Button>
            </Link>
          </SidebarFooter>
        </div>
      </Sidebar>

      <SidebarInset className="bg-transparent">
        {/* Top Bar fora do fluxo do conteúdo (sempre no topo) */}
        <div className="sticky top-0 z-30">
          <header className="supports-[backdrop-filter]:bg-white/40 backdrop-blur border-b border-gray-200/60 dark:supports-[backdrop-filter]:bg-white/[0.03] dark:border-white/10 bg-transparent">
            <div className="h-16 px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 flex items-center gap-2 sm:gap-3 justify-between mx-auto max-w-7xl xl:max-w-[90rem] 2xl:max-w-[96rem] min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0 flex-1 sm:flex-none">
                <SidebarTrigger className="shrink-0 self-start sm:self-center" />
                <div className="min-w-0 flex-1">
                  {consultantUser && location.startsWith("/consultant") ? (
                    <ConsultantBreadcrumb />
                  ) : (
                    <div className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight truncate">{pageTitle}</div>
                  )}
                </div>
                <Button
                  onClick={() => setIsNewTransactionOpen(true)}
                  className="h-8 sm:h-9 px-2 sm:px-4 rounded-full shadow-sm bg-gradient-to-r from-[#4A56E2] to-[#00C6B8] hover:from-[#343D9B] hover:to-[#00A89C] text-white font-medium flex items-center gap-1 sm:gap-2 transition-all duration-200 hover:scale-105 active:scale-95 shrink-0"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="text-xs sm:text-sm hidden sm:inline">Nova transação</span>
                </Button>
              </div>
              <div className="hidden md:flex flex-1 max-w-xl lg:max-w-2xl xl:max-w-3xl" />
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {consultantUser && location === '/consultant' ? (
                  <span className="text-sm text-muted-foreground font-medium px-3 py-1.5 rounded-full bg-muted/60">
                    Visão consolidada
                  </span>
                ) : organizations.length > 1 ? (
                  <Select value={activeOrgId || undefined} onValueChange={handleOrgChange}>
                    <SelectTrigger className="w-[140px] md:w-[180px] h-8 sm:h-9 rounded-full bg-white/70 ring-1 ring-gray-200 text-xs sm:text-sm">
                      <SelectValue placeholder="Selecionar organização" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                {/* Menu de contexto do usuário */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-3 py-1.5 bg-gray-100/70 ring-1 ring-gray-200 hover:bg-gray-100 transition-colors shrink-0 min-w-0">
                      <Avatar className="h-6 w-6 sm:h-7 sm:w-7 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-[#4A56E2] to-[#00C6B8] text-white text-xs font-semibold">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs sm:text-sm font-medium hidden sm:inline truncate max-w-[120px] md:max-w-none">{getUserDisplayName()}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                        {user?.email && (
                          <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/profile/me")} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Perfil</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
        </div>

        {/* Conteúdo com padding-top para não ficar sob o top bar (sem fundo) */}
        <div className="relative pt-4 bg-transparent">
          {children}

          {/* Sheet de Nova Transação */}
          <NewTransactionSheet
            open={isNewTransactionOpen}
            onOpenChange={setIsNewTransactionOpen}
            onInvalidateCache={() => {
              // Invalidar queries imediatamente após sucesso para atualizar dados
              queryClient.invalidateQueries({ queryKey: ['transactions'] });
              queryClient.invalidateQueries({ queryKey: ['financial-data'] });
            }}
            onSuccess={() => {
              // Chamado quando o usuário fechar o painel após ver a mensagem de sucesso
            }}
          />

          {/* Chat estilo AI Studio fixo ao rodapé do conteúdo */}
          {/* TODO: Reativar no futuro quando a feature estiver pronta */}
          {/* <ChatBar
            onSend={(m) => processUserMessage(m)}
            isProcessing={isProcessing}
            suggestions={["Registrar despesa", "Relatório mensal", "Comparar meses"]}
            messages={messages}
          /> */}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppLayout;

