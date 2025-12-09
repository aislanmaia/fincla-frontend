import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { createOrganization } from '@/api/organizations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PageTransition } from '@/components/PageTransition';

export default function CreateOrganizationPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { selectOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirecionar se não for owner
  if (user && user.role !== 'owner') {
    setLocation('/no-organization');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('O nome da organização é obrigatório');
      return;
    }

    setIsLoading(true);

    try {
      const response = await createOrganization({
        name: name.trim(),
        description: description.trim() || null,
      });

      // Invalidar cache de organizações
      await queryClient.invalidateQueries({ queryKey: ['my-organizations'] });

      // Selecionar a organização criada
      selectOrganization(response.organization.id);

      toast({
        title: 'Organização criada!',
        description: `${response.organization.name} foi criada com sucesso.`,
        duration: 3000,
      });

      // Redirecionar para o dashboard
      setLocation('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar organização');
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a organização. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <Card className="w-full max-w-lg shadow-xl border-0 rounded-2xl">
          <CardHeader className="space-y-4 pb-8">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#4A56E2] to-[#00C6B8] rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold">Crie sua Organização</CardTitle>
              <CardDescription className="text-base">
                Para começar a usar o Fincla, você precisa criar uma organização.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Organização *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: Minha Empresa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Adicione uma descrição para sua organização"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                  rows={4}
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-[#4A56E2] to-[#00C6B8] hover:opacity-90 transition-opacity"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Organização'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}




