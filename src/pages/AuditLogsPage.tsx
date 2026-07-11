/**
 * AuditLogsPage — Nhật ký hệ thống (Admin only)
 *
 * Theo Admin spec mục IV.5:
 *   "Mọi hành động nhạy cảm (Tạo/Sửa/Xóa Sản phẩm, Hủy khẩn cấp, Đổi chi nhánh...)
 *    của bất kỳ ai trong hệ thống đều được ghi lại (Ai làm, làm lúc nào,
 *    dữ liệu cũ là gì, dữ liệu mới là gì). Admin dùng cái này để truy cứu trách nhiệm."
 *
 * Route: /audit-logs (Admin only)
 * Tích hợp vào App.tsx:
 *   import AuditLogsPage from '@/pages/AuditLogsPage';
 *   <Route path="audit-logs" element={<RoleRoute roles={['ROLE_ADMIN']}><AuditLogsPage /></RoleRoute>} />
 *
 * Tích hợp vào Sidebar.tsx (nhóm HỆ THỐNG):
 *   { icon: History, label: 'Nhật ký hệ thống', to: '/audit-logs', roles: ['ROLE_ADMIN'] }
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History, Search, Filter, ChevronLeft, ChevronRight,
  Plus, Pencil, Trash2, Zap, X, Calendar, User as UserIcon,
} from 'lucide-react';
import { adminService, AuditLogResponse } from '@/services/admin.service';
import { cn, formatDateTime } from '@/lib/utils';
import { PageLoader, EmptyState } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  CREATE: { label: 'Tạo mới', color: 'bg-emerald-100 text-emerald-700', icon: Plus },
  UPDATE: { label: 'Cập nhật', color: 'bg-blue-100 text-blue-700', icon: Pencil },
  DELETE: { label: 'Xóa', color: 'bg-red-100 text-red-600', icon: Trash2 },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action];
  if (cfg) {
    const Icon = cfg.icon;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold', cfg.color)}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  }
  // Business actions như FORCE_CANCEL_ORDER, REASSIGN_ORDER
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700">
      <Zap className="w-3 h-3" />{action.replace(/_/g, ' ')}
    </span>
  );
}

function JsonDiffView({ oldJson, newJson }: { oldJson: string | null; newJson: string | null }) {
  if (!oldJson && !newJson) return null;
  let oldObj: any = {}, newObj: any = {};
  try { oldObj = oldJson ? JSON.parse(oldJson) : {}; } catch {}
  try { newObj = newJson ? JSON.parse(newJson) : {}; } catch {}

  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  if (allKeys.length === 0) return null;

  return (
    <div className="mt-2 bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-100">
      {allKeys.map(key => (
        <div key={key} className="flex items-start gap-2 text-xs">
          <span className="font-mono font-semibold text-slate-500 min-w-[100px]">{key}:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {oldObj[key] !== undefined && (
              <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded line-through font-mono">
                {String(oldObj[key])}
              </span>
            )}
            {oldObj[key] !== undefined && newObj[key] !== undefined && <span className="text-slate-300">→</span>}
            {newObj[key] !== undefined && (
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-mono">
                {String(newObj[key])}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const ENTITY_OPTIONS = ['Người dùng', 'Sản phẩm', 'Chi nhánh', 'Đơn hàng', 'Ca làm việc', 'Kiểm kê'];
const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'FORCE_CANCEL_ORDER', 'REASSIGN_ORDER', 'APPROVE_STOCK_TAKE'];

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const [debouncedChangedBy, setDebouncedChangedBy] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', entityType, action, debouncedChangedBy, page],
    queryFn: () => adminService.getAuditLogs({
      entityType: entityType || undefined,
      action: action || undefined,
      changedBy: debouncedChangedBy || undefined,
      page,
      size: 25,
    }).then(r => r.data.data),
  });

  const hasActiveFilters = !!(entityType || action || debouncedChangedBy);
  const clearFilters = () => {
    setEntityType(''); setAction(''); setChangedBy(''); setDebouncedChangedBy(''); setPage(0);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-indigo-600" />
            Nhật ký hệ thống
          </h1>
          <p className="text-slate-500 text-sm mt-1">Theo dõi toàn bộ hành động nhạy cảm trong hệ thống</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors',
            hasActiveFilters ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          <Filter className="w-4 h-4" />
          Bộ lọc {hasActiveFilters && `(${[entityType, action, debouncedChangedBy].filter(Boolean).length})`}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Đối tượng</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={entityType}
              onChange={e => { setEntityType(e.target.value); setPage(0); }}
            >
              <option value="">Tất cả</option>
              {ENTITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Hành động</label>
            <select
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={action}
              onChange={e => { setAction(e.target.value); setPage(0); }}
            >
              <option value="">Tất cả</option>
              {ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Người thực hiện</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Tên đăng nhập..."
                value={changedBy}
                onChange={e => {
                  setChangedBy(e.target.value);
                  setTimeout(() => { setDebouncedChangedBy(e.target.value); setPage(0); }, 350);
                }}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X className="w-3.5 h-3.5" />Xóa lọc
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {data && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-bold text-slate-700">{data.totalElements}</span> bản ghi
          {hasActiveFilters && ' (đã lọc)'}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><PageLoader /></div>
        ) : !data || data.content.length === 0 ? (
          <EmptyState icon={History} title="Không có nhật ký nào" description="Chưa có hành động nào khớp với bộ lọc" />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.content.map((log, idx) => {
              const logKey = log.id ?? `${log.entityId}-${log.revision}-${idx}`;
              const isExpanded = expandedId === logKey;
              const hasDetail = log.source === 'BUSINESS_ACTION' && (log.oldValueJson || log.newValueJson);

              return (
                <div key={logKey} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div
                    className={cn('flex items-start gap-3', hasDetail && 'cursor-pointer')}
                    onClick={() => hasDetail && setExpandedId(isExpanded ? null : logKey)}
                  >
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">
                        <span className="font-bold text-slate-900">{log.changedBy ?? 'Hệ thống'}</span>
                        {' '}thực hiện{' '}
                        <ActionBadge action={log.actionType} />
                        {' '}trên{' '}
                        <span className="font-bold text-slate-700">{log.entityName}</span>
                        {log.entityId && (
                          <span className="text-slate-400 font-mono text-xs ml-1">
                            #{log.entityId.slice(0, 8)}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(log.changedAt)}
                        {log.revision != null && <span className="text-slate-300">· rev #{log.revision}</span>}
                      </p>
                      {isExpanded && hasDetail && (
                        <JsonDiffView oldJson={log.oldValueJson} newJson={log.newValueJson} />
                      )}
                    </div>
                    {hasDetail && (
                      <ChevronRight className={cn('w-4 h-4 text-slate-300 transition-transform shrink-0 mt-2', isExpanded && 'rotate-90')} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
            <span className="text-xs text-slate-500">Trang {data.currentPage + 1}/{data.totalPages}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
                disabled={page >= data.totalPages - 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
