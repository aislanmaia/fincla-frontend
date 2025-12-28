import { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import { format, startOfDay, endOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker, DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import 'react-day-picker/dist/style.css';

export interface DateRangePickerProps {
  value?: { from: Date; to: Date };
  onChange?: (range: { from: Date; to: Date } | undefined) => void;
  className?: string;
}

type PeriodPreset = 
  | 'today' 
  | 'yesterday' 
  | 'thisWeek' 
  | 'lastWeek' 
  | 'thisMonth' 
  | 'lastMonth' 
  | 'thisYear'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'custom';

interface PresetOption {
  label: string;
  value: PeriodPreset;
  getRange: () => { from: Date; to: Date };
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined
  );
  const [activePreset, setActivePreset] = useState<PeriodPreset | null>(null);
  const [presetManuallySet, setPresetManuallySet] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Calcular períodos pré-definidos (memoizado)
  const presets = useMemo((): PresetOption[] => {
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    
    // Esta semana (segunda até hoje)
    const thisWeekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Segunda = 0
    thisWeekStart.setDate(now.getDate() - diff);
    const thisWeekStartDay = startOfDay(thisWeekStart);
    
    // Semana passada (segunda a domingo)
    const lastWeekStart = new Date(thisWeekStartDay);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    
    // Este mês
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Mês passado
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // Este ano
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    
    return [
      {
        label: 'Hoje',
        value: 'today',
        getRange: () => ({ from: today, to: endOfDay(now) }),
      },
      {
        label: 'Ontem',
        value: 'yesterday',
        getRange: () => ({ from: yesterday, to: endOfDay(yesterday) }),
      },
      {
        label: 'Esta Semana',
        value: 'thisWeek',
        getRange: () => ({ from: thisWeekStartDay, to: endOfDay(now) }),
      },
      {
        label: 'Semana Passada',
        value: 'lastWeek',
        getRange: () => ({ from: startOfDay(lastWeekStart), to: endOfDay(lastWeekEnd) }),
      },
      {
        label: 'Este Mês',
        value: 'thisMonth',
        getRange: () => ({ from: thisMonthStart, to: endOfDay(now) }),
      },
      {
        label: 'Mês Passado',
        value: 'lastMonth',
        getRange: () => ({ from: startOfDay(lastMonthStart), to: endOfDay(lastMonthEnd) }),
      },
      {
        label: 'Este Ano',
        value: 'thisYear',
        getRange: () => ({ from: thisYearStart, to: endOfDay(now) }),
      },
      {
        label: 'Últimos 7 dias',
        value: 'last7Days',
        getRange: () => {
          const from = new Date(now);
          from.setDate(from.getDate() - 6);
          return { from: startOfDay(from), to: endOfDay(now) };
        },
      },
      {
        label: 'Últimos 30 dias',
        value: 'last30Days',
        getRange: () => {
          const from = new Date(now);
          from.setDate(from.getDate() - 29);
          return { from: startOfDay(from), to: endOfDay(now) };
        },
      },
      {
        label: 'Últimos 90 dias',
        value: 'last90Days',
        getRange: () => {
          const from = new Date(now);
          from.setDate(from.getDate() - 89);
          return { from: startOfDay(from), to: endOfDay(now) };
        },
      },
    ];
  }, []);

  // Sincronizar selectedRange com value externo
  useEffect(() => {
    if (value) {
      setSelectedRange({ from: value.from, to: value.to });
      setPresetManuallySet(false); // Permitir detecção automática quando vem de fora
    }
  }, [value]);

  // Detectar qual preset está ativo (apenas se não foi definido manualmente)
  useEffect(() => {
    // Se o preset foi definido manualmente, não sobrescrever
    if (presetManuallySet) {
      return;
    }

    if (!selectedRange?.from || !selectedRange?.to) {
      setActivePreset(null);
      return;
    }

    // Priorizar presets "Últimos X dias" verificando-os primeiro
    const presetsWithPriority = [
      ...presets.filter(p => ['last7Days', 'last30Days', 'last90Days'].includes(p.value)),
      ...presets.filter(p => !['last7Days', 'last30Days', 'last90Days'].includes(p.value))
    ];

    const matchingPreset = presetsWithPriority.find((preset) => {
      const presetRange = preset.getRange();
      return (
        format(selectedRange.from!, 'yyyy-MM-dd') === format(presetRange.from, 'yyyy-MM-dd') &&
        format(selectedRange.to!, 'yyyy-MM-dd') === format(presetRange.to, 'yyyy-MM-dd')
      );
    });

    setActivePreset(matchingPreset ? matchingPreset.value : 'custom');
  }, [selectedRange, presets, presetManuallySet]);

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getRange();
    setSelectedRange({ from: range.from, to: range.to });
    setActivePreset(preset.value);
    setPresetManuallySet(true); // Marcar como definido manualmente
  };

  const handleApply = () => {
    if (selectedRange?.from && selectedRange?.to) {
      onChange?.({
        from: selectedRange.from,
        to: selectedRange.to,
      });
      setIsOpen(false);
      // Resetar flag manual após aplicar
      setPresetManuallySet(false);
    }
  };

  const handleCancel = () => {
    // Restaurar valor original
    if (value) {
      setSelectedRange({ from: value.from, to: value.to });
    } else {
      setSelectedRange(undefined);
    }
    setIsOpen(false);
    // Resetar flag manual ao cancelar
    setPresetManuallySet(false);
  };

  const handleClear = () => {
    setSelectedRange(undefined);
    setActivePreset(null);
    onChange?.(undefined);
  };

  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return 'Selecione um período';
    
    // Se não há range completo, mostrar apenas a data inicial
    if (!range.to) {
      return format(range.from, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    
    // Presets que devem exibir o intervalo detalhado ao invés do nome
    const presetsWithDetailedRange: PeriodPreset[] = ['last7Days', 'last30Days', 'last90Days'];
    
    // Se um preset está ativo e não é um dos que devem mostrar detalhes, retornar o label do preset
    if (activePreset && activePreset !== 'custom' && !presetsWithDetailedRange.includes(activePreset)) {
      const preset = presets.find(p => p.value === activePreset);
      if (preset) {
        return preset.label;
      }
    }
    
    // Para presets com intervalo detalhado ou customizado, mostrar o range completo
    const fromStr = format(range.from, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    const toStr = format(range.to, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return `${fromStr} - ${toStr}`;
  };

  const isRangeValid = selectedRange?.from && selectedRange?.to && 
    !isAfter(selectedRange.from, selectedRange.to);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-w-[240px] sm:min-w-[280px] max-w-[400px] h-9 justify-start text-left font-normal bg-white hover:bg-gray-50 border-gray-300 text-sm",
            !selectedRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 text-xs sm:text-sm whitespace-nowrap">
            {formatDateRange(selectedRange)}
          </span>
          {selectedRange && (
            <X
              className="ml-2 h-3.5 w-3.5 opacity-50 hover:opacity-100 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
          <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverRef}
        className="w-auto p-0 max-w-[580px]"
        align="end"
        sideOffset={8}
      >
        <div className="flex">
          {/* Painel de Presets */}
          <div className="border-r border-gray-200 p-2 min-w-[140px] max-h-[420px] overflow-y-auto">
            <div className="space-y-0.5">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "w-full text-left px-2 py-1 text-xs rounded transition-colors",
                    activePreset === preset.value
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {preset.label}
                </button>
              ))}
              {activePreset === 'custom' && (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 font-medium"
                  disabled
                >
                  Customizado
                </button>
              )}
            </div>
          </div>

          {/* Painel do Calendário */}
          <div className="p-2">
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={setSelectedRange}
              numberOfMonths={2}
              locale={ptBR}
              disabled={(date) => isAfter(date, new Date())}
              className="rounded-md"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-1.5 sm:space-x-2 sm:space-y-0",
                month: "space-y-1.5",
                caption: "flex justify-center pt-0 relative items-center mb-0.5",
                caption_label: "text-xs font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-5 w-5 bg-transparent p-0 opacity-50 hover:opacity-100 border border-input hover:bg-accent hover:text-accent-foreground rounded text-[10px]"
                ),
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse space-y-0",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded w-6 font-normal text-[0.65rem]",
                row: "flex w-full mt-0.5",
                cell: "h-6 w-6 text-center text-[11px] p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: cn(
                  "h-6 w-6 p-0 font-normal aria-selected:opacity-100 rounded hover:bg-accent hover:text-accent-foreground text-[11px]"
                ),
                day_range_end: "day-range-end",
                day_selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "aria-selected:bg-blue-100 aria-selected:text-blue-900",
                day_hidden: "invisible",
              }}
            />
            
            {/* Mensagem de erro se range inválido */}
            {selectedRange?.from && selectedRange?.to && isAfter(selectedRange.from, selectedRange.to) && (
              <p className="text-[10px] text-red-600 mt-1 px-2">
                Data de início deve ser anterior à data de fim
              </p>
            )}

            {/* Botões de ação */}
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="h-6 px-2.5 text-xs"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApply}
                disabled={!isRangeValid}
                className="h-6 px-2.5 text-xs"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

