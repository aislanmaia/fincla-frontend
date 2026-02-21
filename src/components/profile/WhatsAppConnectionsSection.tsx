import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  linkWhatsAppPhone,
  listWhatsAppConnections,
  unlinkWhatsAppPhone,
} from '@/api/whatsappConnections';
import { handleApiError } from '@/api/client';
import { WhatsAppConnection } from '@/types/api';
import { toast } from 'sonner';

/**
 * Formata número para E.164 (ex: +5511999999999).
 * Aceita entradas como: 11999999999, (11) 99999-9999, +55 11 99999-9999
 */
function formatToE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return value;
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }
  return value.startsWith('+') ? value : `+${value}`;
}

function isValidE164(phone: string): boolean {
  const e164 = formatToE164(phone);
  // Brasil: +55 + DDD (2) + número (8 ou 9 dígitos) = 12 ou 13 caracteres após +
  return /^\+55\d{10,11}$/.test(e164) || /^\+\d{10,15}$/.test(e164);
}

interface WhatsAppConnectionsSectionProps {
  organizationId: string;
}

export function WhatsAppConnectionsSection({ organizationId }: WhatsAppConnectionsSectionProps) {
  const queryClient = useQueryClient();
  const [phoneInput, setPhoneInput] = useState('');
  const [connectionToRemove, setConnectionToRemove] = useState<WhatsAppConnection | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => setFeedbackMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['whatsapp-connections', organizationId],
    queryFn: () => listWhatsAppConnections(organizationId),
    enabled: !!organizationId,
  });

  const linkMutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      linkWhatsAppPhone({ organization_id: organizationId, phone_number: phoneNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', organizationId] });
      setPhoneInput('');
      setFeedbackMessage('Número conectado com sucesso!');
      toast.success('Número conectado com sucesso!');
    },
    onError: (err) => {
      toast.error(handleApiError(err));
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (connectionId: string) => unlinkWhatsAppPhone(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', organizationId] });
      setConnectionToRemove(null);
      setFeedbackMessage('Número desvinculado com sucesso.');
      toast.success('Número desvinculado com sucesso.');
    },
    onError: (err) => {
      toast.error(handleApiError(err));
    },
  });

  const handleAddPhone = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phoneInput.trim();
    if (!trimmed) {
      toast.error('Informe o número de telefone.');
      return;
    }
    const formatted = formatToE164(trimmed);
    if (!isValidE164(trimmed)) {
      toast.error('Use o formato E.164 (ex: +5511999999999 ou 11999999999).');
      return;
    }
    linkMutation.mutate(formatted);
  };

  const handleRemoveClick = (connection: WhatsAppConnection) => {
    setConnectionToRemove(connection);
  };

  const handleConfirmRemove = () => {
    if (connectionToRemove) {
      unlinkMutation.mutate(connectionToRemove.id);
    }
  };

  const connections = data?.connections ?? [];

  return (
    <>
      <Card className="shadow-flat border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte números de WhatsApp para registrar transações e realizar tarefas pelo assistente financeiro, sem sair do app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {feedbackMessage && (
            <div
              role="status"
              className="flex items-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 animate-in fade-in-0 slide-in-from-top-2 duration-300"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
              <span className="text-sm font-medium">{feedbackMessage}</span>
            </div>
          )}

          {/* Formulário para adicionar número */}
          <form onSubmit={handleAddPhone} className="space-y-2">
            <Label htmlFor="whatsapp-phone">Novo número</Label>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-3">
              <Input
                id="whatsapp-phone"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                disabled={linkMutation.isPending}
                className="font-mono flex-1 h-10"
              />
              <Button
                type="submit"
                disabled={linkMutation.isPending}
                className="w-full sm:w-auto h-10 shrink-0"
              >
                {linkMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Conectar
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato E.164: +5511999999999
            </p>
          </form>

          {/* Lista de números conectados */}
          <div className="space-y-3">
            <Label>Números conectados</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-4">
                Erro ao carregar conexões. Tente novamente.
              </p>
            ) : connections.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 border border-dashed rounded-lg text-center">
                Nenhum número conectado. Adicione um número acima.
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.map((conn) => (
                  <li
                    key={conn.id}
                    className="flex items-center justify-between p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium font-mono">{conn.phone_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Conectado em {new Date(conn.connected_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveClick(conn)}
                      disabled={unlinkMutation.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Desvincular número"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação para remover */}
      <AlertDialog open={!!connectionToRemove} onOpenChange={() => setConnectionToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular número?</AlertDialogTitle>
            <AlertDialogDescription>
              O número {connectionToRemove?.phone_number} será desvinculado da organização. O assistente não poderá mais receber mensagens neste número.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Desvincular'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
