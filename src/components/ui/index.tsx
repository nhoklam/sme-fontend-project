import { cn } from '@/lib/utils';

// ── Badge ─────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray';
}

const variantMap: Record<string, string> = {
  default: 'bg-primary-100 text-primary-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  gray:    'bg-gray-100 text-gray-600',
};

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn('badge', variantMap[variant], className)}>
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return (
    <svg className={cn('animate-spin text-primary-600', sz, className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-300 mb-4" />}
      <h3 className="text-gray-600 font-medium">{title}</h3>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────
export function Pagination({ page, totalPages, totalElements, size, onPageChange }: {
  page: number; totalPages: number; totalElements: number; size: number; onPageChange: (p: number) => void;
}) {
  const start = page * size + 1;
  const end   = Math.min((page + 1) * size, totalElements);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Hiển thị {start}–{end} / {totalElements}
      </p>
      <div className="flex gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page === 0}
          className="btn-secondary btn-sm disabled:opacity-40 px-3">‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = page < 3 ? i : page - 2 + i;
          if (p >= totalPages) return null;
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={cn('btn btn-sm px-3', p === page ? 'btn-primary' : 'btn-secondary')}>
              {p + 1}
            </button>
          );
        })}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}
          className="btn-secondary btn-sm disabled:opacity-40 px-3">›</button>
      </div>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────
export function ConfirmDialog({ open, title, description, onConfirm, onCancel, danger = false, loading = false }: {
  open: boolean; title: string; description?: string;
  onConfirm: () => void; onCancel: () => void;
  danger?: boolean; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 animate-slide-up">
        <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
        {description && <p className="text-gray-500 text-sm mt-2">{description}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary">Hủy</button>
          <button onClick={onConfirm} disabled={loading}
            className={danger ? 'btn-danger' : 'btn-primary'}>
            {loading ? <Spinner size="sm" /> : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
