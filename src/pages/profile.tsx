import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Building, LogOut, Mail, Shield, CreditCard, Settings, Key } from 'lucide-react';
import { Link } from 'wouter';
import { Separator } from '@/components/ui/separator';
import { PageTransition } from '@/components/PageTransition';

export default function ProfilePage() {
    const { user, signOut } = useAuth();
    const { organizations, activeOrgId, selectOrganization } = useOrganization();

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

    const activeOrg = organizations.find(org => org.id === activeOrgId);

    return (
        <PageTransition>
            <div className="px-4 sm:px-6 lg:px-8 xl:px-10 space-y-8 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Meu Perfil</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Gerencie suas informações pessoais e configurações da conta
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Coluna Esquerda - Cartão do Usuário */}
                    <div className="md:col-span-1 space-y-6">
                        <Card className="shadow-flat border-0 rounded-2xl overflow-hidden text-center">
                            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                            <div className="px-6 pb-6 -mt-12">
                                <Avatar className="w-24 h-24 mx-auto border-4 border-white dark:border-gray-900 shadow-lg">
                                    <AvatarImage src="" />
                                    <AvatarFallback className="text-2xl bg-gray-100 text-gray-600 font-bold">
                                        {getUserInitials()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="mt-4">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                        {user?.first_name} {user?.last_name}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                                </div>
                                <div className="mt-6">
                                    <Button variant="outline" className="w-full" onClick={signOut}>
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Sair da Conta
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        <Card className="shadow-flat border-0 rounded-2xl">
                            <CardHeader>
                                <CardTitle className="text-base">Detalhes da Conta</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-3 text-sm">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-300">{user?.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <Shield className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-300">
                                        {user?.role === 'owner' ? 'Administrador' : 'Membro'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-300">
                                        Membro desde {new Date(user?.created_at || '').toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Coluna Direita - Configurações e Organizações */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="shadow-flat border-0 rounded-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building className="w-5 h-5 text-indigo-500" />
                                    Organizações
                                </CardTitle>
                                <CardDescription>Gerencie seus espaços de trabalho</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {organizations.map((org) => (
                                        <div
                                            key={org.id}
                                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${activeOrgId === org.id
                                                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                                                : 'bg-white border-gray-100 hover:border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg ${activeOrgId === org.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                                                    <Building className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-gray-100">{org.name}</p>
                                                    <p className="text-xs text-gray-500">ID: {org.id}</p>
                                                </div>
                                            </div>
                                            {activeOrgId === org.id ? (
                                                <Badge className="bg-indigo-600">Ativa</Badge>
                                            ) : (
                                                <Button variant="ghost" size="sm" onClick={() => selectOrganization(org.id)}>
                                                    Alternar
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-flat border-0 rounded-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Key className="w-5 h-5 text-indigo-500" />
                                    Segurança
                                </CardTitle>
                                <CardDescription>Gerencie a segurança da sua conta</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/profile/change-password">
                                    <Button variant="outline" className="w-full justify-start">
                                        <Key className="w-4 h-4 mr-2" />
                                        Alterar Senha
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card className="shadow-flat border-0 rounded-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-purple-500" />
                                    Assinatura
                                </CardTitle>
                                <CardDescription>Detalhes do seu plano atual</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Plano Gratuito</h3>
                                            <p className="text-sm text-gray-500">Ideal para uso pessoal</p>
                                        </div>
                                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Ativo</Badge>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Organizações</span>
                                            <span className="font-medium">1 / 1</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                                            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                                        </div>
                                    </div>
                                    <Button className="w-full mt-6" variant="outline">
                                        Gerenciar Assinatura
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}

function Calendar(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
