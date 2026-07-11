/**
 * AdminBranchWidget — Các widget dành riêng cho Admin trong DashboardPage
 *
 * Gồm 2 component:
 *  1. AlertBranchesWidget — Danh sách chi nhánh "có vấn đề" (ca chưa duyệt, hàng hết...)
 *     Spec: Chỉ hiện tên Manager + SĐT để Admin gọi điện nhắc nhở.
 *           KHÔNG có nút "Duyệt tất cả" cho Admin bấm.
 *
 *  2. BranchRevenueWidget — So sánh doanh thu hôm nay vs hôm qua giữa các chi nhánh
 *
 * Cách tích hợp vào DashboardPage.tsx:
 * ─────────────────────────────────────
 * import { AlertBranchesWidget, BranchRevenueWidget } from '@/components/dashboard/AdminBranchWidget';
 *
 * // Trong phần return của DashboardPage, ngay sau KPI cards, TRƯỚC biểu đồ:
 * {isAdmin() && adminDashboard && (
 *   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 *     <AlertBranchesWidget branches={adminDashboard.alertBranches} />
 *     <BranchRevenueWidget branches={adminDashboard.revenueByBranch} />
 *   </div>
 * )}
 *
 * // Thêm query adminDashboard vào DashboardPage (sau các query hiện có):
 * const { data: adminDashboard } = useQuery({
 *   queryKey: ['admin-dashboard'],
 *   queryFn: () => dashboardService.getAdminDashboard().then(r => r.data.data),
 *   enabled: isAdmin(),
 *   refetchInterval: 60_000, // 1 phút refresh
 * });
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Phone, Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { AdminDashboardData } from '@/services/dashboard.service';

// ─────────────────────────────────────────────────────────────
// 1. ALERT BRANCHES WIDGET
// ─────────────────────────────────────────────────────────────
interface AlertBranchesProps {
  branches: AdminDashboardData['alertBranches'];
}

export function AlertBranchesWidget({ branches }: AlertBranchesProps) {
  if (!branches || branches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center justify-center h-[280px] text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
          <AlertTriangle className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="font-semibold text-slate-700">Tất cả chi nhánh hoạt động bình thường</p>
        <p className="text-xs text-slate-400 mt-1">Không có cảnh báo nào cần xử lý</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-amber-100 bg-amber-50/60 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Chi nhánh cần chú ý</h3>
          <p className="text-[11px] text-slate-500">{branches.length} chi nhánh có vấn đề</p>
        </div>
        <span className="ml-auto inline-flex items-center justify-center w-6 h-6 bg-amber-600 text-white rounded-full text-xs font-black">
          {branches.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
        {branches.map((branch) => (
          <div key={branch.warehouseId} className="px-5 py-4 hover:bg-amber-50/30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <p className="font-bold text-slate-900 text-sm truncate">{branch.name}</p>
                  {/* Theo Admin spec: chỉ hiện tên Manager + SĐT để gọi điện nhắc nhở
                      KHÔNG có nút "Duyệt tất cả" hay can thiệp trực tiếp */}
                  {branch.managerName && (
                    <span className="text-xs text-slate-500 font-medium shrink-0 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {branch.managerName}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {branch.issues.map((issue, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-semibold rounded-md">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin spec note: Không có nút "Duyệt tất cả" */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 italic">
          Liên hệ trực tiếp Manager chi nhánh để xử lý. Admin không can thiệp vận hành.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BRANCH REVENUE COMPARISON WIDGET
// ─────────────────────────────────────────────────────────────
interface BranchRevenueProps {
  branches: AdminDashboardData['revenueByBranch'];
}

const BRANCH_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6',
];

export function BranchRevenueWidget({ branches }: BranchRevenueProps) {
  if (!branches || branches.length === 0) return null;

  const chartData = branches.map((b, i) => ({
    name: b.name.length > 12 ? b.name.slice(0, 12) + '…' : b.name,
    fullName: b.name,
    today: b.today,
    yesterday: b.yesterday,
    color: BRANCH_COLORS[i % BRANCH_COLORS.length],
    trend: b.today > b.yesterday ? 'up' : b.today < b.yesterday ? 'down' : 'flat',
    change: b.yesterday > 0
      ? Math.round(((b.today - b.yesterday) / b.yesterday) * 100)
      : (b.today > 0 ? 100 : 0),
  }));

  const totalToday     = branches.reduce((s, b) => s + (b.today ?? 0), 0);
  const totalYesterday = branches.reduce((s, b) => s + (b.yesterday ?? 0), 0);
  const totalChange    = totalYesterday > 0
    ? Math.round(((totalToday - totalYesterday) / totalYesterday) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Doanh thu theo chi nhánh hôm nay</h3>
          <p className="text-[11px] text-slate-500">
            Tổng: <span className="font-bold text-indigo-700">{formatCurrency(totalToday)}</span>
            {' '}
            <span className={cn(
              'font-semibold',
              totalChange > 0 ? 'text-emerald-600' : totalChange < 0 ? 'text-red-500' : 'text-slate-400'
            )}>
              ({totalChange > 0 ? '+' : ''}{totalChange}% so hôm qua)
            </span>
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="px-4 pt-4 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={v => `${Math.round(v / 1e6)}M`}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
              contentStyle={{
                fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Bar dataKey="today" radius={[5, 5, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rank list */}
      <div className="px-4 pb-4 space-y-2 mt-2">
        {chartData
          .slice()
          .sort((a, b) => b.today - a.today)
          .slice(0, 4)
          .map((b, idx) => (
            <div key={b.name} className="flex items-center gap-2.5">
              <span className="w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-black"
                style={{ background: b.color + '22', color: b.color }}>
                {idx + 1}
              </span>
              <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{b.fullName}</span>
              <span className="text-xs font-bold text-slate-800">{formatCurrency(b.today)}</span>
              <span className={cn(
                'flex items-center gap-0.5 text-[10px] font-bold min-w-[40px] justify-end',
                b.trend === 'up' ? 'text-emerald-600' : b.trend === 'down' ? 'text-red-500' : 'text-slate-400'
              )}>
                {b.trend === 'up'   ? <TrendingUp   className="w-3 h-3" /> :
                 b.trend === 'down' ? <TrendingDown  className="w-3 h-3" /> :
                                     <Minus         className="w-3 h-3" />}
                {b.change > 0 ? '+' : ''}{b.change}%
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
