import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/hooks/useOrganization';
import {
  listTagTypes,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  createTagType,
  updateTagType,
  deleteTagType,
} from '@/api/tags';
import { handleApiError } from '@/api/client';
import { Tag, TagType } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tags, Plus, Pencil, Trash2, Loader2, Search, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

function TagTypeFormDialog({
  open,
  onOpenChange,
  tagTypeToEdit,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagTypeToEdit: TagType | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [maxPerTransaction, setMaxPerTransaction] = useState<string>('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (tagTypeToEdit) {
        setName(tagTypeToEdit.name);
        setDescription(tagTypeToEdit.description || '');
        setIsRequired(tagTypeToEdit.is_required);
        setMaxPerTransaction(
          tagTypeToEdit.max_per_transaction != null ? String(tagTypeToEdit.max_per_transaction) : ''
        );
      } else {
        setName('');
        setDescription('');
        setIsRequired(false);
        setMaxPerTransaction('');
      }
    }
  }, [open, tagTypeToEdit]);

  const createMutation = useMutation({
    mutationFn: () =>
      createTagType({
        name: name.trim().toLowerCase().replace(/\s+/g, '_'),
        description: description.trim() || undefined,
        is_required: isRequired,
        max_per_transaction: maxPerTransaction ? parseInt(maxPerTransaction, 10) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      onSuccess();
      onOpenChange(false);
      toast.success('Tipo de tag criado!');
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTagType(tagTypeToEdit!.id, {
        name: name.trim().toLowerCase().replace(/\s+/g, '_'),
        description: description.trim() || null,
        is_required: isRequired,
        max_per_transaction: maxPerTransaction ? parseInt(maxPerTransaction, 10) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      onSuccess();
      onOpenChange(false);
      toast.success('Tipo de tag atualizado!');
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome do tipo.');
      return;
    }
    if (tagTypeToEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tagTypeToEdit ? 'Editar tipo de tag' : 'Novo tipo de tag'}</DialogTitle>
          <DialogDescription>
            {tagTypeToEdit
              ? 'Altere as configurações do tipo de tag.'
              : 'Crie um novo tipo para organizar suas tags (ex: categoria, projeto, cliente).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-type-name">Nome</Label>
            <Input
              id="tag-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: categoria, projeto"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Use letras minúsculas e underscores (ex: detalhe_transacao).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-type-desc">Descrição (opcional)</Label>
            <Input
              id="tag-type-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Categoria principal da transação"
              disabled={isPending}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="tag-type-required">Obrigatório</Label>
              <p className="text-xs text-muted-foreground">
                Exige pelo menos uma tag deste tipo em cada transação
              </p>
            </div>
            <Switch
              id="tag-type-required"
              checked={isRequired}
              onCheckedChange={setIsRequired}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-type-max">Máx. por transação (opcional)</Label>
            <Input
              id="tag-type-max"
              type="number"
              min={1}
              value={maxPerTransaction}
              onChange={(e) => setMaxPerTransaction(e.target.value)}
              placeholder="Ilimitado"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para permitir quantas quiser.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tagTypeToEdit ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TagFormDialog({
  open,
  onOpenChange,
  tagToEdit,
  tagTypes,
  organizationId,
  initialTagTypeId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagToEdit: Tag | null;
  tagTypes: TagType[];
  organizationId: string;
  initialTagTypeId?: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [tagTypeId, setTagTypeId] = useState('');
  const [color, setColor] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (tagToEdit) {
        setName(tagToEdit.name);
        setTagTypeId(tagToEdit.tag_type.id);
        setColor(tagToEdit.color || '');
      } else {
        setName('');
        setTagTypeId(initialTagTypeId || tagTypes[0]?.id || '');
        setColor('');
      }
    }
  }, [open, tagToEdit, initialTagTypeId, tagTypes]);

  const createMutation = useMutation({
    mutationFn: () =>
      createTag(organizationId, {
        name: name.trim(),
        tag_type_id: tagTypeId,
        color: color || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', organizationId] });
      onSuccess();
      onOpenChange(false);
      resetForm();
      toast.success('Tag criada com sucesso!');
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTag(tagToEdit!.id, {
        name: name.trim(),
        tag_type_id: tagTypeId,
        color: color || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', organizationId] });
      onSuccess();
      onOpenChange(false);
      resetForm();
      toast.success('Tag atualizada com sucesso!');
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const resetForm = () => {
    setName('');
    setTagTypeId(initialTagTypeId || tagTypes[0]?.id || '');
    setColor('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da tag.');
      return;
    }
    if (!tagTypeId) {
      toast.error('Selecione o tipo da tag.');
      return;
    }
    if (tagToEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tagToEdit ? 'Editar tag' : 'Nova tag'}</DialogTitle>
          <DialogDescription>
            {tagToEdit
              ? 'Altere o nome, tipo ou cor da tag.'
              : 'Crie uma nova tag para organizar suas transações.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Nome</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alimentação"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-type">Tipo</Label>
            <select
              id="tag-type"
              value={tagTypeId}
              onChange={(e) => setTagTypeId(e.target.value)}
              disabled={isPending || !!tagToEdit}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione o tipo</option>
              {tagTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))}
            </select>
            {tagToEdit && (
              <p className="text-xs text-muted-foreground">O tipo não pode ser alterado.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color || '#6B7280'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#RRGGBB"
                  className="w-24 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tagToEdit ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfileCategoriasSection() {
  const { activeOrgId } = useOrganization();
  const [formOpen, setFormOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [activeTagType, setActiveTagType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [tagTypeToEdit, setTagTypeToEdit] = useState<TagType | null>(null);
  const [tagTypeToDelete, setTagTypeToDelete] = useState<TagType | null>(null);
  const [selectedTagTypeId, setSelectedTagTypeId] = useState<string | null>(null);

  const { data: tagTypesData, isLoading: loadingTypes, isError: errorTypes } = useQuery({
    queryKey: ['tag-types'],
    queryFn: listTagTypes,
  });

  const { data: tagsData, isLoading: loadingTags } = useQuery({
    queryKey: ['tags', activeOrgId],
    queryFn: () => listTags(activeOrgId!),
    enabled: !!activeOrgId,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', activeOrgId] });
      setTagToDelete(null);
      toast.success('Tag removida.');
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const deleteTagTypeMutation = useMutation({
    mutationFn: deleteTagType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      setTagTypeToDelete(null);
      toast.success('Tipo de tag removido.');
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const tagTypesFromApi = tagTypesData?.tag_types ?? [];
  const tags = tagsData?.tags ?? [];

  // Se listTagTypes retornou vazio mas temos tags, derivar tipos das tags (cada tag tem tag_type)
  const tagTypes =
    tagTypesFromApi.length > 0
      ? tagTypesFromApi
      : (() => {
          const seen = new Map<string, TagType>();
          tags.forEach((t) => {
            const tt = t.tag_type;
            if (!seen.has(tt.id)) {
              seen.set(tt.id, {
                id: tt.id,
                name: tt.name,
                description: tt.description,
                is_required: tt.is_required,
                max_per_transaction: tt.max_per_transaction,
              });
            }
          });
          return Array.from(seen.values());
        })();

  const tagsByType = tagTypes.reduce<Record<string, Tag[]>>((acc, tt) => {
    acc[tt.id] = tags.filter((t) => t.tag_type.id === tt.id);
    return acc;
  }, {});

  const searchLower = searchQuery.trim().toLowerCase();
  const filterTags = (items: Tag[]) =>
    searchLower
      ? items.filter((t) => t.name.toLowerCase().includes(searchLower))
      : items;

  const canManageTagTypes = tagTypesFromApi.length > 0;

  // Auto-selecionar primeiro tipo quando houver tipos e nenhum selecionado
  // Ou quando o tipo selecionado foi removido (ex: após delete)
  useEffect(() => {
    if (tagTypes.length === 0) {
      setSelectedTagTypeId(null);
    } else if (
      !selectedTagTypeId ||
      !tagTypes.some((tt) => tt.id === selectedTagTypeId)
    ) {
      setSelectedTagTypeId(tagTypes[0].id);
    }
  }, [tagTypes, selectedTagTypeId]);

  const selectedTagType = tagTypes.find((tt) => tt.id === selectedTagTypeId);
  const selectedTypeTags = selectedTagTypeId
    ? filterTags(tagsByType[selectedTagTypeId] ?? [])
    : [];

  const handleAddTag = (tagTypeId?: string) => {
    setTagToEdit(null);
    setActiveTagType(tagTypeId || selectedTagTypeId || tagTypes[0]?.id || null);
    setFormOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    setTagToEdit(tag);
    setActiveTagType(null);
    setFormOpen(true);
  };

  if (!activeOrgId) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione uma organização para gerenciar categorias e tags.
      </p>
    );
  }

  if (loadingTypes || loadingTags) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  if (errorTypes) {
    return (
      <p className="text-sm text-destructive py-4">
        Não foi possível carregar os tipos de tag. Verifique sua conexão e tente novamente.
      </p>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-12rem)] min-h-[400px] overflow-hidden">
      {/* Coluna Master: Tipos de Tag */}
      <Card className="lg:w-56 xl:w-64 shrink-0 shadow-flat border-0 rounded-2xl flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            Tipos de Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0 p-4 pt-0">
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {tagTypes.map((tt) => (
              <button
                key={tt.id}
                type="button"
                onClick={() => setSelectedTagTypeId(tt.id)}
                title={tt.description ? `${tt.name}: ${tt.description}` : tt.name}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors ${
                  selectedTagTypeId === tt.id
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100'
                    : 'hover:bg-muted/60'
                }`}
              >
                <span className="font-medium capitalize truncate flex-1 min-w-0">{tt.name}</span>
                {tt.is_required && (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-1 rounded shrink-0">
                    *
                  </span>
                )}
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagTypeToEdit(tt);
                      setTypeFormOpen(true);
                    }}
                    title="Editar tipo"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagTypeToDelete(tt);
                    }}
                    title="Remover tipo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTagTypeToEdit(null);
              setTypeFormOpen(true);
            }}
            className="w-full mt-3 border-dashed shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo tipo
          </Button>
          {!canManageTagTypes && tagTypes.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Editar/remover depende do backend.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Coluna Detail: Tags do tipo selecionado */}
      <Card className="flex-1 min-w-0 shadow-flat border-0 rounded-2xl flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Tags className="w-4 h-4 text-indigo-500" />
                Tags em: {selectedTagType ? (
                  <span className="capitalize">{selectedTagType.name}</span>
                ) : (
                  <span className="text-muted-foreground">Selecione um tipo</span>
                )}
              </CardTitle>
              {selectedTagType?.description && (
                <CardDescription className="text-xs mt-0.5">
                  {selectedTagType.description}
                </CardDescription>
              )}
            </div>
            {selectedTagTypeId && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleAddTag(selectedTagTypeId)}
                className="shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova tag
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-y-auto">
          {!selectedTagTypeId ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Selecione um tipo na coluna à esquerda para ver e gerenciar suas tags.
            </p>
          ) : tagTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Crie um tipo na coluna à esquerda primeiro.
            </p>
          ) : (
            <>
              <div className="mb-4 mt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {selectedTypeTags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 border border-dashed rounded-xl text-center">
                  {searchQuery.trim()
                    ? 'Nenhuma tag encontrada.'
                    : 'Nenhuma tag. Clique em "Nova tag" para criar.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedTypeTags.map((tag) => (
                    <li key={tag.id}>
                      <button
                        type="button"
                        onClick={() => handleEditTag(tag)}
                        title={tag.name}
                        className="group w-full flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                      >
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#6B7280' }}
                        />
                        <span className="text-sm font-medium flex-1 min-w-0 break-words">
                          {tag.name}
                        </span>
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTag(tag);
                            }}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagToDelete(tag);
                            }}
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchQuery.trim() &&
                (tagsByType[selectedTagTypeId] ?? []).length > selectedTypeTags.length && (
                <p className="text-xs text-muted-foreground mt-3">
                  Mostrando {selectedTypeTags.length} de{' '}
                  {(tagsByType[selectedTagTypeId] ?? []).length} tags
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <TagTypeFormDialog
        open={typeFormOpen}
        onOpenChange={setTypeFormOpen}
        tagTypeToEdit={tagTypeToEdit}
        onSuccess={() => setTagTypeToEdit(null)}
      />

      <TagFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tagToEdit={tagToEdit}
        tagTypes={tagTypes}
        organizationId={activeOrgId}
        initialTagTypeId={activeTagType}
        onSuccess={() => {}}
      />

      <AlertDialog open={!!tagToDelete} onOpenChange={() => setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tag?</AlertDialogTitle>
            <AlertDialogDescription>
              A tag &quot;{tagToDelete?.name}&quot; será desativada. Ela não aparecerá mais nas listagens,
              mas transações existentes manterão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tagToDelete && deleteMutation.mutate(tagToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!tagTypeToDelete}
        onOpenChange={() => setTagTypeToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tipo de tag?</AlertDialogTitle>
            <AlertDialogDescription>
              O tipo &quot;{tagTypeToDelete?.name}&quot; será removido. Se houver tags vinculadas,
              a operação pode falhar. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                tagTypeToDelete && deleteTagTypeMutation.mutate(tagTypeToDelete.id)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTagTypeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
