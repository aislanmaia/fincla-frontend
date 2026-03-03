import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Check, ChevronDown, Tag, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listTags } from '@/api/tags';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export interface CategorySearchPopoverProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Categorias das transações atuais (fallback quando API não retorna) */
  transactionCategories?: string[];
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  id?: string;
  ariaLabelledBy?: string;
}

export function CategorySearchPopover({
  value,
  onValueChange,
  transactionCategories = [],
  className,
  triggerClassName,
  placeholder = 'Categoria',
  id,
  ariaLabelledBy,
}: CategorySearchPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);
  const { activeOrgId } = useOrganization();

  const { data: tagsData } = useQuery({
    queryKey: ['tags', 'categoria', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return { tags: [] };
      const res = await listTags(activeOrgId);
      return res;
    },
    enabled: !!activeOrgId,
    staleTime: 5 * 60 * 1000,
  });

  const allCategories = useMemo(() => {
    const fromApi = (tagsData?.tags || [])
      .filter((t) => (t.tag_type?.name ?? '').toLowerCase() === 'categoria' && t.is_active !== false)
      .map((t) => t.name.trim())
      .filter(Boolean);
    const fromTx = transactionCategories.filter(Boolean);
    const unique = new Set([...fromApi, ...fromTx].sort((a, b) => a.localeCompare(b)));
    return Array.from(unique);
  }, [tagsData?.tags, transactionCategories]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCategories;
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, searchQuery]);

  const visibleCategories = useMemo(
    () => filteredCategories.slice(0, visibleCount),
    [filteredCategories, visibleCount]
  );

  const hasMore = visibleCategories.length < filteredCategories.length;

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredCategories.length));
    }
  }, [hasMore, filteredCategories.length]);

  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    setVisibleCount(PAGE_SIZE);
  };

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setVisibleCount(PAGE_SIZE);
    }
  }, [open]);

  const displayValue = value === 'todas' ? 'Todas' : value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-labelledby={ariaLabelledBy ?? undefined}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-10 w-full justify-between font-normal rounded-xl border-[#D1D5DB] dark:border-gray-600 bg-white dark:bg-gray-900 text-[#111827] dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800',
            triggerClassName
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-[var(--radix-popover-trigger-width)] p-0 z-[120]', className)}
        align="center"
        side="bottom"
        avoidCollisions={false}
      >
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Buscar categoria..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-11 border-0 border-transparent bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-[280px] overflow-y-auto overflow-x-hidden p-2"
          >
            <button
              type="button"
              onClick={() => {
                onValueChange('todas');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors text-left',
                value === 'todas'
                  ? 'bg-[#4A56E2]/10 text-[#4A56E2] dark:bg-[#4A56E2]/20 dark:text-[#818CF8]'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200/80 dark:bg-slate-700">
                <Tag className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <span className="flex-1 font-medium">Todas</span>
              {value === 'todas' && <Check className="h-4 w-4 shrink-0" />}
            </button>
            {filteredCategories.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma categoria encontrada.
              </p>
            ) : (
              visibleCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onValueChange(cat);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors text-left',
                    value === cat
                      ? 'bg-[#4A56E2]/10 text-[#4A56E2] dark:bg-[#4A56E2]/20 dark:text-[#818CF8]'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Tag className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="flex-1 font-medium">{cat}</span>
                  {value === cat && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
