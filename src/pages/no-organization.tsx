import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, LogOut, Mail } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

export default function NoOrganizationPage() {
  const [, setLocation] = useLocation();
  const { signOut, user } = useAuth();

  const handleLogout = () => {
    signOut();
    setLocation('/login');
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card className="w-full max-w-lg shadow-xl border-0 rounded-2xl text-center">
          <CardHeader className="space-y-6 pb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-2xl flex items-center justify-center">
              <Building2 className="w-10 h-10 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="space-y-3">
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Você não pertence a nenhuma organização
              </CardTitle>
              <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                Para acessar o Fincla, você precisa ser adicionado a uma organização por um administrador.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
              <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
                <Mail className="w-5 h-5" />
                <span className="font-medium">O que fazer?</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Entre em contato com o administrador da sua organização e solicite que você seja adicionado como membro.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Conta atual: <span className="font-medium text-gray-700 dark:text-gray-300">{user?.email}</span>
              </div>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full h-12"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair e trocar de conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}




