import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface ConsultantDateControlsProps {
  dateRange?: DateRange;
  snapshotDate?: Date;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  onSnapshotDateChange?: (date: Date | undefined) => void;
}

export function ConsultantDateControls({
  dateRange,
  snapshotDate,
  onDateRangeChange,
  onSnapshotDateChange,
}: ConsultantDateControlsProps) {
  // datePickerMode reserved for future use (single/range toggle)

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Date Range Picker */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd MMM yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd MMM yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd MMM yyyy", { locale: ptBR })
                )
              ) : (
                <span>Selecione o período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange?.(range);
              }}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        
        {/* Clear date range button */}
        {dateRange?.from && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateRangeChange?.(undefined)}
            className="text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-border hidden sm:block" />

      {/* Snapshot Date Picker */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Data base:
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[180px] justify-start text-left font-normal",
                !snapshotDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {snapshotDate ? (
                format(snapshotDate, "dd MMM yyyy", { locale: ptBR })
              ) : (
                <span>Hoje</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={snapshotDate}
              onSelect={(date) => {
                onSnapshotDateChange?.(date);
              }}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {/* Set to today button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSnapshotDateChange?.(new Date())}
          className="text-muted-foreground hover:text-foreground"
        >
          Hoje
        </Button>
      </div>
    </div>
  );
}
