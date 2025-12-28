import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, parse, isValid, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface DateTimeInputProps {
  value: string; // formato: 'yyyy-MM-dd' ou 'yyyy-MM-ddTHH:mm'
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DateTimeInput({
  value,
  onChange,
  disabled = false,
  className,
}: DateTimeInputProps) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [timeValue, setTimeValue] = useState({ hours: '00', minutes: '00' });
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  // Converter valor ISO para Date
  const parseISOValue = (isoValue: string): Date | null => {
    if (!isoValue) return null;
    
    try {
      let date: Date;
      if (isoValue.includes('T')) {
        date = parse(isoValue, "yyyy-MM-dd'T'HH:mm", new Date());
      } else {
        date = parse(isoValue, 'yyyy-MM-dd', new Date());
      }
      
      if (!isValid(date)) return null;
      return date;
    } catch {
      return null;
    }
  };

  // Inicializar valores
  useEffect(() => {
    const date = parseISOValue(value);
    if (date) {
      setSelectedDate(date);
      setTimeValue({
        hours: format(date, 'HH'),
        minutes: format(date, 'mm'),
      });
    } else {
      const now = new Date();
      setSelectedDate(now);
      setTimeValue({
        hours: format(now, 'HH'),
        minutes: format(now, 'mm'),
      });
      // Definir valor padrão se não houver valor
      const isoValue = format(now, "yyyy-MM-dd'T'HH:mm");
      onChange(isoValue);
    }
  }, []);

  // Atualizar quando valor externo muda (apenas quando não está editando)
  useEffect(() => {
    // Só atualizar se o popover de hora não estiver aberto (para não interferir na digitação)
    if (!timePopoverOpen) {
      const date = parseISOValue(value);
      if (date) {
        setSelectedDate(date);
        setTimeValue({
          hours: format(date, 'HH'),
          minutes: format(date, 'mm'),
        });
      }
    }
  }, [value, timePopoverOpen]);

  // Atualizar valor completo quando data ou hora mudam
  const updateDateTime = (date: Date | undefined, hours: string, minutes: string) => {
    if (!date) return;
    
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;
    const combinedDate = setMinutes(setHours(date, hoursNum), minutesNum);
    
    const isoValue = format(combinedDate, "yyyy-MM-dd'T'HH:mm");
    onChange(isoValue);
  };

  // Handler para seleção de data no calendário
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    updateDateTime(date, timeValue.hours, timeValue.minutes);
    setDatePopoverOpen(false);
  };

  // Handler para mudança de hora/minuto
  const handleTimeChange = (type: 'hours' | 'minutes', val: string) => {
    // Aceitar apenas números
    const numVal = val.replace(/\D/g, '');
    if (numVal.length > 2) return;
    
    const num = parseInt(numVal) || 0;
    
    // Validação
    if (type === 'hours' && numVal && (num > 23 || num < 0)) return;
    if (type === 'minutes' && numVal && (num > 59 || num < 0)) return;
    
    setTimeValue(prev => {
      const newValue = {
        ...prev,
        [type]: numVal, // Armazenar sem padding durante a digitação
      };
      
      // Atualizar data completa apenas quando ambos os valores estão completos (2 dígitos)
      if (selectedDate) {
        const hours = type === 'hours' ? numVal : prev.hours;
        const minutes = type === 'minutes' ? numVal : prev.minutes;
        
        // Só atualizar se ambos tiverem pelo menos 1 dígito
        if (hours && minutes) {
          const hoursNum = parseInt(hours.padStart(2, '0')) || 0;
          const minutesNum = parseInt(minutes.padStart(2, '0')) || 0;
          updateDateTime(selectedDate, hoursNum.toString().padStart(2, '0'), minutesNum.toString().padStart(2, '0'));
        }
      }
      
      return newValue;
    });

    // Navegação automática: ao digitar dois dígitos no campo de horas, pular para minutos
    // Apenas quando digitando, não quando usando setas
    if (type === 'hours' && numVal.length === 2 && hoursInputRef.current === document.activeElement) {
      setTimeout(() => {
        minutesInputRef.current?.focus();
        minutesInputRef.current?.select();
      }, 0);
    }
  };

  // Handler para digitação direta (sobrescreve o valor)
  const handleTimeInput = (e: React.ChangeEvent<HTMLInputElement>, type: 'hours' | 'minutes') => {
    const input = e.target;
    const newValue = input.value;
    
    // Extrair apenas números (sem padding durante a digitação)
    const numVal = newValue.replace(/\D/g, '').substring(0, 2);
    
    // Sempre sobrescrever: aceitar apenas o que foi digitado (máximo 2 dígitos)
    // Armazenar sem padding para exibir exatamente como foi digitado
    if (numVal) {
      setTimeValue(prev => {
        const newTimeValue = {
          ...prev,
          [type]: numVal, // Armazenar sem padding
        };
        
        // Atualizar data completa apenas quando ambos os valores estão completos (2 dígitos)
        if (selectedDate) {
          const hours = type === 'hours' ? numVal : prev.hours;
          const minutes = type === 'minutes' ? numVal : prev.minutes;
          
          // Só atualizar se ambos tiverem pelo menos 1 dígito
          if (hours && minutes) {
            const hoursNum = parseInt(hours.padStart(2, '0')) || 0;
            const minutesNum = parseInt(minutes.padStart(2, '0')) || 0;
            updateDateTime(selectedDate, hoursNum.toString().padStart(2, '0'), minutesNum.toString().padStart(2, '0'));
          }
        }
        
        return newTimeValue;
      });
      
      // Se digitou apenas 1 dígito, colocar cursor no final para permitir segundo dígito
      if (numVal.length === 1) {
        setTimeout(() => {
          input.setSelectionRange(1, 1);
        }, 0);
      }
    } else {
      // Se não há número válido, limpar o campo
      setTimeValue(prev => ({
        ...prev,
        [type]: '',
      }));
    }
  };

  // Handler para setas do teclado (incrementar/decrementar)
  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: 'hours' | 'minutes') => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseInt(timeValue[type]) || 0;
      const max = type === 'hours' ? 23 : 59;
      const min = 0;
      const newValue = current >= max ? min : current + 1;
      // Atualizar diretamente sem passar pelo handleTimeChange para evitar mudança de foco
      setTimeValue(prev => {
        const newTimeValue = {
          ...prev,
          [type]: newValue.toString().padStart(2, '0'),
        };
        if (selectedDate) {
          const hours = type === 'hours' ? newValue : parseInt(prev.hours) || 0;
          const minutes = type === 'minutes' ? newValue : parseInt(prev.minutes) || 0;
          updateDateTime(selectedDate, hours.toString().padStart(2, '0'), minutes.toString().padStart(2, '0'));
        }
        return newTimeValue;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(timeValue[type]) || 0;
      const max = type === 'hours' ? 23 : 59;
      const min = 0;
      const newValue = current <= min ? max : current - 1;
      // Atualizar diretamente sem passar pelo handleTimeChange para evitar mudança de foco
      setTimeValue(prev => {
        const newTimeValue = {
          ...prev,
          [type]: newValue.toString().padStart(2, '0'),
        };
        if (selectedDate) {
          const hours = type === 'hours' ? newValue : parseInt(prev.hours) || 0;
          const minutes = type === 'minutes' ? newValue : parseInt(prev.minutes) || 0;
          updateDateTime(selectedDate, hours.toString().padStart(2, '0'), minutes.toString().padStart(2, '0'));
        }
        return newTimeValue;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setTimePopoverOpen(false);
    } else if (e.key === 'Tab') {
      // Permitir Tab normal para navegação
      return;
    } else if (/^[0-9]$/.test(e.key)) {
      // Quando digitar um número, o texto já está selecionado pelo onFocus
      // O handleTimeInput cuidará da sobrescrita
      // Não precisamos fazer nada aqui
    }
  };

  // Handler para usar hora atual
  const handleUseCurrentTime = () => {
    const now = new Date();
    setTimeValue({
      hours: format(now, 'HH'),
      minutes: format(now, 'mm'),
    });
    if (selectedDate) {
      updateDateTime(selectedDate, format(now, 'HH'), format(now, 'mm'));
    }
    setTimePopoverOpen(false);
  };

  // Handler para confirmar hora
  const handleConfirmTime = () => {
    setTimePopoverOpen(false);
  };

  // Formatar data para exibição
  const formattedDate = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : '--/--/----';
  // Formatar hora apenas quando ambos os valores estão completos (2 dígitos)
  // Durante a digitação, mostrar o valor exatamente como está
  // Formatar hora: mostrar exatamente como está durante a digitação (sem padding)
  // O padding só será aplicado quando o valor for salvo ou quando ambos os campos estiverem completos
  const formattedTime = `${timeValue.hours || '00'}:${timeValue.minutes || '00'}`;

  return (
    <div className={cn(
      'flex w-full rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden',
      'focus-within:ring-2 focus-within:ring-blue-100 focus-within:bg-white dark:focus-within:bg-gray-800',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    )}>
      {/* Segmento 1: Data */}
      <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center gap-2 px-4 py-3 text-left',
              'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
              disabled && 'cursor-not-allowed'
            )}
          >
            <CalendarIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-base font-medium text-gray-900 dark:text-gray-100">
              {formattedDate}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0" 
          align="start"
          style={{ width: '320px', height: '360px', overflow: 'hidden' }}
        >
          <div className="p-4" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Divisor visual */}
      <div className="w-px bg-gray-200 dark:bg-gray-700" />

      {/* Segmento 2: Hora */}
      <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-left min-w-[120px]',
              'hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
              disabled && 'cursor-not-allowed'
            )}
          >
            <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-base font-medium text-gray-900 dark:text-gray-100">
              {formattedTime}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-4" 
          align="start"
          onOpenAutoFocus={(e) => {
            // Focar no campo de horas quando o popover abrir
            e.preventDefault();
            setTimeout(() => {
              hoursInputRef.current?.focus();
              hoursInputRef.current?.select();
            }, 0);
          }}
        >
          <div className="space-y-4">
            {/* Inputs de Hora e Minuto */}
            <div className="flex items-center gap-2">
              <input
                ref={hoursInputRef}
                type="text"
                value={timeValue.hours}
                onChange={(e) => handleTimeInput(e, 'hours')}
                onKeyDown={(e) => handleTimeKeyDown(e, 'hours')}
                onFocus={(e) => {
                  // Sempre selecionar todo o texto ao focar para permitir sobrescrita
                  e.target.select();
                }}
                maxLength={2}
                placeholder="00"
                className="w-16 text-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">:</span>
              <input
                ref={minutesInputRef}
                type="text"
                value={timeValue.minutes}
                onChange={(e) => handleTimeInput(e, 'minutes')}
                onKeyDown={(e) => handleTimeKeyDown(e, 'minutes')}
                onFocus={(e) => {
                  // Sempre selecionar todo o texto ao focar para permitir sobrescrita
                  e.target.select();
                }}
                maxLength={2}
                placeholder="00"
                className="w-16 text-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Dica de navegação por teclado */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Use ↑ ↓ para ajustar os valores
            </p>

            {/* Botões */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseCurrentTime}
                className="flex-1"
              >
                Usar hora atual
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmTime}
                className="flex-1"
              >
                Definir Hora
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
