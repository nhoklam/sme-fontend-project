import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency formatter ────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

// ── Date formatters ───────────────────────────────────────────
export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: vi });
  } catch { return dateStr; }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: vi });
  } catch { return dateStr; }
}

export function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: vi });
  } catch { return dateStr; }
}

// ── Role helpers ──────────────────────────────────────────────
export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    ROLE_ADMIN:   'Quản trị viên',
    ROLE_MANAGER: 'Quản lý',
    ROLE_CASHIER: 'Thu ngân',
  };
  return map[role] ?? role;
}

export function getRoleColor(role: string): string {
  const map: Record<string, string> = {
    ROLE_ADMIN:   'bg-red-100 text-red-700',
    ROLE_MANAGER: 'bg-amber-100 text-amber-700',
    ROLE_CASHIER: 'bg-blue-100 text-blue-700',
  };
  return map[role] ?? 'bg-gray-100 text-gray-700';
}

// ── Status helpers ────────────────────────────────────────────
export function getOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING:   'Chờ xử lý',
    PACKING:   'Đang đóng gói',
    SHIPPING:  'Đang giao',
    DELIVERED: 'Đã giao',
    CANCELLED: 'Đã hủy',
    RETURNED:  'Hoàn trả',
  };
  return map[status] ?? status;
}

export function getOrderStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING:   'bg-gray-100 text-gray-700',
    PACKING:   'bg-yellow-100 text-yellow-700',
    SHIPPING:  'bg-blue-100 text-blue-700',
    DELIVERED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    RETURNED:  'bg-orange-100 text-orange-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function getShiftStatusLabel(status: string): string {
  const map: Record<string, string> = {
    OPEN:             'Đang mở',
    CLOSED:           'Đã đóng',
    MANAGER_APPROVED: 'Đã duyệt',
  };
  return map[status] ?? status;
}

export function getTierColor(tier: string): string {
  const map: Record<string, string> = {
    GOLD:     'text-yellow-600 bg-yellow-50 border-yellow-200',
    SILVER:   'text-slate-600 bg-slate-50 border-slate-200',
    STANDARD: 'text-blue-600 bg-blue-50 border-blue-200',
  };
  return map[tier] ?? 'text-gray-600 bg-gray-50';
}

export function getPurchaseStatusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT:     'bg-gray-100 text-gray-700',
    PENDING:   'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

// ── Code generator ────────────────────────────────────────────
export function generateCode(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

// ── Extract error message ─────────────────────────────────────
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response?.data;
    return resp?.message ?? 'Đã xảy ra lỗi';
  }
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi';
}
