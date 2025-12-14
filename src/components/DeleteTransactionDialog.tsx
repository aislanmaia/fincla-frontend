import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Transaction } from '@/types/api';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onConfirm: () => Promise<void>;
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
}: DeleteTransactionDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredText = 'EXCLUIR';
  const isConfirmValid = confirmText === requiredText;

  // Resetar estado quando o diálogo abrir/fechar
  useEffect(() => {
    if (!open) {
      setConfirmText('');
      setError(null);
      setIsDeleting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!isConfirmValid) return;

    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir transação');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isConfirmValid && !isDeleting) {
      handleConfirm();
    }
  };

  if (!transaction) return null;

  const isExpense = transaction.type === 'expense';
  const formattedValue = transaction.value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Exclusão
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. Digite <strong>{requiredText}</strong> para confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo da Transação */}
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Tipo:</span>
              <p className="font-medium">
                {isExpense ? 'Despesa' : 'Receita'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Valor:</span>
              <p className={cn(
                "font-semibold tabular-nums",
                isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}>
                {isExpense ? '-' : '+'}R$ {formattedValue}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Descrição:</span>
              <p className="font-medium">{transaction.description}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Categoria:</span>
              <p className="font-medium">{transaction.category}</p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Digite <strong>{requiredText}</strong> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder={requiredText}
              disabled={isDeleting}
              className="font-mono uppercase"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
          >
            {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

