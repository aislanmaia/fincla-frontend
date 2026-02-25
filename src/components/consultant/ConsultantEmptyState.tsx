import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsultantEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function ConsultantEmptyState({ icon: Icon, title, description, className }: ConsultantEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 rounded-xl',
        'bg-gradient-to-br from-slate-50 via-white to-indigo-50/30',
        'border border-slate-200/80',
        'min-h-[200px]',
        className
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-100 mb-4 shadow-sm">
        <Icon className="w-7 h-7 text-indigo-600/80" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-[260px] leading-relaxed">{description}</p>
    </div>
  );
}
