import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp, ShoppingBag, AlertTriangle, DollarSign,
  MessageSquare, Send, X, Bot, CheckCircle, Package, ChevronRight, Clock,
  Banknote, Landmark, Wallet, Trophy, Medal, BarChart3,
  AlertCircle, CreditCard, UserCheck,
  History, Plus, Pencil, Trash2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { reportService } from '@/services/report.service';
import { orderService } from '@/services/order.service';
import { inventoryService } from '@/services/inventory.service';
import { aiService } from '@/services/ai.service';
import { posService } from '@/services/pos.service';
import { financeService } from '@/services/finance.service';
import { adminService } from '@/services/admin.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { PageLoader, EmptyState } from '@/components/ui';
import { format, subDays, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { useDashboardWebSocket } from '@/hooks/useDashboardWebSocket';
import type { ShiftResponse, AuditLogResponse, LowStockItem } from '@/types';

// ── Types cho Dashboard Summary ────────────────────────────────
interface RevenuePeriod {
  period: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  invoice_count: number;
}

interface DashboardSummary {
  warehouseId: string;
  revenueToday: RevenuePeriod[];
  lowStockCount: number;
}

interface CashBalance {
  CASH_111: number;
  BANK_112: number;
  total: number;
}

interface TopProductItem {
  id: string;
  name: string;
  total_sold: number;
}

interface SupplierDebtItem {
  id: string;
  supplierId: string;
  supplierName: string;          
  purchaseOrderId: string;
  purchaseOrderCode?: string;
  warehouseId?: string;
  warehouseName?: string;
  totalDebt: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate?: string;
  createdAt: string;
}

// ── KPI Card ──────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
        {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Cash Balance Widget ────────────────────────────────────────
function CashBalanceWidget({ balance }: { balance: CashBalance | undefined }) {
  const isLoading = balance === undefined;

  const rows = [
    {
      icon: Banknote,
      label: 'Tiền mặt (TK 111)',
      value: balance?.CASH_111 ?? 0,
      color: 'text-green-600',
      bg: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      icon: Landmark,
      label: 'Ngân hàng (TK 112)',
      value: balance?.BANK_112 ?? 0,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary-500" />
          Số dư quỹ
        </h3>
        <Link to="/finance" className="text-primary-600 text-sm hover:underline">
          Sổ quỹ
        </Link>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {rows.map(({ icon: Icon, label, value, color, bg, iconColor }) => (
              <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${bg}`}>
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-base font-bold ${color}`}>
                    {formatCurrency(value)}
                  </p>
                </div>
              </div>
            ))}

            {/* Tổng cộng */}
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">Tổng quỹ</span>
              <span className="text-lg font-bold text-gray-800">
                {formatCurrency(balance?.total ?? 0)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Pending Shifts Widget (có nút Duyệt ngay) ─────────────────
function PendingShiftsWidget({
  shifts,
  onApprove,
  approvingId,
}: {
  shifts: ShiftResponse[] | undefined;
  onApprove: (id: string) => void;
  approvingId: string | null;
}) {
  const isLoading = shifts === undefined;
  const isEmpty   = !isLoading && shifts.length === 0;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-purple-500" />
          Ca chờ duyệt
          {!isLoading && shifts.length > 0 && (
            <span className="ml-1 text-xs font-normal bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
              {shifts.length}
            </span>
          )}
        </h3>
        <Link to="/pos" className="text-primary-600 text-sm hover:underline">
          Trang POS
        </Link>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Skeleton */}
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
                <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="p-6 text-center text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-sm">Không có ca chờ duyệt</p>
          </div>
        )}

        {/* Shift rows */}
        {!isLoading && (shifts ?? []).map(s => {
          const isApproving  = approvingId === s.id;
          const hasGap       = (s.discrepancyAmount ?? 0) !== 0;
          const gapPositive  = (s.discrepancyAmount ?? 0) > 0;

          return (
            <div key={s.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                {/* Thông tin ca */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {s.cashierName ?? 'Thu ngân'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.warehouseName && (
                      <span className="mr-1">{s.warehouseName} •</span>
                    )}
                    {formatDateTime(s.closedAt ?? s.openedAt)}
                  </p>

                  {/* Doanh thu + chênh lệch */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {(s.totalRevenue ?? 0) > 0 && (
                      <span className="text-xs text-gray-500">
                        DT: <span className="font-medium text-gray-700">
                          {formatCurrency(s.totalRevenue ?? 0)}
                        </span>
                      </span>
                    )}
                    {hasGap && (
                      <span className={`text-xs font-semibold ${gapPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {gapPositive ? '+' : ''}{formatCurrency(s.discrepancyAmount ?? 0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Nút Duyệt */}
                <button
                  onClick={() => onApprove(s.id)}
                  disabled={isApproving}
                  className={`
                    flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                    transition-all duration-150
                    ${isApproving
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-sm'
                    }
                  `}
                >
                  {isApproving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                      Đang duyệt
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3 h-3" />
                      Duyệt
                    </>
                  )}
                </button>
              </div>

              {/* Lý do chênh lệch (nếu có) */}
              {s.discrepancyReason && (
                <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 truncate" title={s.discrepancyReason}>
                  ⚠ {s.discrepancyReason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top Products Widget ────────────────────────────────────────
const RANK_STYLE: Record<number, { bg: string; text: string; icon: React.ElementType | null }> = {
  0: { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: Trophy },
  1: { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: Medal },
  2: { bg: 'bg-orange-100', text: 'text-orange-600', icon: Medal },
};

function TopProductsWidget({ items }: { items: TopProductItem[] | undefined }) {
  const isLoading = items === undefined;
  const isEmpty   = !isLoading && items.length === 0;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Top bán chạy hôm nay
        </h3>
        <Link to="/reports" className="text-primary-600 text-sm hover:underline">
          Xem chi tiết
        </Link>
      </div>

      <div className="divide-y divide-gray-50">
        {/* Skeleton loading */}
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
                <div className="w-12 h-4 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="p-6 text-center text-gray-400">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Chưa có hóa đơn hôm nay</p>
          </div>
        )}

        {/* Data rows */}
        {!isLoading && items.map((item, index) => {
          const style   = RANK_STYLE[index] ?? { bg: 'bg-white', text: 'text-gray-500', icon: null };
          const RankIcon = style.icon;
          // Tính chiều rộng bar tương đối so với vị trí #1
          const maxSold = items[0]?.total_sold ?? 1;
          const barPct  = Math.max(8, Math.round((item.total_sold / maxSold) * 100));

          return (
            <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              {/* Rank badge */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                {RankIcon
                  ? <RankIcon className={`w-3.5 h-3.5 ${style.text}`} />
                  : <span className={`text-xs font-bold ${style.text}`}>{index + 1}</span>
                }
              </div>

              {/* Tên sản phẩm + progress bar */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate" title={item.name}>
                  {item.name}
                </p>
                <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-400 rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* Số lượng bán */}
              <span className="text-sm font-bold text-primary-600 flex-shrink-0 tabular-nums">
                {Number(item.total_sold ?? 0).toLocaleString('vi-VN')}
                <span className="text-xs font-normal text-gray-400 ml-0.5">đã bán</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Config hiển thị trạng thái công nợ
const DEBT_STATUS_CONFIG = {
  UNPAID:  { label: 'Chưa TT',    cls: 'bg-red-100 text-red-700'     },
  PARTIAL: { label: 'Một phần',   cls: 'bg-amber-100 text-amber-700' },
  PAID:    { label: 'Đã TT',      cls: 'bg-green-100 text-green-700' },
} as const;

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'dd/MM/yy');
  } catch {
    return '—';
  }
}

// ── Supplier Debts Widget ──────────────────────────────────────
function SupplierDebtsWidget({ debts }: { debts: SupplierDebtItem[] | undefined }) {
  const isLoading = debts === undefined;
  const isEmpty   = !isLoading && debts.length === 0;

  // Tổng công nợ còn lại
  const totalRemaining = (debts ?? []).reduce((sum, d) => sum + d.remainingAmount, 0);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-red-500" />
          Công nợ NCC
          {!isLoading && (debts ?? []).length > 0 && (
            <span className="ml-1 text-xs font-normal bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              {(debts ?? []).length}
            </span>
          )}
        </h3>
        <Link to="/finance" className="text-primary-600 text-sm hover:underline">
          Xem sổ quỹ
        </Link>
      </div>

      {/* Tổng công nợ */}
      {!isLoading && totalRemaining > 0 && (
        <div className="mx-4 mb-3 mt-1 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
          <span className="text-xs text-red-600 font-medium">Tổng còn phải trả</span>
          <span className="text-base font-bold text-red-700">{formatCurrency(totalRemaining)}</span>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {/* Skeleton */}
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="p-6 text-center text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-sm">Không có công nợ chưa thanh toán</p>
          </div>
        )}

        {/* Debt rows */}
        {!isLoading && (debts ?? []).map(debt => {
          const statusCfg  = DEBT_STATUS_CONFIG[debt.status] ?? DEBT_STATUS_CONFIG.UNPAID;
          const isOverdue  = debt.dueDate
            ? new Date(debt.dueDate) < new Date()
            : false;

          return (
            <div key={debt.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                {/* Tên NCC + PO code */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate" title={debt.supplierName}>
                    {debt.supplierName}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {debt.purchaseOrderCode ?? 'N/A'}
                    {debt.warehouseName && (
                      <span className="ml-1 text-gray-300">• {debt.warehouseName}</span>
                    )}
                  </p>
                </div>

                {/* Số tiền còn lại */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-red-600">
                    {formatCurrency(debt.remainingAmount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    / {formatCurrency(debt.totalDebt)}
                  </p>
                </div>
              </div>

              {/* Footer: due date + status badge */}
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  {isOverdue && (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-xs ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {debt.dueDate ? `HH: ${formatShortDate(debt.dueDate)}` : 'Chưa có hạn'}
                  </span>
                </div>
                <span className={`badge text-xs ${statusCfg.cls}`}>
                  {statusCfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Audit log helpers ─────────────────────────────────────────

// Config badge theo action type
const ACTION_CONFIG: Record<
  AuditLogResponse['actionType'],
  { label: string; dot: string; badge: string; Icon: React.ElementType }
> = {
  CREATE:  { label: 'Thêm',    dot: 'bg-green-400', badge: 'bg-green-100 text-green-700', Icon: Plus    },
  UPDATE:  { label: 'Sửa',     dot: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',  Icon: Pencil  },
  DELETE:  { label: 'Xóa',     dot: 'bg-red-400',   badge: 'bg-red-100 text-red-700',    Icon: Trash2  },
  UNKNOWN: { label: 'Khác',    dot: 'bg-gray-300',  badge: 'bg-gray-100 text-gray-500',  Icon: History },
};

// Chuyển Instant ISO → thời gian tương đối dễ đọc
function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
  return format(new Date(isoStr), 'dd/MM HH:mm');
}

// ── Audit Log Widget (Admin only) ─────────────────────────────
function AuditLogWidget({ logs }: { logs: AuditLogResponse[] | undefined }) {
  const isLoading = logs === undefined;
  const isEmpty   = !isLoading && logs.length === 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500" />
          Hoạt động hệ thống
          <span className="text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </h3>
        <Link to="/settings" className="text-primary-600 text-sm hover:underline">
          Xem đầy đủ
        </Link>
      </div>

      {/* Timeline */}
      <div className="px-4 py-3 space-y-0">
        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-4 py-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-100 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-2/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {isEmpty && (
          <div className="py-6 text-center text-gray-400">
            <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Chưa có hoạt động nào</p>
          </div>
        )}

        {/* Log rows — timeline style */}
        {!isLoading && (logs ?? []).map((log, idx) => {
          const cfg      = ACTION_CONFIG[log.actionType] ?? ACTION_CONFIG.UNKNOWN;
          const isLast   = idx === (logs ?? []).length - 1;
          const { Icon } = cfg;

          return (
            <div key={`${log.revision}-${idx}`} className="flex gap-3 group">
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot} ring-2 ring-white`} />
                {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1 mb-0" />}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-3'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Entity + action badge */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {log.entityName}
                      </span>
                    </div>

                    {/* Changed by + entity ID */}
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className="font-medium text-gray-500">{log.changedBy}</span>
                      <span className="text-gray-300">•</span>
                      <span className="font-mono text-[10px] text-gray-400 truncate max-w-[110px]"
                            title={log.entityId}>
                        {log.entityId?.toString().substring(0, 8)}…
                      </span>
                    </p>
                  </div>

                  {/* Thời gian tương đối */}
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 tabular-nums">
                    {timeAgo(log.changedAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chat message ──────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; ts: Date; }

function AIChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Xin chào! Tôi là AI Co-pilot của hệ thống SME ERP & POS. Tôi có thể giúp bạn phân tích dữ liệu kinh doanh, tra cứu chính sách nội bộ, và trả lời các câu hỏi về nghiệp vụ. Bạn cần hỗ trợ gì?', ts: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, ts: new Date() }]);
    setLoading(true);
    try {
      const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const res = await aiService.chat({ message: userMsg, conversationHistory: history });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.data.reply, ts: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.', ts: new Date() }]);
    } finally { setLoading(false); }
  };

  const suggestions = [
    'Phân tích doanh thu tuần này',
    'Sản phẩm nào sắp hết hàng?',
    'Chính sách đổi trả hàng?',
  ];

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col w-96 h-[520px] card shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 bg-primary-600 text-white rounded-t-xl">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">AI Co-pilot</p>
          <p className="text-primary-200 text-xs">Gemini 1.5 Flash</p>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary-600" />
              </div>
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-700'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-primary-600" />
            </div>
            <div className="bg-white border border-gray-200 px-3 py-2 rounded-xl flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className="text-xs bg-primary-50 text-primary-700 border border-primary-200 rounded-full px-3 py-1 hover:bg-primary-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          className="input flex-1 text-sm" placeholder="Nhập câu hỏi..." />
        <button onClick={send} disabled={!input.trim() || loading}
          className="btn-primary px-3 disabled:opacity-40">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, isCashier, isAdmin } = useAuthStore();
  const [showAI, setShowAI] = useState(false);
  const qc = useQueryClient();

  const isStaff = isCashier();

  // ── WebSocket real-time ──────────────────────────────────────
  // warehouseId từ JWT: MANAGER có giá trị, ADMIN có thể null
  // Nếu null → hook tự bỏ qua, polling vẫn chạy như backup
  const { isConnected: wsConnected } = useDashboardWebSocket({
    warehouseId: user?.warehouseId,
    enabled: !isStaff,
  });

  // Theo dõi shiftId đang trong quá trình duyệt để disable đúng nút
  const [approvingShiftId, setApprovingShiftId] = useState<string | null>(null);

  // Mutation duyệt ca — mỗi nút "Duyệt" sẽ truyền shiftId vào đây
  const approveMutation = useMutation({
    mutationFn: (shiftId: string) => posService.approveShift(shiftId),
    onSuccess: (_, shiftId) => {
      toast.success('Đã duyệt ca thành công');
      // Xoá ca vừa duyệt khỏi danh sách ngay lập tức (optimistic-ish)
      qc.invalidateQueries({ queryKey: ['pending-shifts-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cash-balance-dashboard'] }); // số dư có thể thay đổi
    },
    onError: () => {
      toast.error('Duyệt ca thất bại, vui lòng thử lại');
    },
  });

  // Handler duyệt ca — gọi mutation và quản lý loading state
  const handleApproveShift = (shiftId: string) => {
    setApprovingShiftId(shiftId);
    approveMutation.mutate(shiftId, {
      onSettled: () => setApprovingShiftId(null),
    });
  };

  const { data: summary, isLoading: loadingSummary } = useQuery<DashboardSummary>({
    queryKey: ['report-summary'],
    queryFn: () => reportService.getSummary().then(r => r.data.data as DashboardSummary),
    refetchInterval: 60_000,
    enabled: !isStaff,
  });

  const revenueTodayAmount: number = summary?.revenueToday?.[0]?.revenue ?? 0;
  const grossProfitToday: number  = summary?.revenueToday?.[0]?.gross_profit ?? 0;
  const invoiceCountToday: number = summary?.revenueToday?.[0]?.invoice_count ?? 0;

  const { data: pendingOrders } = useQuery({
    queryKey: ['orders-pending-dashboard'],
    queryFn: () => orderService.getOrders({ status: 'PENDING', page: 0, size: 5 }).then(r => r.data.data),
    enabled: !isStaff,
  });

  const { data: lowStock } = useQuery<LowStockItem[]>({
    queryKey: ['low-stock-dashboard'],
    queryFn: () => inventoryService.getLowStock().then(r => r.data.data as LowStockItem[]),
    enabled: !isStaff,
  });

  const { data: pendingShifts } = useQuery<ShiftResponse[]>({
    queryKey: ['pending-shifts-dashboard'],
    queryFn: () => posService.getPendingShifts().then(r => r.data.data as ShiftResponse[]),
    refetchInterval: 30_000,   // refresh nhanh hơn vì đây là dữ liệu action
    enabled: !isStaff,
  });

  const { data: revenueData } = useQuery({
    queryKey: ['revenue-7d'],
    queryFn: () => reportService.getRevenue({
      from: subDays(new Date(), 7).toISOString(),
      to: new Date().toISOString(),
      period: 'day',
    }).then(r => r.data.data),
    enabled: !isStaff,
  });

  // Số dư quỹ tiền mặt — MANAGER thấy kho mình, ADMIN thấy theo JWT
  const { data: cashBalance } = useQuery<CashBalance>({
    queryKey: ['cash-balance-dashboard'],
    queryFn: () => financeService.getCashbookBalance().then(r => r.data.data as CashBalance),
    refetchInterval: 60_000,
    enabled: !isStaff,
  });

  // Top 5 sản phẩm bán chạy hôm nay
  const todayStart = startOfDay(new Date()).toISOString();
  const todayNow   = new Date().toISOString();

  const { data: topProducts } = useQuery<TopProductItem[]>({
    queryKey: ['top-products-dashboard', todayStart],
    queryFn: () =>
      reportService.getTopProducts({
        from: todayStart,
        to: todayNow,
        limit: 5,
      }).then(r => {
        const raw = r.data?.data ?? r.data ?? [];
        return Array.isArray(raw) ? (raw as TopProductItem[]) : [];
      }),
    refetchInterval: 60_000,
    enabled: !isStaff,
  });

  // Công nợ nhà cung cấp chưa thanh toán
  // MANAGER → backend tự scope theo kho JWT
  // ADMIN   → backend lấy tất cả (warehouseId null → findAll not PAID)
  const { data: supplierDebts } = useQuery<SupplierDebtItem[]>({
    queryKey: ['supplier-debts-dashboard'],
    queryFn: () =>
      financeService.getOutstandingDebts()
        .then(r => {
          const raw = r.data?.data ?? [];
          // Sắp xếp theo remainingAmount giảm dần, lấy top 5
          return [...raw as SupplierDebtItem[]]
            .sort((a, b) => b.remainingAmount - a.remainingAmount)
            .slice(0, 5);
        }),
    refetchInterval: 60_000,
    enabled: !isStaff,
  });

  // Audit log — CHỈ gọi khi là ADMIN, lấy 12 bản ghi gần nhất
  const { data: auditLogs } = useQuery<AuditLogResponse[]>({
    queryKey: ['audit-logs-dashboard'],
    queryFn: () =>
      adminService.getAuditLogs(12).then(r => r.data.data as AuditLogResponse[]),
    refetchInterval: 30_000,
    enabled: !isStaff && isAdmin(),   // chỉ ADMIN mới gọi
  });

  if (loadingSummary && !isStaff) return <PageLoader />;

  const chartData = (revenueData ?? []).map((d: any) => ({
    name: d.period ? format(new Date(d.period), 'dd/MM') : '',
    'Doanh thu': Math.round((d.revenue ?? 0) / 1000),
    'Lợi nhuận': Math.round((d.gross_profit ?? 0) / 1000),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Xin chào, {user?.fullName} 👋</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {user?.warehouseName ?? 'Tổng quan toàn hệ thống'} • {format(new Date(), 'EEEE, dd/MM/yyyy')}
          </p>
        </div>

        {/* WS Status badge — chỉ hiện khi có warehouseId */}
        {user?.warehouseId && !isStaff && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium
            ${wsConnected
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            {wsConnected ? 'Cập nhật tức thì' : 'Đang kết nối...'}
          </div>
        )}
      </div>

      {isStaff ? (
        <div className="card p-8 text-center text-gray-500 mt-6">
          <p className="text-lg">Bạn đang đăng nhập với quyền <strong>Thu ngân</strong>.</p>
          <p className="text-sm mt-2">Vui lòng điều hướng tới màn hình Bán hàng (POS) để thực hiện nghiệp vụ.</p>
          <Link to="/pos" className="btn-primary inline-flex mt-6 px-6 py-2 rounded-lg text-white">
            Đi đến màn hình Bán hàng <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard 
              icon={DollarSign}    
              label="Doanh thu hôm nay"    
              value={formatCurrency(revenueTodayAmount)} 
              sub={`${invoiceCountToday} hóa đơn • Lãi gộp: ${formatCurrency(grossProfitToday)}`}  
              color="bg-primary-500" 
            />
            <KPICard icon={ShoppingBag}   label="Đơn hàng mới"         value={String(pendingOrders?.totalElements ?? 0)} sub="Đang chờ xử lý" color="bg-amber-500" />
            <KPICard icon={AlertTriangle} label="Tồn kho thấp"         value={String(lowStock?.length ?? 0)} sub="Sản phẩm" color="bg-red-500" />
            <KPICard icon={Clock}         label="Ca chờ duyệt"         value={String(pendingShifts?.length ?? 0)} sub="Cần Manager xem" color="bg-purple-500" />
          </div>

          {/* Charts + Quỹ row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Revenue chart — chiếm 2/4 cột */}
            <div className="card lg:col-span-2">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">Doanh thu 7 ngày qua (nghìn đồng)</h3>
              </div>
              <div className="p-4">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => `${v}k đ`} />
                      <Line type="monotone" dataKey="Doanh thu" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Lợi nhuận" stroke="#16a34a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={TrendingUp} title="Chưa có dữ liệu doanh thu" />
                )}
              </div>
            </div>

            {/* Số dư quỹ — chiếm 1/4 cột */}
            <CashBalanceWidget balance={cashBalance} />

            {/* Ca chờ duyệt — có nút Duyệt ngay */}
            <PendingShiftsWidget
              shifts={pendingShifts as ShiftResponse[] | undefined}
              onApprove={handleApproveShift}
              approvingId={approvingShiftId}
            />
          </div>

          {/* Orders + Top Products + Low stock row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Đơn hàng chờ xử lý */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800">Đơn hàng chờ xử lý</h3>
                <Link to="/orders" className="text-primary-600 text-sm hover:underline">Xem tất cả</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {(pendingOrders?.content ?? []).length === 0 ? (
                  <EmptyState icon={ShoppingBag} title="Không có đơn hàng chờ" />
                ) : (
                  (pendingOrders?.content ?? []).slice(0, 5).map((o: any) => (
                    <Link to={`/orders/${o.id}`} key={o.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{o.code}</p>
                        <p className="text-xs text-gray-400">{o.customerName} • {formatDateTime(o.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary-600">{formatCurrency(o.finalAmount)}</span>
                        <span className={`badge text-xs ${getOrderStatusColor(o.status)}`}>{getOrderStatusLabel(o.status)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Top sản phẩm bán chạy hôm nay */}
            <TopProductsWidget items={topProducts} />

            {/* Cảnh báo tồn kho thấp */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Cảnh báo tồn kho thấp
                </h3>
                <Link to="/inventory" className="text-primary-600 text-sm hover:underline">Xem kho</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {(lowStock ?? []).length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm py-8">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    Tất cả sản phẩm đủ hàng
                  </div>
                ) : (
                  (lowStock ?? []).slice(0, 6).map((inv) => {
                    const pct    = inv.minQuantity > 0 ? Math.round((inv.quantity / inv.minQuantity) * 100) : 100;
                    const danger = pct <= 50;
                    return (
                      <div key={inv.inventoryId} className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate" title={inv.productName}>
                              {inv.productName}
                            </p>
                            <p className="text-xs text-gray-400">
                              SKU: {inv.productSku} • Tồn:{' '}
                              <span className={danger ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
                                {inv.quantity}
                              </span>{' '}
                              / Min: {inv.minQuantity}
                            </p>
                          </div>
                        </div>
                        <span className={`badge text-xs flex-shrink-0 ${danger ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {danger ? 'Nguy hiểm' : 'Thấp'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Row cuối: Công nợ NCC | Audit Log (Admin only) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Công nợ NCC — 1/3 */}
            <SupplierDebtsWidget debts={supplierDebts} />

            {/* Audit Log — 2/3, CHỈ hiện với ADMIN */}
            {isAdmin() ? (
              <div className="lg:col-span-2">
                <AuditLogWidget logs={auditLogs} />
              </div>
            ) : (
              <div className="lg:col-span-2" />
            )}

          </div>
        </>
      )}

      {/* AI Chat toggle button */}
      {!showAI && (
        <button
          onClick={() => setShowAI(true)}
          className="fixed right-6 bottom-6 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-40"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
      {showAI && <AIChatPanel onClose={() => setShowAI(false)} />}
    </div>
  );
}