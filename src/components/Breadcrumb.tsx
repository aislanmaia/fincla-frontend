import React from 'react';
import { useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const [, setLocation] = useLocation();

  return (
    <nav className={cn('flex items-center space-x-2 text-sm', className)} aria-label="Breadcrumb">
      <button
        onClick={() => setLocation('/dashboard')}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="w-4 h-4" />
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            
            {item.href && !isLast ? (
              <button
                onClick={() => setLocation(item.href!)}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ) : (
              <span className={cn(
                'flex items-center gap-1.5',
                isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {item.icon}
                <span>{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}



