import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Shield, LogOut } from 'lucide-react';

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

export default function ProfileMeSection() {
  const { user, signOut } = useAuth();

  const getUserInitials = () => {
    if (user?.first_name || user?.last_name) {
      const first = user.first_name?.charAt(0).toUpperCase() || '';
      const last = user.last_name?.charAt(0).toUpperCase() || '';
      return (first + last).trim() || 'US';
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'US';
  };

  return (
    <Card className="shadow-flat border-0 rounded-2xl overflow-hidden">
      <div className="h-12 bg-gradient-to-r from-indigo-500 to-purple-600" />
      <div className="px-6 py-6 bg-white dark:bg-gray-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
          <Avatar className="w-20 h-20 shrink-0 border-4 border-white dark:border-gray-900 shadow-lg">
            <AvatarImage src="" />
            <AvatarFallback className="text-2xl bg-gray-100 text-gray-700 font-bold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="mt-4 sm:mt-0 flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{user?.email}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <Shield className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                {user?.role === 'owner' ? 'Administrador' : 'Membro'}
              </span>
              <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <CalendarIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                Membro desde {new Date(user?.created_at || '').toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <Button variant="outline" className="w-full sm:w-auto" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </Card>
  );
}
