import { useState, useEffect, useRef, useCallback, Fragment, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { createTransaction, updateTransaction } from '@/api/transactions';
import { listCreditCards } from '@/api/creditCards';
import { getMyOrganizations } from '@/api/organizations';
import { listTags, listTagTypes, createTag } from '@/api/tags';
import { CreateTransactionRequest, Transaction } from '@/types/api';
import { handleApiError } from '@/api/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, TrendingUp, TrendingDown, Check, CreditCard, Wallet, Banknote, Building2, Receipt, Plus, Calendar, Tag, DollarSign, FileText, ShoppingBag, Clock, Search, MapPin, User, FolderOpen, StickyNote, X, Sparkles, Info, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CategorySelector } from '@/components/CategorySelector';
import { AddDetailsButton } from '@/components/AddDetailsButton';
import { TagSelector, TagType } from '@/components/TagSelector';
import { CardSelector } from '@/components/CardSelector';
import { CategoryChip } from '@/components/CategoryChip';
import { CompactTagChip } from '@/components/CompactTagChip';
import { DateTimeInput } from '@/components/DateTimeInput';

// Mapeamento de emojis e ícones para tipos de tags (baseado no nome do tipo)
const getTagTypeConfig = (typeName: string): { emoji: string; icon: React.ComponentType<{ className?: string }>; label: string } => {
  const normalizedName = typeName.toLowerCase();
  const configMap: Record<string, { emoji: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
    categoria: { emoji: '🏷️', icon: Tag, label: 'Categoria' },
    category: { emoji: '🏷️', icon: Tag, label: 'Categoria' },
    local: { emoji: '📍', icon: MapPin, label: 'Local' },
    location: { emoji: '📍', icon: MapPin, label: 'Local' },
    pessoa: { emoji: '👤', icon: User, label: 'Pessoa' },
    person: { emoji: '👤', icon: User, label: 'Pessoa' },
    projeto: { emoji: '📁', icon: FolderOpen, label: 'Projeto' },
    project: { emoji: '📁', icon: FolderOpen, label: 'Projeto' },
    nota: { emoji: '📝', icon: StickyNote, label: 'Nota' },
    note: { emoji: '📝', icon: StickyNote, label: 'Nota' },
    cliente: { emoji: '👥', icon: User, label: 'Cliente' },
    client: { emoji: '👥', icon: User, label: 'Cliente' },
  };

  return configMap[normalizedName] || {
    emoji: '🏷️',
    icon: Tag,
    label: typeName.charAt(0).toUpperCase() + typeName.slice(1)
  };
};

// Componente: Prompt de Classificação Unificado (Blueprint v16)
function ClassificationPrompt({
  category,
  onCategoryChange,
  categories,
  tags,
  onTagToggle,
  onTagValueChange,
  disabled,
  allTagsFromBackend = [],
  tagTypesFromBackend = [],
  onPanelStateChange,
  isOpen: isOpenControlled,
}: {
  category: string | null;
  onCategoryChange: (value: string) => void;
  categories: string[];
  tags: Array<{ type: string; value: string }>; // Usar string para suportar tanto TagType quanto tipos do backend
  onTagToggle: (type: TagType | string, value: string) => void; // Aceitar string também
  onTagValueChange: (type: TagType | string, value: string | null) => void; // Aceitar string também
  disabled: boolean;
  allTagsFromBackend?: Array<{ type: string; name: string }>;
  tagTypesFromBackend?: Array<{ id: string; name: string; description: string | null; is_required: boolean; max_per_transaction: number | null }>;
  onPanelStateChange?: (isOpen: boolean) => void;
  isOpen?: boolean; // Prop controlada para permitir fechamento externo
}) {
  // Garantir que allTagsFromBackend sempre tenha um valor padrão
  const backendTags = allTagsFromBackend || [];

  // Estado para controlar se o painel está aberto (controlado ou não controlado)
  const [isPanelOpenInternal, setIsPanelOpenInternal] = useState(false);

  // Se isOpenControlled for fornecido, usar como estado controlado; caso contrário, usar estado interno
  const isPanelOpen = isOpenControlled !== undefined ? isOpenControlled : isPanelOpenInternal;

  // Função para atualizar o estado do painel
  const setIsPanelOpen = (value: boolean) => {
    if (isOpenControlled === undefined) {
      // Modo não controlado: atualizar estado interno
      setIsPanelOpenInternal(value);
    }
    // Sempre notificar o pai sobre mudanças
    onPanelStateChange?.(value);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(0);
  const searchQueryRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar refs com states
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Obter tags mais usadas para sugestões rápidas (max 5 por tipo)
  const getQuickSuggestions = (): Array<{ type: string; value: string }> => {
    const suggestions: Array<{ type: string; value: string }> = [];
    const countsByType: Record<string, number> = {};

    // Iterar sobre todas as tags e selecionar até 5 de cada tipo
    for (const tag of backendTags) {
      const type = tag.type;
      const currentCount = countsByType[type] || 0;

      if (currentCount < 5) {
        suggestions.push({
          type: tag.type,
          value: tag.name,
        });
        countsByType[type] = currentCount + 1;
      }
    }

    return suggestions;
  };

  // Agrupar tags por tipo para o painel
  const getTagsByType = (): Record<string, Array<{ type: string; value: string }>> => {
    const tagsByType: Record<string, Array<{ type: string; value: string }>> = {};
    backendTags.forEach(tag => {
      const tagType = tag.type.toLowerCase();
      if (!tagsByType[tagType]) {
        tagsByType[tagType] = [];
      }
      tagsByType[tagType].push({
        type: tag.type,
        value: tag.name,
      });
    });
    return tagsByType;
  };

  // Detectar padrão chave:valor
  const parseKeyValue = (query: string): { key: string; value: string } | null => {
    const match = query.match(/^(\w+):(.+)$/);
    if (match) {
      return { key: match[1].toLowerCase(), value: match[2].trim() };
    }
    return null;
  };

  // Verificar se a chave é um tipo válido (incluindo categoria)
  const isValidTagType = (key: string): string | 'category' | null => {
    const normalizedKey = key.toLowerCase();

    // Verificar se é categoria
    if (normalizedKey === 'categoria' || normalizedKey === 'category') {
      return 'category';
    }

    // Verificar se existe nos tipos do backend (excluindo categoria)
    const tagType = tagTypesFromBackend.find(
      tt => tt.name.toLowerCase() === normalizedKey && tt.name.toLowerCase() !== 'categoria'
    );

    return tagType ? tagType.name : null;
  };

  // Buscar tags existentes na lista do backend
  const searchTags = (query: string): Array<{ type: string; value: string }> => {
    const queryLower = query.toLowerCase();
    // Obter nomes dos tipos do backend (excluindo categoria)
    const supportedTypeNames = tagTypesFromBackend
      .filter(tt => tt.name.toLowerCase() !== 'categoria')
      .map(tt => tt.name.toLowerCase());

    return backendTags
      .filter(tag => {
        // Filtrar apenas tags dos tipos suportados (não categoria)
        return supportedTypeNames.includes(tag.type.toLowerCase()) &&
          tag.name.toLowerCase().includes(queryLower);
      })
      .map(tag => ({
        type: tag.type,
        value: tag.name,
      }));
  };


  // Processar a busca
  const getSearchResults = () => {
    const kv = parseKeyValue(searchQuery);

    if (kv) {
      const tagType = isValidTagType(kv.key);
      if (!tagType) {
        const allowedTypes = [
          'Categoria',
          ...tagTypesFromBackend
            .filter(tt => tt.name.toLowerCase() !== 'categoria')
            .map(tt => getTagTypeConfig(tt.name).label)
        ];
        return {
          type: 'error' as const,
          message: `Tipo "${kv.key}" não encontrado. Tipos permitidos: ${allowedTypes.join(', ')}`,
        };
      }

      // Se for categoria, tratar de forma especial
      if (tagType === 'category') {
        return {
          type: 'set_category' as const,
          value: kv.value,
        };
      }

      // Verificar se a tag já existe no backend
      const existingTagInBackend = backendTags.find(
        t => t.type.toLowerCase() === tagType.toLowerCase() &&
          t.name.toLowerCase() === kv.value.toLowerCase()
      );

      // Verificar se já está adicionada na transação atual
      const existingTagInTransaction = tags.find(
        t => t.type === tagType && t.value.toLowerCase() === kv.value.toLowerCase()
      );

      if (existingTagInBackend) {
        return {
          type: 'assign' as const,
          tagType,
          value: kv.value,
          existing: !!existingTagInTransaction,
        };
      }

      // Se não existe no backend, oferecer criar
      return {
        type: 'create' as const,
        tagType,
        value: kv.value,
      };
    }

    // Busca normal
    if (searchQuery.trim()) {
      const results: Array<{ type: string; value: string; category: string }> = [];
      const queryLower = searchQuery.toLowerCase();

      // Buscar em categorias do backend
      backendTags
        .filter(tag => tag.type === 'categoria' && tag.name.toLowerCase().includes(queryLower))
        .forEach(tag => {
          results.push({ type: 'category', value: tag.name, category: 'Categoria' });
        });

      // Buscar em tags do backend
      const foundTags = searchTags(searchQuery);
      foundTags.forEach(tag => {
        const config = getTagTypeConfig(tag.type);
        results.push({ type: tag.type, value: tag.value, category: config.label });
      });

      // Se não encontrou resultados na lista completa do backend, oferecer criar nova tag
      if (results.length === 0) {
        return {
          type: 'create_new' as const,
          query: searchQuery.trim(),
        };
      }

      return {
        type: 'search' as const,
        results: results.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {} as Record<string, Array<{ type: string; value: string; category: string }>>),
      };
    }

    // Quando não há busca, mostrar todas as tags agrupadas por tipo
    const tagsByType: Record<string, Array<{ type: string; value: string }>> = {};

    // Agrupar todas as tags do backend por tipo
    backendTags.forEach(tag => {
      const tagType = tag.type.toLowerCase();
      if (!tagsByType[tagType]) {
        tagsByType[tagType] = [];
      }
      tagsByType[tagType].push({
        type: tag.type,
        value: tag.name,
      });
    });

    return {
      type: 'all_tags_by_type' as const,
      tagsByType,
    };
  };

  const results = useMemo(() => getSearchResults(), [searchQuery, backendTags, tags, categories, tagTypesFromBackend]);

  const flatSearchResults = useMemo(() => {
    if (results.type === 'search') {
      return Object.values(results.results).flat();
    }
    return [];
  }, [results]);

  const quickSuggestions = getQuickSuggestions();
  const tagsByType = getTagsByType();

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // Sincronizar estado interno quando isOpenControlled muda (fechamento externo)
  // Quando o pai força o fechamento, limpar o estado interno e a busca
  useEffect(() => {
    if (isOpenControlled !== undefined && !isOpenControlled) {
      // Se o pai força o fechamento, limpar a busca e resetar estado interno
      setSearchQuery('');
      setSelectedIndex(0);
      setIsPanelOpenInternal(false);
    }
  }, [isOpenControlled]);

  // Notificar mudança de estado do painel
  useEffect(() => {
    onPanelStateChange?.(isPanelOpen);
  }, [isPanelOpen, onPanelStateChange]);



  const handleSelect = useCallback((result: any, item?: any) => {
    if (result.type === 'assign' || result.type === 'create') {
      onTagToggle(result.tagType, result.value);
      setSearchQuery('');
      setIsPanelOpen(false);
    } else if (result.type === 'search' && item) {
      if (item.type === 'category') {
        onCategoryChange(item.value);
      } else {
        onTagToggle(item.type as TagType, item.value);
      }
      setSearchQuery('');
      setIsPanelOpen(false);
    } else if (result.type === 'create_new') {
      // Este caso não deve ser usado diretamente - as opções são tratadas individualmente
      // Por padrão, não fazer nada aqui - deixar o usuário escolher
    }
  }, [onTagToggle, onCategoryChange]);

  // Listener de teclado global: focar input quando usuário começar a digitar
  // Listener de teclado global: focar input quando usuário começar a digitar
  useEffect(() => {
    if (disabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input, textarea, etc.
      const target = e.target as HTMLElement;

      // Se o alvo já for o nosso input do painel ou o input principal, não fazer nada (deixar nativo)
      if (target === panelInputRef.current || target === inputRef.current) {
        return;
      }

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Se for uma letra, número ou caractere imprimível
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();

        if (isPanelOpen) {
          // Se o painel já estiver aberto, focar e adicionar o caractere
          panelInputRef.current?.focus();
          setSearchQuery(prev => prev + e.key);
        } else {
          // Se estiver fechado, abrir e definir o caractere
          inputRef.current?.focus();
          setSearchQuery(e.key);
          setIsPanelOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [disabled, isPanelOpen]);

  // Resetar índice selecionado quando a busca muda ou quando o tipo de resultado muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Resetar índice quando o tipo de resultado muda para create_new
  useEffect(() => {
    if (results.type === 'create_new' || results.type === 'search') {
      setSelectedIndex(0);
    }
  }, [results]);

  // Navegação por teclado no painel
  useEffect(() => {
    if (!isPanelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeInput = panelInputRef.current || inputRef.current;
      const isInputFocused = e.target === activeInput;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          if (results.type === 'search') {
            return Math.min(prev + 1, flatSearchResults.length - 1);
          } else if (results.type === 'create_new') {
            const maxIndex = tagTypesFromBackend.filter(tt => tt.name.toLowerCase() !== 'categoria').length;
            return Math.min(prev + 1, maxIndex);
          }
          return prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();

        // Caso 1: Padrão chave:valor (assign ou create)
        if (results.type === 'assign' || results.type === 'create') {
          handleSelect(results);
          return;
        }

        // Caso 2: Resultados de busca
        if (results.type === 'search') {
          const itemToSelect = flatSearchResults[selectedIndex] || flatSearchResults[0];
          if (itemToSelect) {
            handleSelect(results, itemToSelect);
          }
          return;
        }

        // Caso 3: Criar nova (quando não há resultados)
        if (results.type === 'create_new') {
          const createNewOptions = [
            { type: 'category' as const, value: results.query },
            ...tagTypesFromBackend
              .filter(tt => tt.name.toLowerCase() !== 'categoria')
              .map(tt => ({
                type: tt.name as TagType,
                value: results.query
              }))
          ];

          const selectedOption = createNewOptions[selectedIndex] || createNewOptions[0];
          if (selectedOption.type === 'category') {
            onCategoryChange(selectedOption.value);
          } else {
            onTagToggle(selectedOption.type, selectedOption.value);
          }
          setSearchQuery('');
          setIsPanelOpen(false);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsPanelOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPanelOpen, searchQuery, selectedIndex, tags, categories, handleSelect, onTagToggle, tagTypesFromBackend, onCategoryChange, results, flatSearchResults]);

  // Focar o input do painel quando abrir
  useEffect(() => {
    if (isPanelOpen && panelInputRef.current) {
      setTimeout(() => {
        panelInputRef.current?.focus();
      }, 100);
    }
  }, [isPanelOpen]);

  // Scroll automático para o item selecionado
  useEffect(() => {
    if (isPanelOpen) {
      const selectedElement = document.getElementById(`result-item-${selectedIndex}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, isPanelOpen]);

  // Estado para seções expandidas
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Estado para criação de nova tag
  const [creationState, setCreationState] = useState<{ type: string; label: string } | null>(null);
  const [newTagValue, setNewTagValue] = useState('');

  const handleCreateTag = () => {
    if (!newTagValue.trim() || !creationState) return;

    const isCategory = creationState.type.toLowerCase() === 'categoria';

    if (isCategory) {
      onCategoryChange(newTagValue.trim());
    } else {
      onTagToggle(creationState.type as TagType, newTagValue.trim());
    }

    setCreationState(null);
    setNewTagValue('');
  };

  const toggleSection = (type: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Renderizar modo padrão ou painel
  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col">
      {/* Input de Busca - Sempre visível */}
      <div className="relative mb-3">
        <input
          ref={inputRef}
          type="text"
          placeholder={isPanelOpen ? "Buscar ou criar tag (ex: categoria:transporte)..." : "+ Adicionar Categoria ou Tag..."}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isPanelOpen) setIsPanelOpen(true);
          }}
          onFocus={() => {
            setIsPanelOpen(true);
          }}
          onClick={() => {
            setIsPanelOpen(true);
          }}
          disabled={disabled}
          className="w-full rounded-lg bg-gray-50 dark:bg-gray-900 px-4 py-2.5 pr-10 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Seção 1: Itens Selecionados - Sempre visível se houver itens */}
      {(() => {
        const selectedItems: Array<{ type: string; value: string }> = [];

        // Usar apenas tags como fonte da verdade - ignorar campo 'category' legado completamente
        tags.forEach(tag => {
          selectedItems.push({ type: tag.type, value: tag.value });
        });

        if (selectedItems.length === 0) return null;

        return (
          <div className="space-y-3 mb-4">
            <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Selecionados
            </div>

            {Object.entries(
              selectedItems.reduce((acc, item) => {
                const type = item.type;
                if (!acc[type]) {
                  acc[type] = [];
                }
                acc[type].push(item);
                return acc;
              }, {} as Record<string, typeof selectedItems>)
            ).map(([type, items]) => {
              const config = getTagTypeConfig(type);
              return (
                <div key={`selected-group-${type}`} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      {config.emoji} {config.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, idx) => {
                      const isCategory = item.type === 'category';

                      return (
                        <button
                          key={`selected-${item.type}-${item.value}-${idx}`}
                          type="button"
                          onClick={() => {
                            if (isCategory) {
                              onCategoryChange(item.value);
                            } else {
                              onTagToggle(item.type as TagType, item.value);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                        >
                          <span>{item.value}</span>
                          <Check className="h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <AnimatePresence mode="wait">
        {/* Seção 2: Sugestões - Visível apenas se painel fechado E nada selecionado */}
        {!isPanelOpen && (!category && tags.length === 0) && quickSuggestions.length > 0 && (
          <motion.div
            key="suggestions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Sugestões
            </div>

            {Object.entries(
              quickSuggestions.reduce((acc, item) => {
                const type = item.type;
                if (!acc[type]) {
                  acc[type] = [];
                }
                acc[type].push(item);
                return acc;
              }, {} as Record<string, typeof quickSuggestions>)
            ).map(([type, items]) => {
              const config = getTagTypeConfig(type);
              return (
                <div key={`quick-group-${type}`} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      {config.emoji} {config.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item, idx) => {
                      const isCategory = item.type.toLowerCase() === 'categoria';

                      return (
                        <button
                          key={`quick-${item.type}-${item.value}-${idx}`}
                          type="button"
                          onClick={() => {
                            if (isCategory) {
                              onCategoryChange(item.value);
                            } else {
                              onTagToggle(item.type as TagType, item.value);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          <span>{item.value}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* MODO PAINEL: Conteúdo das Tags */}
        {isPanelOpen && (
          <motion.div
            key="panel-content"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col min-h-0 mt-2"
          >
            {/* Header removido - agora controlado pelo componente pai */}

            {/* Área de Conteúdo das Tags - Com scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
              {results.type === 'error' && (
                <div className="p-4 text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-900/20">
                  {results.message}
                </div>
              )}

              {results.type === 'set_category' && (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <button
                    type="button"
                    onClick={() => {
                      onCategoryChange(results.value);
                      setSearchQuery('');
                      setIsPanelOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300"
                  >
                    <span>🏷️</span>
                    <span>Definir categoria como "{results.value}"</span>
                  </button>
                </div>
              )}

              {results.type === 'assign' && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <button
                    type="button"
                    onClick={() => handleSelect(results)}
                    className="w-full text-left flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300"
                  >
                    <Check className="h-4 w-4" />
                    <span>Adicionar a tag "{results.value}" ao tipo "{getTagTypeConfig(results.tagType).label}"</span>
                  </button>
                </div>
              )}

              {results.type === 'create' && (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <button
                    type="button"
                    onClick={() => handleSelect(results)}
                    className="w-full text-left flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Criar e adicionar a tag "{results.value}" ao tipo "{getTagTypeConfig(results.tagType).label}"</span>
                  </button>
                </div>
              )}

              {results.type === 'search' && (
                <div className="space-y-1">
                  {flatSearchResults.map((item, idx) => {
                    const isFirstOfCategory = idx === 0 || item.category !== flatSearchResults[idx - 1].category;
                    const isSelected = selectedIndex === idx;
                    const isCategory = item.type === 'category';
                    const config = isCategory
                      ? { emoji: '🏷️', label: 'Categoria' }
                      : getTagTypeConfig(item.type as string);

                    return (
                      <Fragment key={`${item.type}-${item.value}-${idx}`}>
                        {isFirstOfCategory && (
                          <div className={cn(
                            "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1",
                            idx > 0 ? "mt-4 mb-2" : "mb-2"
                          )}>
                            {item.category}
                          </div>
                        )}
                        <button
                          type="button"
                          id={`result-item-${idx}`}
                          onClick={() => {
                            if (isCategory) {
                              onCategoryChange(item.value);
                            } else {
                              onTagToggle(item.type as TagType, item.value);
                            }
                            setSearchQuery('');
                            setIsPanelOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm",
                            isSelected
                              ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
                          )}
                        >
                          <span>{config.emoji}</span>
                          <span className="font-medium">{item.value}</span>
                        </button>
                      </Fragment>
                    );
                  })}
                </div>
              )}

              {results.type === 'create_new' && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Criar Nova
                  </div>
                  <button
                    type="button"
                    id="result-item-0"
                    onClick={() => {
                      onCategoryChange(results.query);
                      setSearchQuery('');
                      setIsPanelOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm",
                      selectedIndex === 0
                        ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <span>🏷️</span>
                    <span className="font-medium">Criar "{results.query}" como Categoria</span>
                  </button>
                  {tagTypesFromBackend
                    .filter(tt => tt.name.toLowerCase() !== 'categoria')
                    .map((tagType, idx) => {
                      const config = getTagTypeConfig(tagType.name);
                      const optionIndex = idx + 1;
                      const isSelected = selectedIndex === optionIndex;
                      return (
                        <button
                          key={tagType.id}
                          type="button"
                          id={`result-item-${optionIndex}`}
                          onClick={() => {
                            onTagToggle(tagType.name as TagType, results.query);
                            setSearchQuery('');
                            setIsPanelOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm",
                            isSelected
                              ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <span>{config.emoji}</span>
                          <span className="font-medium">Criar "{results.query}" como {config.label}</span>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Exibição completa de tags por tipo (quando não há busca) */}
              {results.type === 'all_tags_by_type' && (
                <div className="space-y-6">
                  {tagTypesFromBackend
                    .filter(tt => tagsByType[tt.name.toLowerCase()] && tagsByType[tt.name.toLowerCase()].length > 0)
                    .map((tagType) => {
                      const config = getTagTypeConfig(tagType.name);
                      const typeTags = tagsByType[tagType.name.toLowerCase()] || [];
                      const isExpanded = expandedSections[tagType.name] || false;
                      const isCategoryType = tagType.name.toLowerCase() === 'categoria';
                      const limit = isCategoryType ? 8 : 12;
                      const visibleTags = isExpanded ? typeTags : typeTags.slice(0, limit);
                      const hasMore = typeTags.length > limit;

                      return (
                        <div key={tagType.id} className="space-y-3 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{config.emoji}</span>
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {config.label}
                              </h3>
                              <span className="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                {typeTags.length}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCreationState({
                                  type: tagType.name,
                                  label: config.label
                                });
                              }}
                              className="h-7 px-2 text-xs hover:bg-white dark:hover:bg-gray-800"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Novo
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {visibleTags.map((tag, idx) => {
                              const isCategory = tagType.name.toLowerCase() === 'categoria';
                              const isSelected = isCategory
                                ? category === tag.value
                                : tags.some(t => t.type === tag.type && t.value === tag.value);

                              return (
                                <button
                                  key={`${tag.type}-${tag.value}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    if (isCategory) {
                                      onCategoryChange(tag.value);
                                    } else {
                                      onTagToggle(tag.type as TagType, tag.value);
                                    }
                                    // Não fechar o painel ao selecionar no modo de visualização completa
                                    // setIsPanelOpen(false);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border",
                                    isSelected
                                      ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 shadow-sm"
                                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                                  )}
                                >
                                  {isSelected && <Check className="h-3.5 w-3.5" />}
                                  <span>{tag.value}</span>
                                </button>
                              );
                            })}
                          </div>
                          {hasMore && (
                            <button
                              type="button"
                              onClick={() => toggleSection(tagType.name)}
                              className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mt-2"
                            >
                              {isExpanded ? "Ver menos" : `Ver mais (${typeTags.length - limit} restantes)...`}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog de Criação de Tag */}
      <Dialog open={!!creationState} onOpenChange={(open) => !open && setCreationState(null)}>
        <DialogContent className="sm:max-w-[425px]" style={{ zIndex: 70 }}>
          <DialogHeader>
            <DialogTitle>Criar nova {creationState?.label}</DialogTitle>
            <DialogDescription>
              Adicione uma nova opção para {creationState?.label}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Input
                id="name"
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value)}
                className="col-span-4"
                placeholder={`Nome da ${creationState?.label}...`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreationState(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagValue.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para área de gerenciamento de cartão (Cena 1)
function CardManagementArea({
  organizationId,
  selectedCardId,
  onCardSelect,
  onShowCreateForm,
  form,
  loading,
}: {
  organizationId: string;
  selectedCardId: number | null;
  onCardSelect: (cardId: number | null, card?: { last4: string }) => void;
  onShowCreateForm: () => void;
  form: ReturnType<typeof useForm<TransactionFormValues>>;
  loading: boolean;
}) {
  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto pr-1">
      <CardSelector
        organizationId={organizationId}
        selectedCardId={selectedCardId}
        onCardSelect={onCardSelect}
        disabled={loading}
        hideAddButton={true}
      />
      <Button
        type="button"
        variant="outline"
        onClick={onShowCreateForm}
        disabled={loading}
        className="w-full justify-start gap-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      >
        <Plus className="h-4 w-4 text-blue-500" />
        <span className="text-blue-600 dark:text-blue-400">Adicionar Novo Cartão</span>
      </Button>

      {/* Modalidade - só aparece após cartão selecionado */}
      <AnimatePresence>
        {selectedCardId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <FormField
              control={form.control}
              name="modality"
              render={({ field }) => (
                <FormItem>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Modalidade</h4>

                    <ToggleGroup
                      type="single"
                      value={field.value || ''}
                      onValueChange={(value) => {
                        if (value) {
                          field.onChange(value);
                          if (value !== 'installment') {
                            form.setValue('installments_count', null);
                          }
                        }
                      }}
                      disabled={loading}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="cash"
                        aria-label="À vista"
                        className={cn(
                          'flex-1 h-10 rounded-lg font-medium text-sm transition-all duration-200',
                          'data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-blue-500 data-[state=on]:text-white data-[state=on]:shadow-md',
                          'data-[state=off]:bg-gray-100 dark:data-[state=off]:bg-gray-700 data-[state=off]:text-gray-700 dark:data-[state=off]:text-gray-300',
                          'data-[state=off]:hover:bg-gray-200 dark:data-[state=off]:hover:bg-gray-600'
                        )}
                      >
                        À vista
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="installment"
                        aria-label="Parcelado"
                        className={cn(
                          'flex-1 h-10 rounded-lg font-medium text-sm transition-all duration-200',
                          'data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-blue-500 data-[state=on]:text-white data-[state=on]:shadow-md',
                          'data-[state=off]:bg-gray-100 dark:data-[state=off]:bg-gray-700 data-[state=off]:text-gray-700 dark:data-[state=off]:text-gray-300',
                          'data-[state=off]:hover:bg-gray-200 dark:data-[state=off]:hover:bg-gray-600'
                        )}
                      >
                        Parcelado
                      </ToggleGroupItem>
                    </ToggleGroup>

                    {/* Campo de parcelas - aparece quando Parcelado está selecionado */}
                    <AnimatePresence>
                      {field.value === 'installment' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <InstallmentsField form={form} loading={loading} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Componente para formulário de criação de cartão (Cena 2)
function CardCreateForm({
  organizationId,
  onCardCreated,
  onCancel,
  disabled,
}: {
  organizationId: string;
  onCardCreated: (cardId: number, last4?: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    last4: '',
    brand: '',
    description: '',
  });

  const cardBrands = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];

  const handleCreate = async () => {
    if (!formData.last4 || !formData.brand) return;

    try {
      setCreating(true);
      const { createCreditCard } = await import('@/api/creditCards');
      const last4 = formData.last4.replace(/\D/g, '').slice(0, 4);
      const newCard = await createCreditCard({
        organization_id: organizationId,
        last4: last4,
        brand: formData.brand,
        due_day: 10,
        description: formData.description || null,
      });
      onCardCreated(newCard.id, newCard.last4);
    } catch (error) {
      console.error('Erro ao criar cartão:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-purple-200 dark:border-purple-800 p-5 space-y-4 h-full overflow-y-auto"
    >
      <h4 className="font-semibold text-base text-gray-900 dark:text-gray-100">Adicionar Novo Cartão</h4>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Nome do Cartão</label>
          <Input
            type="text"
            placeholder="Nome do Cartão"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={creating || disabled}
            className="border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Últimos 4 dígitos</label>
          <Input
            type="text"
            maxLength={4}
            placeholder="••••"
            value={formData.last4}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
              setFormData({ ...formData, last4: value });
            }}
            disabled={creating || disabled}
            className="border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Bandeira</label>
          <div className="flex flex-wrap gap-2">
            {cardBrands.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => setFormData({ ...formData, brand })}
                disabled={creating || disabled}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  formData.brand === brand
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={creating || disabled || !formData.last4 || !formData.brand}
            className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={creating || disabled}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// Componente separado para o campo de parcelas com legenda dinâmica
function InstallmentsField({ form, loading }: { form: ReturnType<typeof useForm<TransactionFormValues>>; loading: boolean }) {
  const transactionValueRaw = useWatch({ control: form.control, name: 'value' });
  // Garantir que transactionValue seja um número
  const transactionValue = typeof transactionValueRaw === 'number' ? transactionValueRaw : (transactionValueRaw ? Number(transactionValueRaw) : 0);
  const installmentsCount = useWatch({ control: form.control, name: 'installments_count' });
  const modality = useWatch({ control: form.control, name: 'modality' });
  const installmentsInputRef = useRef<HTMLInputElement>(null);
  const numInstallments = installmentsCount ? Number(installmentsCount) : 0;
  const installmentValue = numInstallments > 0 && transactionValue > 0
    ? transactionValue / numInstallments
    : 0;
  const showLegend = numInstallments > 0 && transactionValue > 0;

  // Focar o input quando a modalidade mudar para 'installment'
  useEffect(() => {
    if (modality === 'installment') {
      // Aguardar a animação do campo aparecer e garantir que o DOM está pronto
      const timeoutId = setTimeout(() => {
        if (installmentsInputRef.current) {
          // Verificar se o elemento está visível
          const rect = installmentsInputRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            installmentsInputRef.current.focus();
            installmentsInputRef.current.select();
          }
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [modality]);


  return (
    <FormField
      control={form.control}
      name="installments_count"
      render={({ field: installmentsField }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quantidade de Parcelas
          </FormLabel>
          <div className="flex items-center gap-2 flex-wrap">
            <FormControl>
              <input
                ref={(e) => {
                  installmentsField.ref(e);
                  // Atribuir ao ref manualmente usando type assertion
                  if (e) {
                    (installmentsInputRef as any).current = e;
                  } else {
                    (installmentsInputRef as any).current = null;
                  }
                }}
                type="text"
                inputMode="numeric"
                placeholder="Ex: 10"
                name={installmentsField.name}
                onBlur={installmentsField.onBlur}
                onChange={(e) => {
                  // Permite apenas números
                  const value = e.target.value.replace(/\D/g, '');
                  if (value === '') {
                    installmentsField.onChange(null);
                  } else {
                    const numValue = parseInt(value);
                    // Mínimo de 2 parcelas, sem limite máximo
                    if (numValue >= 2) {
                      installmentsField.onChange(numValue);
                    } else if (numValue > 0) {
                      // Permite digitar 1, mas não aceita até ter pelo menos 2
                      installmentsField.onChange(numValue);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  // Permite apenas números, backspace, delete, arrow keys, tab
                  if (!/[\d\b\Delete\ArrowLeft\ArrowRight\Tab]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
                value={installmentsField.value || ''}
                disabled={loading}
                className="flex w-14 rounded-lg bg-gray-50 dark:bg-gray-900 px-2 py-2.5 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-center shrink-0"
              />
            </FormControl>
            {showLegend && (
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium min-w-0 flex-shrink">
                <span className="truncate block">parcelas de R$ {installmentValue.toFixed(2).replace('.', ',')}</span>
              </div>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const transactionSchema = z.object({
  organization_id: z.string().min(1, 'Selecione uma organização'),
  type: z.enum(['income', 'expense'], {
    required_error: 'Selecione o tipo de transação',
  }),
  description: z.string().min(3, 'A descrição deve ter pelo menos 3 caracteres'),
  category: z.string().optional(), // Campo legado - não usado, tags são a fonte da verdade
  value: z.coerce.number().positive('O valor deve ser maior que zero'),
  payment_method: z.string().min(1, 'Selecione o método de pagamento'),
  date: z.string().min(1, 'Selecione uma data'),
  // Campos opcionais para cartão de crédito
  card_last4: z.string().optional().nullable(),
  modality: z.enum(['cash', 'installment']).optional().nullable(),
  installments_count: z.number().positive().optional().nullable(),
  // Marcador de recorrência para previsões futuras
  recurring: z.boolean().default(false),
}).refine((data) => {
  if (data.payment_method === 'Cartão de Crédito' && !data.card_last4) {
    return false;
  }
  return true;
}, {
  message: 'Informe os últimos 4 dígitos do cartão',
  path: ['card_last4'],
}).refine((data) => {
  if (data.modality === 'installment' && !data.installments_count) {
    return false;
  }
  return true;
}, {
  message: 'Informe o número de parcelas',
  path: ['installments_count'],
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface NewTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onInvalidateCache?: () => void; // Chamado imediatamente após sucesso para invalidar cache
  transactionToEdit?: Transaction | null;
}

const categories = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Compras',
  'Serviços',
  'Outros',
];

const allPaymentMethods = [
  'PIX',
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Transferência Bancária',
  'Boleto',
];

// Métodos de pagamento mais comuns para chips visuais
const commonPaymentMethods = [
  { value: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: CreditCard },
  { value: 'PIX', label: 'PIX', icon: Wallet },
  { value: 'Dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'Cartão de Débito', label: 'Cartão de Débito', icon: CreditCard },
  { value: 'Boleto', label: 'Boleto', icon: Receipt },
  { value: 'Transferência Bancária', label: 'Transferência Bancária', icon: Building2 },
];

export function NewTransactionSheet({
  open,
  onOpenChange,
  onSuccess,
  onInvalidateCache,
  transactionToEdit,
}: NewTransactionSheetProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  // Debug: identificar no console quando o painel está usando o layout mobile
  useEffect(() => {
    if (isMobile) {
      // eslint-disable-next-line no-console
      console.log(
        '[Fincla][NewTransactionSheet] Layout mobile ativo (useIsMobile === true)',
        {
          innerWidth: typeof window !== 'undefined' ? window.innerWidth : null,
          innerHeight: typeof window !== 'undefined' ? window.innerHeight : null,
        }
      );
    } else {
      // eslint-disable-next-line no-console
      console.log('[Fincla][NewTransactionSheet] Layout desktop/tablet (useIsMobile === false)');
    }
  }, [isMobile]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAndCreateAnother, setSaveAndCreateAnother] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [valueDisplay, setValueDisplay] = useState<string>('');
  const valueInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para wizard mobile
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [showTagSelector, setShowTagSelector] = useState(false);

  // Estados para tags e cartão
  // Usar string para type para suportar tanto TagType quanto tipos do backend (categoria, category, etc.)
  const [tags, setTags] = useState<Array<{ type: string; value: string }>>([]);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showCardCreateForm, setShowCardCreateForm] = useState(false);

  // Estados para categorias e tags do backend
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [allTagsFromBackend, setAllTagsFromBackend] = useState<Array<{ id: string; type: string; name: string }>>([]);
  const [tagTypesFromBackend, setTagTypesFromBackend] = useState<Array<{ id: string; name: string; description: string | null; is_required: boolean; max_per_transaction: number | null }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isClassificationPanelOpen, setIsClassificationPanelOpen] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      organization_id: '',
      type: 'expense',
      description: '',
      category: '',
      value: 0,
      payment_method: '',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      card_last4: null,
      modality: null,
      installments_count: null,
    },
  });

  const paymentMethod = form.watch('payment_method');
  const type = form.watch('type');
  const currentOrganizationId = form.watch('organization_id');

  // Filtrar métodos de pagamento baseado no tipo de transação
  const paymentMethods = type === 'income'
    ? ['PIX', 'Dinheiro', 'Transferência Bancária']
    : allPaymentMethods;

  // Buscar tipos de tags do backend (uma vez, não depende da organização)
  useEffect(() => {
    const loadTagTypes = async () => {
      try {
        const response = await listTagTypes();
        setTagTypesFromBackend(response.tag_types);
      } catch (err) {
        console.error('Erro ao buscar tipos de tags:', err);
      }
    };

    loadTagTypes();
  }, []);

  // Focar automaticamente no campo de valor quando a etapa 1 mobile for exibida
  useEffect(() => {
    if (isMobile && mobileStep === 1 && open && valueInputRef.current) {
      const timer = setTimeout(() => {
        valueInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isMobile, mobileStep, open]);

  // Buscar todas as tags quando a organização for selecionada
  useEffect(() => {
    const loadAllTags = async () => {
      if (!currentOrganizationId) {
        setAvailableCategories([]);
        setAllTagsFromBackend([]);
        return;
      }

      try {
        setLoadingCategories(true);
        // Buscar todas as tags (sem filtro de tipo)
        const response = await listTags(currentOrganizationId);

        // Separar categorias e outras tags
        const allTags = response.tags
          .filter((tag: { is_active: boolean }) => tag.is_active)
          .map((tag: { id: string; name: string; tag_type: { name: string } }) => ({
            id: tag.id,
            type: tag.tag_type.name,
            name: tag.name,
          }));

        setAllTagsFromBackend(allTags);

        // Pegar apenas categorias para os chips (primeiras 5)
        const categoryNames = allTags
          .filter(tag => tag.type === 'categoria')
          .map(tag => tag.name)
          .slice(0, 5);
        setAvailableCategories(categoryNames);
      } catch (err) {
        console.error('Erro ao carregar tags:', err);
        setAvailableCategories([]);
        setAllTagsFromBackend([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadAllTags();
  }, [currentOrganizationId]);

  // Focar no campo valor quando abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        valueInputRef.current?.focus();
      }, 350); // Aguardar animação do sheet
    }
  }, [open]);


  // Carregar organizações ao abrir o sheet
  useEffect(() => {
    if (open) {
      loadOrganizations();
      form.reset({
        organization_id: '',
        type: 'expense',
        description: '',
        category: '',
        value: 0,
        payment_method: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        card_last4: null,
        modality: null,
        installments_count: null,
      });
      setError(null);
      setSaveAndCreateAnother(false);
      setShowSuccess(false);
      setValueDisplay('');
      setTags([]);
      setSelectedCardId(null);
      // Resetar wizard mobile
      if (isMobile) {
        setMobileStep(1);
        setShowTagSelector(false);
      }
      setShowCardCreateForm(false);
      setShowConfirmationDialog(false);
    }
  }, [open]);

  // Carregar dados da transação quando estiver editando
  useEffect(() => {
    if (transactionToEdit && open) {
      const loadTransactionData = async () => {
        // Converter data da API para o formato do input (YYYY-MM-DDTHH:mm)
        const transactionDate = new Date(transactionToEdit.date);
        const formattedDate = format(transactionDate, "yyyy-MM-dd'T'HH:mm");

        // Carregar tags da transação
        // Formato da API: tags é um Record<string, Tag[]> (objeto com chaves sendo nomes de tipos)
        const transactionTags: Array<{ type: string; value: string }> = [];
        if (transactionToEdit.tags) {
          // Se tags é um objeto (Record<string, Tag[]>)
          if (!Array.isArray(transactionToEdit.tags) && typeof transactionToEdit.tags === 'object') {
            Object.entries(transactionToEdit.tags).forEach(([typeName, tagsArray]) => {
              tagsArray.forEach((tag: any) => {
                transactionTags.push({
                  type: typeName,
                  value: tag.name,
                });
              });
            });
          } 
          // Se tags é um array (formato legado)
          else if (Array.isArray(transactionToEdit.tags)) {
            transactionToEdit.tags.forEach((tag: any) => {
              transactionTags.push({
                type: tag.type || tag.tag_type?.name || '',
                value: tag.name,
              });
            });
          }
        }

        // Ignorar o campo 'category' legado - usar apenas tags como fonte da verdade
        // Não precisamos remover tags de categoria, pois elas serão exibidas normalmente

        // Carregar dados do cartão de crédito se houver
        // O backend agora retorna credit_card_charge quando payment_method é "Cartão de Crédito" ou "credit_card"
        let cardId: number | null = null;
        let cardLast4: string | null = null;
        let modality: 'cash' | 'installment' | null = null;
        let installmentsCount: number | null = null;

        const isCreditCardPayment = transactionToEdit.payment_method === 'Cartão de Crédito' || 
                                    transactionToEdit.payment_method === 'credit_card';

        // Priorizar credit_card_charge (novo formato do backend)
        if (transactionToEdit.credit_card_charge) {
          cardId = transactionToEdit.credit_card_charge.card.id;
          cardLast4 = transactionToEdit.credit_card_charge.card.last4;
          modality = transactionToEdit.credit_card_charge.charge.modality;
          installmentsCount = transactionToEdit.credit_card_charge.charge.installments_count;
        } 
        // Fallback para campos legados (compatibilidade)
        else if (isCreditCardPayment) {
          cardLast4 = transactionToEdit.card_last4 || null;
          modality = transactionToEdit.modality || null;
          installmentsCount = transactionToEdit.installments_count || null;
          
          // Se temos card_last4 mas não temos cardId, tentar encontrar o cartão
          if (cardLast4 && !cardId) {
            try {
              const cards = await listCreditCards(transactionToEdit.organization_id);
              const cardLast4Normalized = String(cardLast4).trim();
              const matchingCard = cards.find(card => {
                const cardLast4Normalized2 = String(card.last4).trim();
                return cardLast4Normalized2 === cardLast4Normalized;
              });
              if (matchingCard) {
                cardId = matchingCard.id;
              }
            } catch (error) {
              console.error('Erro ao buscar cartões:', error);
            }
          }
        }

        // Resetar formulário com todos os dados
        // Não preencher o campo 'category' - usar apenas tags como fonte da verdade
        form.reset({
          organization_id: transactionToEdit.organization_id,
          type: transactionToEdit.type,
          description: transactionToEdit.description,
          category: '', // Campo legado - não usar, tags são a fonte da verdade
          value: transactionToEdit.value,
          payment_method: transactionToEdit.payment_method,
          date: formattedDate,
          card_last4: cardLast4,
          modality: modality,
          installments_count: installmentsCount,
          recurring: transactionToEdit.recurring || false,
        });

        // Definir tags (incluindo categoria) e cartão selecionado
        setTags(transactionTags);
        setSelectedCardId(cardId);
        
        setValueDisplay(transactionToEdit.value.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }));
      };

      loadTransactionData();
    } else if (!transactionToEdit && open) {
      // Resetar quando não estiver editando
      form.reset({
        organization_id: '',
        type: 'expense',
        description: '',
        category: '',
        value: 0,
        payment_method: '',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        card_last4: null,
        modality: null,
        installments_count: null,
        recurring: false,
      });
      setTags([]);
      setSelectedCardId(null);
      setValueDisplay('');
    }
  }, [transactionToEdit, open, form]);

  const loadOrganizations = async () => {
    try {
      const data = await getMyOrganizations();
      const orgs = data.organizations.map((org) => ({
        id: org.organization.id,
        name: org.organization.name,
      }));
      setOrganizations(orgs);
      // Selecionar automaticamente a primeira organização
      if (orgs.length > 0 && !form.getValues('organization_id')) {
        form.setValue('organization_id', orgs[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar organizações:', err);
    }
  };

  const onSubmit = useCallback(async (values: TransactionFormValues) => {
    try {
      setLoading(true);
      setError(null);
      setShowConfirmationDialog(false);

      // Processar tags: buscar IDs existentes ou criar novas tags
      // Tags são a fonte da verdade - processar todas as tags do estado, incluindo categoria
      const tagIds: string[] = [];

      // Processar todas as tags (incluindo categoria que agora é apenas mais uma tag)
      for (const tag of tags) {
        if (!tag.value || tag.value.trim() === '') {
          continue; // Ignorar tags vazias
        }

        const existingTag = allTagsFromBackend.find(
          t => t.type.toLowerCase() === tag.type.toLowerCase() &&
            t.name.toLowerCase() === tag.value.toLowerCase()
        );

        if (existingTag) {
          // Evitar duplicatas
          if (!tagIds.includes(existingTag.id)) {
            tagIds.push(existingTag.id);
          }
        } else {
          // Criar nova tag se não existir
          const tagType = tagTypesFromBackend.find(
            tt => tt.name.toLowerCase() === tag.type.toLowerCase()
          );

          if (tagType) {
            try {
              const newTag = await createTag(
                values.organization_id,
                tag.value,
                tagType.id
              );
              tagIds.push(newTag.id);
            } catch (createTagError) {
              console.error(`Erro ao criar tag ${tag.value}:`, createTagError);
              // Continuar mesmo se falhar ao criar tag, para não bloquear a transação
            }
          }
        }
      }

      // Garantir que value seja um número
      const numericValue = typeof values.value === 'number' 
        ? values.value 
        : (values.value ? Number(String(values.value).replace(',', '.')) : 0);

      // Preparar dados base da transação
      const baseTransactionData = {
        organization_id: values.organization_id,
        type: values.type,
        description: values.description,
        // Não enviar category - tags são a fonte da verdade
        category: '', // Campo legado - sempre vazio
        value: numericValue,
        payment_method: values.payment_method,
        tag_ids: tagIds,
        recurring: values.recurring || false, // Marcador de recorrência para previsões
        ...(values.payment_method === 'Cartão de Crédito' && {
          card_last4: values.card_last4 || null,
          modality: values.modality || null,
          installments_count: values.modality === 'installment' ? values.installments_count || null : null,
        }),
      };

      // Garantir que date está no formato datetime correto (YYYY-MM-DDTHH:MM)
      // O DateTimeInput já retorna no formato correto, mas garantimos que está completo
      let dateValue = values.date;
      if (!dateValue.includes('T')) {
        // Se não tiver hora, adicionar 00:00
        dateValue = `${dateValue}T00:00`;
      } else if (dateValue.split('T')[1].split(':').length === 2) {
        // Se já tiver HH:MM, está correto
        dateValue = dateValue;
      } else {
        // Se tiver HH:MM:SS, remover os segundos para manter apenas HH:MM
        dateValue = dateValue.substring(0, 16);
      }

      if (transactionToEdit) {
        // Para atualização, incluir date no formato datetime (REQUIRED conforme documentação)
        const updateTransactionData = {
          ...baseTransactionData,
          date: dateValue, // datetime completo: YYYY-MM-DDTHH:MM
        };
        await updateTransaction(transactionToEdit.id, transactionToEdit.organization_id, updateTransactionData);
      } else {
        // Para criação, incluir date no formato datetime
        const createTransactionData: CreateTransactionRequest = {
          ...baseTransactionData,
          date: dateValue, // datetime completo: YYYY-MM-DDTHH:MM
        };
        await createTransaction(createTransactionData);
      }
      setShowSuccess(true);
      setLoading(false);
      // Invalidar cache imediatamente para atualizar a lista, mas não fechar o painel
      onInvalidateCache?.();
      // onSuccess será chamado quando o usuário fechar o painel após ver a mensagem de sucesso
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(typeof errorMessage === 'string' ? errorMessage : String(errorMessage));
      setLoading(false);
    }
  }, [tags, allTagsFromBackend, tagTypesFromBackend, transactionToEdit]);

  // Função para confirmar transação (usada no botão e no Enter)
  const handleConfirm = useCallback(() => {
    setSaveAndCreateAnother(false);
    form.handleSubmit(onSubmit)();
  }, [form, onSubmit]);

  // Capturar eventos de teclado quando o modal de confirmação estiver aberto
  useEffect(() => {
    if (!showConfirmationDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!loading) {
          handleConfirm();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfirmationDialog(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showConfirmationDialog, loading, handleConfirm]);

  // Função para gerar texto dinâmico do botão de salvar
  const getSaveButtonText = () => {
    const type = form.watch('type');
    const value = form.watch('value');
    const typeLabel = type === 'expense' ? 'Despesa' : 'Receita';
    // Garantir que value seja um número
    const numericValue = typeof value === 'number' ? value : (value ? Number(value) : 0);
    const valueFormatted = numericValue > 0 ? numericValue.toFixed(2).replace('.', ',') : '0,00';
    return `Salvar ${typeLabel} de R$ ${valueFormatted}`;
  };

  // Função para lidar com o clique no botão de salvar (abre modal de confirmação)
  const handleSaveClick = () => {
    // Validar formulário antes de abrir o modal
    form.trigger().then((isValid) => {
      if (isValid) {
        setShowConfirmationDialog(true);
      } else {
        // Se houver erros, fazer scroll para o primeiro erro
        if (isMobile) {
          // Aguardar um pouco para o DOM atualizar com as mensagens de erro
          setTimeout(() => {
            // Procurar pela primeira mensagem de erro visível (tentar múltiplos seletores)
            let errorMessage: Element | null = null;
            
            // Tentar diferentes seletores
            errorMessage = document.querySelector('[role="alert"]') ||
                          document.querySelector('.text-destructive') ||
                          document.querySelector('.text-red-600') ||
                          document.querySelector('.text-red-400') ||
                          document.querySelector('p.text-sm.text-red-600') ||
                          document.querySelector('p.text-sm.text-red-400');
            
            if (!errorMessage) {
              // Procurar por qualquer elemento com texto de erro
              const allElements = document.querySelectorAll('p, span, div');
              Array.from(allElements).some((el) => {
                const text = el.textContent || '';
                if (text.includes('deve ter') || text.includes('Selecione') || text.includes('obrigatório')) {
                  errorMessage = el;
                  return true;
                }
                return false;
              });
            }
            
            if (errorMessage) {
              // Fazer scroll no container scrollável da etapa 2 (procurar pelo container correto)
              const step2Container = document.querySelector('[data-step="2"]') || 
                                    document.querySelector('.absolute.inset-0.flex.flex-col.overflow-y-auto') ||
                                    errorMessage.closest('.overflow-y-auto') ||
                                    errorMessage.closest('.flex.flex-col');
              
              if (step2Container && step2Container instanceof HTMLElement) {
                // Calcular posição relativa ao container
                const containerRect = step2Container.getBoundingClientRect();
                const errorRect = errorMessage.getBoundingClientRect();
                const scrollTop = step2Container.scrollTop;
                const relativeTop = errorRect.top - containerRect.top + scrollTop;
                
                step2Container.scrollTo({
                  top: Math.max(0, relativeTop - 100), // 100px de margem superior
                  behavior: 'smooth'
                });
              } else {
                // Fallback: scroll direto no elemento usando scrollIntoView
                errorMessage.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center',
                  inline: 'nearest'
                });
              }
              
              // Destacar visualmente o campo com erro
              const formItem = errorMessage.closest('.space-y-2, .space-y-6, [class*="FormItem"]');
              if (formItem) {
                const input = formItem.querySelector('input, textarea, select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
                if (input) {
                  input.focus();
                  input.classList.add('ring-2', 'ring-red-500');
                  setTimeout(() => {
                    input.classList.remove('ring-2', 'ring-red-500');
                  }, 2000);
                } else {
                  // Se não houver input, destacar o botão ou área relacionada
                  const button = formItem.querySelector('button');
                  if (button) {
                    button.classList.add('ring-2', 'ring-red-500', 'border-red-500');
                    setTimeout(() => {
                      button.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
                    }, 2000);
                  }
                }
              }
            }
          }, 200);
        }
      }
    });
  };

  const handleCreateAnother = () => {
    setShowSuccess(false);
    setValueDisplay('');
    setTags([]);
    setSelectedCardId(null);
    setShowCardCreateForm(false);
    form.reset({
      organization_id: form.getValues('organization_id'),
      type: form.getValues('type'),
      description: '',
      category: '',
      value: 0,
      payment_method: '',
      date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      card_last4: null,
      modality: null,
      installments_count: null,
    });
    setTimeout(() => {
      valueInputRef.current?.focus();
    }, 100);
  };

  // Funções para gerenciar tags
  // Aceitar string para suportar tanto TagType quanto tipos do backend
  const handleToggleTag = (tagType: TagType | string, value: string) => {
    // Verificar se já existe uma tag deste tipo com este valor
    const existingTagIndex = tags.findIndex(t => t.type === tagType && t.value === value);

    if (existingTagIndex !== -1) {
      // Se existe, remover (toggle off)
      setTags(tags.filter((_, index) => index !== existingTagIndex));
    } else {
      // Se não existe, adicionar (toggle on)
      // Verificar se já existe uma tag deste tipo (para substituir se for single-select, ou adicionar se for multi-select)
      // Por enquanto, assumindo comportamento de adicionar/substituir baseado na existência
      // Se quisermos permitir múltiplas tags do mesmo tipo, apenas adicionamos
      // Se quisermos apenas uma tag por tipo, substituímos

      // Comportamento atual: permite múltiplas tags do mesmo tipo se forem valores diferentes
      setTags([...tags, { type: tagType, value }]);
    }
  };

  const handleTagValueChange = (tagType: TagType | string, value: string | null) => {
    setTags(tags.map(t => t.type === tagType ? { ...t, value: value || '' } : t));
  };

  const handleRemoveTag = (tagType: TagType | string) => {
    setTags(tags.filter(t => t.type !== tagType));
  };

  const handleClose = () => {
    setShowSuccess(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const showCardManagement = paymentMethod === 'Cartão de Crédito' && type === 'expense';
  const organizationId = form.watch('organization_id');

  // Fechar painel de classificação automaticamente quando Área de Ferramentas Contextuais for acionada
  // Regra da "Ferramenta Única": os estados são mutuamente exclusivos
  // O painel deve fechar completamente antes que a ferramenta de cartão apareça
  useEffect(() => {
    if (showCardManagement) {
      // Sempre fechar o painel quando a ferramenta de cartão for ativada
      // Isso garante que apenas um estado esteja ativo por vez
      setIsClassificationPanelOpen(false);
    }
  }, [showCardManagement]);

  // Função para gerar resumo da transação para o modal de confirmação
  const getTransactionSummary = () => {
    const values = form.getValues();
    const typeLabel = values.type === 'expense' ? 'Despesa' : 'Receita';
    // Garantir que value seja um número
    const numericValue = typeof values.value === 'number' ? values.value : (values.value ? Number(values.value) : 0);
    const valueFormatted = numericValue > 0 ? numericValue.toFixed(2).replace('.', ',') : '0,00';
    const dateFormatted = values.date ? format(new Date(values.date), "dd/MM/yyyy 'às' HH:mm") : 'Não informado';

    return {
      type: typeLabel,
      value: valueFormatted,
      description: values.description || 'Não informado',
      category: values.category || 'Não informado',
      paymentMethod: values.payment_method || 'Não informado',
      date: dateFormatted,
      modality: values.modality === 'cash' ? 'À vista' : values.modality === 'installment' ? 'Parcelado' : null,
      installments: values.installments_count || null,
      tags: tags.filter(t => t.value).map(t => `${t.type}: ${t.value}`),
    };
  };

  // Limpar erro quando o usuário começar a editar
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Limpar erro quando qualquer campo for alterado
      if (error && name) {
        setError(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, error]);

  const handleSheetOpenChange = (newOpen: boolean) => {
    // Só permitir fechar se não estiver processando e não estiver em estado de sucesso
    if (!newOpen && !loading && !showSuccess) {
      // Resetar wizard mobile quando fechar
      if (isMobile) {
        setMobileStep(1);
        setShowTagSelector(false);
      }
      // Limpar erro ao fechar
      setError(null);
      onOpenChange(false);
    } else if (!newOpen && !loading && showSuccess) {
      // Se estiver em sucesso, permitir fechar clicando fora
      setShowSuccess(false);
      if (isMobile) {
        setMobileStep(1);
        setShowTagSelector(false);
      }
      // Limpar erro ao fechar
      setError(null);
      onOpenChange(false);
      onSuccess?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          isMobile 
            ? "!h-[100vh] !max-h-[100vh] !w-full !max-w-full rounded-t-2xl overflow-hidden p-0 [&>button]:hidden z-50 [&_div[data-radix-dialog-overlay]]:bg-black/40"
            : "!w-[1000px] !max-w-[1000px] overflow-hidden p-8 [&>button]:hidden z-50 [&_div[data-radix-dialog-overlay]]:bg-black/40 bg-white dark:bg-gray-950"
        )}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn("h-full relative", isMobile && "bg-white dark:bg-gray-950")}
        >
          {isMobile ? (
            // Versão Mobile: Wizard em etapas
            <div className="flex flex-col h-full bg-white dark:bg-gray-950">
              {/* Header Mobile fixo no topo */}
              <div
                className="sticky top-0 z-50 shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-950"
                // Altura visual do header em mobile (~56px) + safe-area quando existir.
                // Este offset garante que o header apareça corretamente em devices como o seu Poco.
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
              >
                <div className="flex items-center justify-between gap-2 px-4 py-2">
                  {mobileStep === 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileStep(1)}
                      className="h-8 w-8 p-0 text-slate-600"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <SheetTitle
                    className={cn(
                      "text-base font-semibold text-slate-900",
                      mobileStep === 2 && "flex-1 text-center"
                    )}
                  >
                    {mobileStep === 1 
                      ? transactionToEdit 
                        ? 'Atualizar Transação'
                        : (type === 'expense' ? 'Nova Despesa' : 'Nova Receita')
                      : 'Detalhes'
                    }
                  </SheetTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 w-8 p-0 text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Feedback de Erro */}
              {error && (
                <div className="px-4 py-2">
                  <Alert variant="destructive">
                    <AlertDescription>{typeof error === 'string' ? error : String(error)}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Conteúdo do Wizard */}
              <div className="flex-1 min-h-0 overflow-hidden relative">
                {/* Estado de Sucesso (Mobile) */}
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm flex items-center justify-center"
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="text-center space-y-6 px-6 w-full max-w-sm"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring' }}
                          className="mx-auto w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
                        >
                          <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                        </motion.div>
                        <div>
                          <h3 className="text-2xl font-bold mb-2">
                            {transactionToEdit ? 'Transação atualizada com sucesso!' : 'Transação salva com sucesso!'}
                          </h3>
                          <p className="text-muted-foreground">
                            {transactionToEdit ? 'As alterações foram salvas com sucesso.' : 'Sua transação foi registrada.'}
                          </p>
                        </div>
                        <div className="flex flex-col gap-3 pt-4">
                          {!transactionToEdit && (
                            <Button
                              type="button"
                              onClick={handleCreateAnother}
                              variant="primary"
                              className="w-full"
                            >
                              Criar Nova Transação
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            className="w-full"
                          >
                            Fechar
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {mobileStep === 1 ? (
                    <motion.div
                      key="step1"
                      initial={{ x: 0, opacity: 1 }}
                      exit={{ x: -100, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 flex flex-col overflow-y-auto"
                    >
                      {/* Etapa 1: Valor e Tipo */}
                      <Form {...form}>
                        <div className="flex flex-col min-h-full">
                          {/* Seletores de Tipo - sempre visíveis, mesmo com scroll/teclado */}
                          <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-gray-950">
                            <FormField
                              control={form.control}
                              name="type"
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <FormControl>
                                    <div className="grid grid-cols-2 gap-3">
                                      <Button
                                        type="button"
                                        variant={field.value === 'expense' ? 'default' : 'outline'}
                                        onClick={() => {
                                          field.onChange('expense');
                                          form.setValue('payment_method', '');
                                        }}
                                        className={cn(
                                          "h-14 text-base font-semibold",
                                          field.value === 'expense' && "bg-rose-500 hover:bg-rose-600 text-white"
                                        )}
                                      >
                                        <TrendingDown className="h-5 w-5 mr-2" />
                                        Despesa
                                      </Button>
                                      <Button
                                        type="button"
                                        variant={field.value === 'income' ? 'default' : 'outline'}
                                        onClick={() => {
                                          field.onChange('income');
                                          form.setValue('payment_method', '');
                                        }}
                                        className={cn(
                                          "h-14 text-base font-semibold",
                                          field.value === 'income' && "bg-emerald-500 hover:bg-emerald-600 text-white"
                                        )}
                                      >
                                        <TrendingUp className="h-5 w-5 mr-2" />
                                        Receita
                                      </Button>
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Campo Valor Herói - área rolável, centralizada verticalmente quando possível */}
                          <div className="flex-1 flex flex-col px-6 pb-6">
                            <div className="flex-1 flex items-center justify-center">
                              <FormField
                                control={form.control}
                                name="value"
                                render={({ field }) => (
                                  <FormItem className="w-full">
                                    <FormControl>
                                      <div className="relative w-full">
                                        <input
                                          ref={valueInputRef}
                                          type="tel"
                                          inputMode="decimal"
                                        placeholder="0,00"
                                        value={valueDisplay}
                                        onChange={(e) => {
                                          const rawValue = e.target.value.replace(/[^\d]/g, '');
                                          if (rawValue === '') {
                                            setValueDisplay('');
                                            field.onChange(0);
                                            return;
                                          }
                                          const numericValue = parseInt(rawValue, 10) / 100;
                                          field.onChange(numericValue);
                                          setValueDisplay(
                                            numericValue.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })
                                          );
                                        }}
                                        onFocus={() => {
                                          if (valueInputRef.current) {
                                            valueInputRef.current.select();
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            // Apenas "confirma" o valor atual e minimiza o teclado,
                                            // sem avançar automaticamente para a próxima etapa.
                                            e.preventDefault();
                                            if (valueInputRef.current) {
                                              valueInputRef.current.blur();
                                            }
                                          }
                                        }}
                                        className="w-full text-center text-6xl font-bold bg-transparent border-0 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                      />
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-6xl font-bold text-gray-400 pointer-events-none">
                                          R$
                                        </span>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Botão Continuar */}
                            <div className="shrink-0 pt-4">
                              <Button
                                type="button"
                                onClick={() => {
                                  form.trigger(['type', 'value']).then((isValid) => {
                                    if (isValid) {
                                      setMobileStep(2);
                                    }
                                  });
                                }}
                                disabled={loading || !form.watch('value') || form.watch('value') <= 0}
                                className="w-full h-14 text-base font-semibold"
                                variant="primary"
                              >
                                Continuar →
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step2"
                      data-step="2"
                      initial={{ x: 100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 100, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 flex flex-col overflow-y-auto"
                    >
                      {/* Etapa 2: Detalhes e Classificação */}
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col p-6 space-y-6">
                          {/* Feedback de Erro (Step 2) */}
                          {error && (
                            <Alert variant="destructive">
                              <AlertDescription>{typeof error === 'string' ? error : String(error)}</AlertDescription>
                            </Alert>
                          )}

                          {/* Descrição */}
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-semibold">O que foi?</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Ex: Almoço no restaurante"
                                    disabled={loading}
                                    className="h-12 text-base"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Bandeja de Sugestões Rápidas */}
                          {(() => {
                            const selectedCategory = form.watch('category');
                            // Filtrar a categoria selecionada das sugestões rápidas para evitar redundância
                            const quickSuggestions = availableCategories
                              .filter(cat => cat !== selectedCategory)
                              .slice(0, 4);
                            
                            return quickSuggestions.length > 0 && (
                              <div className="space-y-2">
                                <FormLabel className="text-sm font-semibold">Sugestões Rápidas</FormLabel>
                                <div className="flex flex-wrap gap-2">
                                  {quickSuggestions.map((category) => (
                                    <button
                                      key={category}
                                      type="button"
                                      onClick={() => {
                                        form.setValue('category', category);
                                      }}
                                      className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
                                    >
                                      {category}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Campo de Categoria (oculto mas necessário para validação) */}
                          <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem className="hidden">
                                <FormControl>
                                  <input type="hidden" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Botão Adicionar Categoria ou Tag */}
                          <div className="space-y-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowTagSelector(true)}
                              className="w-full h-12 text-base border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Categoria ou Tag
                            </Button>
                            {/* Mensagem de erro da categoria */}
                            {form.formState.errors.category && (
                              <p className="text-sm text-red-600 dark:text-red-400 px-1">
                                {form.formState.errors.category.message}
                              </p>
                            )}
                          </div>

                          {/* Classificação Selecionada (Tags - fonte da verdade) */}
                          {tags.filter(t => t.value).length > 0 && (
                            <div className="space-y-2">
                              <FormLabel className="text-sm font-semibold">Classificação Selecionada</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {/* Chips das Tags (tags são a fonte da verdade, ignorar campo category legado) */}
                                {tags.filter(t => t.value).map((tag, idx) => {
                                  const config = getTagTypeConfig(tag.type);
                                  return (
                                    <span
                                      key={`tag-${tag.type}-${idx}`}
                                      className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium flex items-center gap-2"
                                    >
                                      <span className="text-xs">{config.emoji}</span>
                                      {tag.value}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag.type)}
                                        className="hover:text-purple-900 dark:hover:text-purple-100 ml-1"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Método de Pagamento */}
                          <div className="space-y-2">
                            <FormLabel className="text-sm font-semibold">Pagamento</FormLabel>
                            <FormField
                              control={form.control}
                              name="payment_method"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <div className="grid grid-cols-2 gap-2">
                                      {commonPaymentMethods
                                        .filter(method => {
                                          if (type === 'income') {
                                            return ['PIX', 'Dinheiro', 'Transferência Bancária'].includes(method.value);
                                          }
                                          return method.value !== 'Transferência Bancária';
                                        })
                                        .map((method) => {
                                          const Icon = method.icon;
                                          return (
                                            <Button
                                              key={method.value}
                                              type="button"
                                              variant={field.value === method.value ? 'default' : 'outline'}
                                              onClick={() => {
                                                field.onChange(method.value);
                                                if (method.value !== 'Cartão de Crédito') {
                                                  form.setValue('card_last4', null);
                                                  form.setValue('modality', null);
                                                  form.setValue('installments_count', null);
                                                  setSelectedCardId(null);
                                                }
                                              }}
                                              className={cn(
                                                "h-12 text-sm font-medium transition-all",
                                                field.value === method.value 
                                                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg" 
                                                  : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                              )}
                                            >
                                              <Icon className="h-4 w-4 mr-2" />
                                              {method.label}
                                            </Button>
                                          );
                                        })}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Campos de Cartão de Crédito (Mobile) */}
                          {paymentMethod === 'Cartão de Crédito' && type === 'expense' && organizationId && (
                            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                              <h4 className="font-medium text-sm">Informações do Cartão</h4>
                              
                              {/* Seletor de Cartão */}
                              <CardSelector
                                organizationId={organizationId}
                                selectedCardId={selectedCardId}
                                onCardSelect={(cardId, card) => {
                                  setSelectedCardId(cardId);
                                  if (card) {
                                    form.setValue('card_last4', card.last4);
                                  }
                                }}
                                disabled={loading}
                              />

                              {/* Modalidade */}
                              <FormField
                                control={form.control}
                                name="modality"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-semibold">Modalidade</FormLabel>
                                    <FormControl>
                                      <div className="grid grid-cols-2 gap-2">
                                        <Button
                                          type="button"
                                          variant={field.value === 'cash' ? 'default' : 'outline'}
                                          onClick={() => {
                                            field.onChange('cash');
                                            form.setValue('installments_count', null);
                                          }}
                                          className={cn(
                                            "h-12 transition-all",
                                            field.value === 'cash'
                                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                                              : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          )}
                                        >
                                          À vista
                                        </Button>
                                        <Button
                                          type="button"
                                          variant={field.value === 'installment' ? 'default' : 'outline'}
                                          onClick={() => field.onChange('installment')}
                                          className={cn(
                                            "h-12 transition-all",
                                            field.value === 'installment'
                                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg"
                                              : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          )}
                                        >
                                          Parcelado
                                        </Button>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {/* Número de Parcelas (se parcelado) */}
                              {form.watch('modality') === 'installment' && (
                                <FormField
                                  control={form.control}
                                  name="installments_count"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-semibold">Número de Parcelas</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="1"
                                          max="24"
                                          placeholder="Ex: 3"
                                          {...field}
                                          value={field.value || ''}
                                          onChange={(e) => {
                                            const value = e.target.value ? parseInt(e.target.value, 10) : null;
                                            field.onChange(value);
                                          }}
                                          disabled={loading}
                                          className="h-12"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          )}

                          {/* Recorrência */}
                          <FormField
                            control={form.control}
                            name="recurring"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={loading}
                                    id="recurring-checkbox-mobile"
                                  />
                                </FormControl>
                                <div className="space-y-0 leading-none flex items-center gap-2">
                                  <Label
                                    htmlFor="recurring-checkbox-mobile"
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    Esta transação é recorrente?
                                  </Label>
                                  <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs">
                                          Marque esta opção para que a transação seja considerada em <strong>análises e previsões futuras</strong>, como seu <strong>fluxo de caixa</strong>.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </FormItem>
                            )}
                          />

                          {/* Data e Hora */}
                          <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-semibold">Data e Hora</FormLabel>
                                <FormControl>
                                  <DateTimeInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={loading}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Botão Salvar */}
                          <div className="shrink-0 pb-6 pt-4">
                            <Button
                              type="button"
                              onClick={handleSaveClick}
                              disabled={loading}
                              className="w-full h-14 text-base font-semibold"
                              variant="primary"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                'Salvar Transação'
                              )}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            // Versão Desktop: Layout original
            <div className="flex flex-col h-full">
            {/* Estado de Sucesso */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm flex items-center justify-center rounded-l-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="text-center space-y-6 px-6"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring' }}
                      className="mx-auto w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
                    >
                      <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">
                        {transactionToEdit ? 'Transação atualizada com sucesso!' : 'Transação salva com sucesso!'}
                      </h3>
                      <p className="text-muted-foreground">
                        {transactionToEdit ? 'As alterações foram salvas com sucesso.' : 'Sua transação foi registrada.'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 pt-4">
                      {!transactionToEdit && (
                        <Button
                          type="button"
                          onClick={handleCreateAnother}
                          variant="primary"
                          className="w-full"
                        >
                          Criar Nova Transação
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        className="w-full"
                      >
                        Fechar
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col overflow-hidden">
                {/* Header */}
                <div className="shrink-0 mb-6">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-bold">
                      {transactionToEdit ? 'Atualizar Transação' : 'Nova Transação'}
                    </SheetTitle>
                  </SheetHeader>

                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertDescription>{typeof error === 'string' ? error : String(error)}</AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Layout de Duas Colunas com CSS Grid - 50/50 */}
                <div className="flex-1 grid grid-cols-2 gap-8 min-h-0 overflow-hidden pr-1">
                  {/* Coluna Esquerda: O Palco (Fluxo Principal) */}
                  <div className="flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 space-y-3 min-h-0 pr-1 overflow-y-auto pl-2">

                      {/* Tipo de Transação - ToggleGroup */}
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                              Tipo
                            </FormLabel>
                            <FormControl>
                              <ToggleGroup
                                type="single"
                                value={field.value}
                                onValueChange={(value) => {
                                  if (value) {
                                    field.onChange(value as 'income' | 'expense');
                                    const validForBothTypes = ['PIX', 'Dinheiro', 'Transferência Bancária'];
                                    const currentMethod = form.getValues('payment_method');
                                    if (currentMethod && !validForBothTypes.includes(currentMethod)) {
                                      form.setValue('payment_method', '');
                                      form.setValue('card_last4', null);
                                      form.setValue('modality', null);
                                      form.setValue('installments_count', null);
                                      setSelectedCardId(null);
                                    }
                                  }
                                }}
                                className="w-full"
                              >
                                <ToggleGroupItem
                                  value="expense"
                                  aria-label="Despesa"
                                  className={cn(
                                    'flex-1 h-12 rounded-lg font-semibold text-sm',
                                    'data-[state=on]:bg-rose-500 data-[state=on]:text-white',
                                    'data-[state=off]:bg-transparent data-[state=off]:text-rose-500 data-[state=off]:border-2 data-[state=off]:border-rose-200'
                                  )}
                                >
                                  <TrendingDown className="h-4 w-4" />
                                  Despesa
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                  value="income"
                                  aria-label="Receita"
                                  className={cn(
                                    'flex-1 h-12 rounded-lg font-semibold text-sm',
                                    'data-[state=on]:bg-emerald-500 data-[state=on]:text-white',
                                    'data-[state=off]:bg-transparent data-[state=off]:text-emerald-500 data-[state=off]:border-2 data-[state=off]:border-emerald-200'
                                  )}
                                >
                                  <TrendingUp className="h-4 w-4" />
                                  Receita
                                </ToggleGroupItem>
                              </ToggleGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Valor - Campo Herói */}
                      <FormField
                        control={form.control}
                        name="value"
                        render={({ field }) => {
                          // Observar valores para calcular legenda de parcelas
                          const paymentMethod = useWatch({ control: form.control, name: 'payment_method' });
                          const modality = useWatch({ control: form.control, name: 'modality' });
                          const installmentsCount = useWatch({ control: form.control, name: 'installments_count' });
                          // Garantir que transactionValue seja um número
                          const transactionValue = typeof field.value === 'number' ? field.value : (field.value ? Number(field.value) : 0);

                          // Calcular se deve mostrar a legenda
                          const showInstallmentLegend =
                            paymentMethod === 'Cartão de Crédito' &&
                            modality === 'installment' &&
                            installmentsCount &&
                            installmentsCount > 0 &&
                            transactionValue > 0;

                          // Garantir que transactionValue e installmentsCount sejam números
                          const numericTransactionValue = typeof transactionValue === 'number' ? transactionValue : (transactionValue ? Number(transactionValue) : 0);
                          const numericInstallmentsCount = typeof installmentsCount === 'number' ? installmentsCount : (installmentsCount ? Number(installmentsCount) : 0);
                          const installmentValue = showInstallmentLegend && numericInstallmentsCount > 0
                            ? numericTransactionValue / numericInstallmentsCount
                            : 0;

                          return (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                                Valor (R$)
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <input
                                    ref={valueInputRef}
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    className={cn(
                                      "flex w-full rounded-lg bg-gray-50 dark:bg-gray-900 text-3xl font-bold text-right border-0 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white dark:focus:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 pr-4 pl-14",
                                      showInstallmentLegend ? "pb-8 pt-3" : "py-3"
                                    )}
                                    style={{ fontSize: '2rem', lineHeight: '1.2' }}
                                    value={valueDisplay}
                                    onChange={(e) => {
                                      // Remove tudo exceto números e vírgula
                                      let inputValue = e.target.value.replace(/[^\d,]/g, '');

                                      // Permite apenas uma vírgula
                                      const commaCount = (inputValue.match(/,/g) || []).length;
                                      if (commaCount > 1) {
                                        inputValue = inputValue.replace(/,/g, '').replace(/(\d+)/, '$1,');
                                      }

                                      // Limita a 2 casas decimais após a vírgula
                                      if (inputValue.includes(',')) {
                                        const parts = inputValue.split(',');
                                        if (parts[1] && parts[1].length > 2) {
                                          inputValue = parts[0] + ',' + parts[1].substring(0, 2);
                                        }
                                      }

                                      setValueDisplay(inputValue);

                                      // Converte para número e atualiza o form
                                      const numericValue = inputValue.replace(',', '.');
                                      const parsed = parseFloat(numericValue) || 0;
                                      field.onChange(parsed);
                                    }}
                                    onFocus={(e) => {
                                      // Se o valor for 0, limpa o display para permitir digitação
                                      if (field.value === 0) {
                                        setValueDisplay('');
                                        e.target.select();
                                      } else {
                                        // Mostra o valor formatado sem vírgula fixa para edição
                                        setValueDisplay(field.value.toString().replace('.', ','));
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Ao perder foco, formata com 2 casas decimais
                                      const numericValue = typeof field.value === 'number' ? field.value : (field.value ? Number(field.value) : 0);
                                      if (numericValue > 0) {
                                        setValueDisplay(numericValue.toFixed(2).replace('.', ','));
                                      } else {
                                        setValueDisplay('');
                                      }
                                      field.onBlur();
                                    }}
                                    disabled={loading}
                                  />
                                  <span
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground pointer-events-none font-bold"
                                    style={{ fontSize: '2rem', lineHeight: '1.2' }}
                                  >
                                    R$
                                  </span>

                                  {/* Legenda de parcelas dentro do input, abaixo do valor */}
                                  {showInstallmentLegend && (
                                    <span
                                      className="absolute right-4 bottom-2 text-xs font-medium text-gray-500 dark:text-gray-500 pointer-events-none"
                                    >
                                      em {installmentsCount}x de R$ {installmentValue.toFixed(2).replace('.', ',')}
                                    </span>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      {/* Organização - Oculto por padrão */}
                      <FormField
                        control={form.control}
                        name="organization_id"
                        render={({ field }) => (
                          <FormItem className="hidden">
                            <FormControl>
                              <SearchableSelect
                                value={field.value}
                                onValueChange={field.onChange}
                                options={organizations.map((org) => ({
                                  value: org.id,
                                  label: org.name,
                                }))}
                                placeholder="Selecione uma organização"
                                disabled={loading}
                                searchPlaceholder="Buscar organização..."
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Descrição */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                              O que foi?
                            </FormLabel>
                            <FormControl>
                              <input
                                type="text"
                                placeholder="Ex: Almoço no restaurante"
                                {...field}
                                disabled={loading}
                                className="flex w-full rounded-lg bg-gray-50 dark:bg-gray-900 px-4 py-3 text-base border-0 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white dark:focus:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                onBlur={field.onBlur}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Seção de Pagamento */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                          Pagamento
                        </h3>

                        <FormField
                          control={form.control}
                          name="payment_method"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <ToggleGroup
                                  type="single"
                                  value={field.value}
                                  onValueChange={(value) => {
                                    if (value) {
                                      field.onChange(value);
                                      if (value !== 'Cartão de Crédito') {
                                        form.setValue('card_last4', null);
                                        form.setValue('modality', null);
                                        form.setValue('installments_count', null);
                                        setSelectedCardId(null);
                                      }
                                    }
                                  }}
                                  className="flex flex-wrap gap-2"
                                >
                                  {commonPaymentMethods
                                    .filter(method => {
                                      // Para Receita, mostrar apenas PIX, Dinheiro e Transferência Bancária
                                      if (type === 'income') {
                                        return ['PIX', 'Dinheiro', 'Transferência Bancária'].includes(method.value);
                                      }
                                      // Para Despesa, mostrar todos os métodos exceto Transferência Bancária (que só aparece para Receita)
                                      return method.value !== 'Transferência Bancária';
                                    })
                                    .map((method) => {
                                      const Icon = method.icon;
                                      return (
                                        <ToggleGroupItem
                                          key={method.value}
                                          value={method.value}
                                          aria-label={method.label}
                                          disabled={loading}
                                          className={cn(
                                            'flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all duration-200',
                                            'shadow-sm',
                                            // Estado ativo - gradientes vibrantes por método
                                            method.value === 'PIX' && 'data-[state=on]:bg-gradient-to-r data-[state=on]:from-purple-500 data-[state=on]:to-pink-500 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:shadow-purple-500/30',
                                            method.value === 'Dinheiro' && 'data-[state=on]:bg-gradient-to-r data-[state=on]:from-emerald-500 data-[state=on]:to-teal-500 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:shadow-emerald-500/30',
                                            method.value === 'Cartão de Crédito' && 'data-[state=on]:bg-gradient-to-r data-[state=on]:from-blue-500 data-[state=on]:to-cyan-500 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:shadow-blue-500/30',
                                            method.value === 'Cartão de Débito' && 'data-[state=on]:bg-gradient-to-r data-[state=on]:from-indigo-500 data-[state=on]:to-purple-500 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:shadow-indigo-500/30',
                                            method.value === 'Boleto' && 'data-[state=on]:bg-gradient-to-r data-[state=on]:from-orange-500 data-[state=on]:to-red-500 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:shadow-orange-500/30',
                                            method.value === 'Transferência Bancária' && 'data-[state=on]:bg-gradient-to-r data-[state=on]:from-slate-500 data-[state=on]:to-gray-500 data-[state=on]:text-white data-[state=on]:shadow-lg data-[state=on]:shadow-slate-500/30',
                                            // Estado inativo - fundo branco com borda sutil
                                            'data-[state=off]:bg-white dark:data-[state=off]:bg-gray-800',
                                            'data-[state=off]:text-gray-700 dark:data-[state=off]:text-gray-300',
                                            'data-[state=off]:border data-[state=off]:border-gray-200 dark:data-[state=off]:border-gray-700',
                                            'data-[state=off]:hover:border-purple-300 dark:data-[state=off]:hover:border-purple-600',
                                            'data-[state=off]:hover:bg-gray-50 dark:data-[state=off]:hover:bg-gray-700',
                                            'data-[state=off]:hover:shadow-md'
                                          )}
                                        >
                                          <Icon className="h-4 w-4" />
                                          {method.label}
                                        </ToggleGroupItem>
                                      );
                                    })}
                                </ToggleGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                              Data e Hora
                            </FormLabel>
                            <FormControl>
                              <DateTimeInput
                                value={field.value}
                                onChange={field.onChange}
                                disabled={loading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Marcador de Recorrência */}
                      <div className="mt-8">
                        <FormField
                          control={form.control}
                          name="recurring"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={loading}
                                  id="recurring-checkbox"
                                />
                              </FormControl>
                              <div className="space-y-0 leading-none flex items-center gap-2">
                                <Label
                                  htmlFor="recurring-checkbox"
                                  className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  Esta transação é recorrente?
                                </Label>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs">
                                        Marque esta opção para que a transação seja considerada em <strong>análises e previsões futuras</strong>, como seu <strong>fluxo de caixa</strong>.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Rodapé Fixo da Coluna Esquerda */}
                    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          onClick={handleSaveClick}
                          disabled={loading}
                          variant="primary"
                          className="w-full h-11"
                        >
                          {getSaveButtonText()}
                        </Button>
                        <Button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            form.trigger().then((isValid) => {
                              if (isValid) {
                                setSaveAndCreateAnother(true);
                                setShowConfirmationDialog(true);
                              }
                            });
                          }}
                          variant="secondary"
                          className="w-full h-11"
                        >
                          Salvar e criar outra
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onOpenChange(false)}
                          disabled={loading}
                          className="w-full h-10"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Os Bastidores (50% do espaço) */}
                  <div className="flex flex-col min-h-0">
                    {/* Zona 1: Área de Classificação "Viva" (Com Layout Inteligente e Scroll Contido) */}
                    <div className={cn(
                      "flex flex-col min-h-0 space-y-3 pr-2",
                      isClassificationPanelOpen
                        ? "flex-1 h-full"
                        : "shrink-0 pb-4 border-b border-slate-200 dark:border-slate-700 max-h-[280px] overflow-y-auto"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase">
                          Classificação
                        </h3>
                        {isClassificationPanelOpen && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsClassificationPanelOpen(false)}
                            className="h-7 px-2 text-xs"
                          >
                            Concluir
                          </Button>
                        )}
                      </div>

                      {/* Prompt de Classificação Unificado */}
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem className={cn(isClassificationPanelOpen && "flex-1 flex flex-col min-h-0")}>
                            <FormMessage className="mb-2" />
                            <FormControl>
                              <div className={cn(isClassificationPanelOpen && "flex-1 flex flex-col min-h-0")}>
                                <ClassificationPrompt
                                  category={field.value || null}
                                  onCategoryChange={(value) => {
                                    // Toggle category: se clicar na mesma, remove
                                    if (field.value === value) {
                                      field.onChange('');
                                      // Remover categoria do estado tags também
                                      setTags(tags.filter(t => {
                                        const typeLower = t.type.toLowerCase();
                                        return !(typeLower === 'categoria' || typeLower === 'category');
                                      }));
                                    } else {
                                      field.onChange(value);
                                      // Atualizar tags: remover categoria antiga e adicionar nova
                                      const categoryTagType = tagTypesFromBackend.find(
                                        tt => tt.name.toLowerCase() === 'categoria' || tt.name.toLowerCase() === 'category'
                                      )?.name.toLowerCase() || 'categoria';
                                      
                                      // Remover categoria antiga (se houver)
                                      const tagsWithoutCategory = tags.filter(t => {
                                        const typeLower = t.type.toLowerCase();
                                        return !(typeLower === 'categoria' || typeLower === 'category');
                                      });
                                      
                                      // Adicionar nova categoria
                                      setTags([...tagsWithoutCategory, { 
                                        type: categoryTagType, 
                                        value 
                                      }]);
                                    }
                                  }}
                                  categories={categories}
                                  tags={tags}
                                  onTagToggle={handleToggleTag}
                                  onTagValueChange={handleTagValueChange}
                                  disabled={loading}
                                  allTagsFromBackend={allTagsFromBackend}
                                  tagTypesFromBackend={tagTypesFromBackend}
                                  onPanelStateChange={setIsClassificationPanelOpen}
                                  isOpen={isClassificationPanelOpen}
                                />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Área de Tags Adicionadas removida para evitar redundância */}
                      {/* As tags selecionadas agora são visualizadas diretamente no ClassificationPrompt */}
                    </div>

                    {/* Zona 2: Área de Conteúdo Dinâmico (Base - "O Slot de Ferramentas") */}
                    {/* Regra da "Ferramenta Única": só renderiza quando o painel de classificação estiver fechado */}
                    {!isClassificationPanelOpen && (
                      <div className="flex-1 min-h-0 overflow-hidden mt-4">
                        <AnimatePresence mode="wait">
                          {showCardManagement && !showCardCreateForm && organizationId && (
                            <motion.div
                              key="card-management"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2 }}
                              className="h-full flex flex-col"
                            >
                              {/* Header Informativo */}
                              <div className="shrink-0 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide uppercase mb-1">
                                  Cartão de Crédito
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-500">
                                  Selecione um cartão ou adicione um novo para configurar a modalidade de pagamento
                                </p>
                              </div>

                              {/* Cena 1: Gerenciamento de Cartão */}
                              <div className="flex-1 min-h-0 overflow-hidden">
                                <CardManagementArea
                                  organizationId={organizationId}
                                  selectedCardId={selectedCardId}
                                  onCardSelect={(cardId, card) => {
                                    setSelectedCardId(cardId);
                                    // Preencher card_last4 quando um cartão é selecionado
                                    if (card && card.last4) {
                                      form.setValue('card_last4', card.last4);
                                    } else if (!cardId) {
                                      form.setValue('card_last4', null);
                                    }
                                  }}
                                  onShowCreateForm={() => setShowCardCreateForm(true)}
                                  form={form}
                                  loading={loading}
                                />
                              </div>
                            </motion.div>
                          )}
                          {showCardManagement && showCardCreateForm && organizationId && (
                            <motion.div
                              key="card-create"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2 }}
                              className="h-full"
                            >
                              {/* Cena 2: Formulário de Novo Cartão */}
                              <CardCreateForm
                                organizationId={organizationId}
                                onCardCreated={(cardId, last4) => {
                                  setSelectedCardId(cardId);
                                  // Preencher card_last4 quando um novo cartão é criado
                                  if (last4) {
                                    form.setValue('card_last4', last4);
                                  }
                                  setShowCardCreateForm(false);
                                }}
                                onCancel={() => setShowCardCreateForm(false)}
                                disabled={loading}
                              />
                            </motion.div>
                          )}
                          {!showCardManagement && (
                            <motion.div
                              key="empty"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="h-full flex items-top justify-center text-sm text-gray-400 dark:text-gray-500"
                            >
                              <p>Selecione um método de pagamento para ver opções adicionais</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>
          )}

          {/* Modal de Confirmação com Overlay sobre o painel (compartilhado entre mobile e desktop) */}
          <AnimatePresence>
            {showConfirmationDialog && (
              <>
                {/* Overlay sobre o painel */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md rounded-l-2xl"
                  onClick={() => setShowConfirmationDialog(false)}
                />

                {/* Modal centralizado dentro do Drawer */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none"
                >
                  <div
                    className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-6 max-w-[500px] w-full pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-5">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                          Por favor, confirme sua transação
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Revise os dados abaixo antes de confirmar
                        </p>
                      </div>

                      <div className="space-y-3">
                        {(() => {
                          const summary = getTransactionSummary();
                          const isIncome = form.getValues('type') === 'income';
                          return (
                            <>
                              {/* Tipo e Valor - Destaque Principal */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center gap-2 mb-1">
                                    {isIncome ? (
                                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                    )}
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tipo</span>
                                  </div>
                                  <p className={cn(
                                    "text-base font-bold",
                                    isIncome
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  )}>
                                    {summary.type}
                                  </p>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                                  <div className="flex items-center gap-2 mb-1">
                                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Valor</span>
                                  </div>
                                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                                    R$ {summary.value}
                                  </p>
                                </div>
                              </div>

                              {/* Descrição */}
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Descrição</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {summary.description}
                                </p>
                              </div>

                              {/* Categoria e Método de Pagamento */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ShoppingBag className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Categoria</span>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {summary.category}
                                  </p>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CreditCard className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pagamento</span>
                                  </div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {summary.paymentMethod}
                                  </p>
                                </div>
                              </div>

                              {/* Data e Hora */}
                              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data e Hora</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {summary.date}
                                </p>
                              </div>

                              {/* Modalidade e Parcelas (se aplicável) */}
                              {(summary.modality || summary.installments) && (
                                <div className="grid grid-cols-2 gap-3">
                                  {summary.modality && (
                                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-center gap-2 mb-2">
                                        <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Modalidade</span>
                                      </div>
                                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                        {summary.modality}
                                      </p>
                                    </div>
                                  )}
                                  {summary.installments && (
                                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Tag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Parcelas</span>
                                      </div>
                                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                        {summary.installments}x
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tags (se houver) */}
                              {summary.tags.length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Tag className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tags</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {summary.tags.map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium border border-purple-200 dark:border-purple-800"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowConfirmationDialog(false)}
                          disabled={loading}
                          className="w-full sm:w-auto"
                        >
                          Editar Dados
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleConfirm}
                          disabled={loading}
                          className="w-full sm:w-auto"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            'Confirmar'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </SheetContent>

      {/* Tela de Seleção de Tags (Mobile) */}
      {isMobile && (
        <Sheet open={showTagSelector} onOpenChange={setShowTagSelector}>
          <SheetContent
            side="bottom"
            className="!h-[90vh] !max-h-[90vh] !w-full !max-w-full rounded-t-2xl overflow-hidden p-0 [&>button]:hidden z-[60]"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                <SheetTitle className="text-lg font-semibold">Adicionar Categoria ou Tag</SheetTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTagSelector(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Conteúdo - Reutiliza ClassificationPrompt */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <Form {...form}>
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="flex-1 flex flex-col min-h-0">
                        <FormControl>
                          <div className="flex-1 flex flex-col min-h-0">
                            <ClassificationPrompt
                              category={field.value || null}
                              onCategoryChange={(value) => {
                                // Toggle: se clicar na mesma categoria, remove
                                if (field.value === value) {
                                  field.onChange('');
                                } else {
                                  field.onChange(value);
                                }
                              }}
                              categories={availableCategories}
                              tags={tags}
                              onTagToggle={handleToggleTag}
                              onTagValueChange={handleTagValueChange}
                              disabled={loading}
                              allTagsFromBackend={allTagsFromBackend}
                              tagTypesFromBackend={tagTypesFromBackend}
                              onPanelStateChange={() => {
                                // Não fazer nada - o painel interno sempre fica aberto nesta tela
                              }}
                              isOpen={true}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </Form>
              </div>

              {/* Footer com botão Concluir */}
              <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-4">
                <Button
                  type="button"
                  onClick={() => setShowTagSelector(false)}
                  className="w-full h-12 text-base font-semibold"
                  variant="primary"
                >
                  Concluir
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Sheet>
  );
}

