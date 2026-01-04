import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createCreditCard, updateCreditCard } from '@/api/creditCards';
import { CreditCard } from '@/types/api';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

const formSchema = z.object({
    description: z.string().min(1, 'Descrição é obrigatória'),
    brand: z.string().min(1, 'Bandeira é obrigatória'),
    last4: z.string().length(4, 'Deve ter exatamente 4 dígitos').regex(/^\d+$/, 'Apenas números'),
    due_day: z.coerce.number().min(1).max(31),
    credit_limit: z.coerce.number().min(0, 'Limite deve ser maior ou igual a zero').optional().nullable(),
    closing_day: z.coerce.number().min(1).max(31).optional().nullable(),
    color: z.union([
        z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal (#RRGGBB)'),
        z.literal(''),
        z.null()
    ]).optional().transform((val) => (val === '' || !val ? null : val)),
});

interface CardFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cardToEdit?: CreditCard | null;
    onSuccess: () => void;
}

export function CardFormDialog({
    open,
    onOpenChange,
    cardToEdit,
    onSuccess,
}: CardFormDialogProps) {
    const { activeOrganization } = useOrganization();
    const currentOrg = activeOrganization;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: '',
            brand: '',
            last4: '',
            due_day: 1,
            credit_limit: null,
            closing_day: null,
            color: null,
        },
    });

    useEffect(() => {
        if (cardToEdit) {
            form.reset({
                description: cardToEdit.description || '',
                brand: cardToEdit.brand,
                last4: cardToEdit.last4,
                due_day: cardToEdit.due_day,
                credit_limit: cardToEdit.credit_limit,
                closing_day: cardToEdit.closing_day,
                color: cardToEdit.color,
            });
        } else {
            form.reset({
                description: '',
                brand: '',
                last4: '',
                due_day: 1,
                credit_limit: null,
                closing_day: null,
                color: null,
            });
        }
    }, [cardToEdit, form, open]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!currentOrg?.id) return;

        try {
            // Converter null para undefined para compatibilidade com a API
            const apiData = {
                organization_id: currentOrg.id,
                description: values.description,
                brand: values.brand,
                last4: values.last4,
                due_day: values.due_day,
                credit_limit: values.credit_limit ?? undefined,
                closing_day: values.closing_day ?? undefined,
                color: values.color ?? undefined,
            };

            if (cardToEdit) {
                await updateCreditCard(cardToEdit.id, apiData);
                toast.success('Cartão atualizado com sucesso!');
            } else {
                await createCreditCard(apiData);
                toast.success('Cartão criado com sucesso!');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Erro ao salvar cartão:', error);
            toast.error('Erro ao salvar cartão. Verifique os dados.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{cardToEdit ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle>
                    <DialogDescription>
                        {cardToEdit ? 'Atualize as informações do cartão.' : 'Preencha os dados para adicionar um novo cartão.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Cartão</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ex: Nubank, Itaú Black" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="brand"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bandeira</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Visa">Visa</SelectItem>
                                                <SelectItem value="Mastercard">Mastercard</SelectItem>
                                                <SelectItem value="Amex">Amex</SelectItem>
                                                <SelectItem value="Elo">Elo</SelectItem>
                                                <SelectItem value="Hipercard">Hipercard</SelectItem>
                                                <SelectItem value="Outros">Outros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="last4"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Últimos 4 dígitos</FormLabel>
                                        <FormControl>
                                            <Input placeholder="1234" maxLength={4} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="due_day"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dia de Vencimento</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} max={31} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="closing_day"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Dia de Fechamento</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                max={31} 
                                                {...field}
                                                value={field.value ?? ''}
                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="credit_limit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Limite de Crédito (R$)</FormLabel>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            min={0} 
                                            step="0.01"
                                            placeholder="Ex: 5000.00"
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="color"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cor do Cartão (Opcional)</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="color"
                                                className="w-16 h-10 cursor-pointer"
                                                value={field.value || '#8B5CF6'}
                                                onChange={(e) => field.onChange(e.target.value || null)}
                                            />
                                            <Input 
                                                type="text"
                                                placeholder="#8B5CF6"
                                                maxLength={7}
                                                value={field.value || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value.trim();
                                                    if (val === '' || /^#[0-9A-Fa-f]{6}$/i.test(val)) {
                                                        field.onChange(val || null);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit">{cardToEdit ? 'Salvar Alterações' : 'Criar Cartão'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
