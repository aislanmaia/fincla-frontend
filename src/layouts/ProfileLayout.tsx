import * as React from 'react';
import { Link, useLocation } from 'wouter';
import { User, Building, Key, MessageCircle, Tags, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/PageTransition';
import { useOrganization } from '@/hooks/useOrganization';
import { PropsWithChildren } from 'react';

const MENU_ITEMS: Array<{
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ownerOnly?: boolean;
}> = [
  { path: '/profile/me', label: 'Meu Perfil', icon: User },
  { path: '/profile/organizacoes', label: 'Organizações', icon: Building },
  { path: '/profile/seguranca', label: 'Segurança', icon: Key },
  { path: '/profile/whatsapp', label: 'WhatsApp', icon: MessageCircle, ownerOnly: true },
  { path: '/profile/categorias', label: 'Categorias e Tags', icon: Tags },
  { path: '/profile/assinatura', label: 'Assinatura', icon: CreditCard },
];

export function ProfileLayout({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const { isOwner } = useOrganization();

  const activeItem = MENU_ITEMS.find(
    (item) => location === item.path || location.startsWith(item.path + '/')
  );
  const pageTitle = activeItem?.label ?? 'Configurações';

  return (
    <PageTransition>
      <div className="px-4 sm:px-6 lg:px-8 xl:px-10 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gerencie suas informações pessoais e configurações da conta
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Menu lateral */}
          <nav className="lg:w-56 shrink-0">
            <ul className="space-y-1">
              {MENU_ITEMS.filter((item) => !item.ownerOnly || isOwner).map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path || location.startsWith(item.path + '/');
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Conteúdo */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </PageTransition>
  );
}
