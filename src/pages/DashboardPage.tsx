import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp, MessageSquare, Send, X, Bot, CheckCircle, ChevronRight, Clock,
  Banknote, Landmark, Wallet, Trophy, CreditCard, UserCheck,
  History, Building2, PackageOpen, ShoppingCart, AlertTriangle, FileText,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Line } from 'recharts';
import { format, subDays, startOfDay, subMonths, startOfYear } from 'date-fns';
import toast from 'react-hot-toast';

import { reportService } from '@/services/report.service';
import { posService } from '@/services/pos.service';
import { financeService } from '@/services/finance.service';
import { adminService } from '@/services/admin.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PageLoader } from '@/components/ui';
import { useDashboardWebSocket } from '@/hooks/useDashboardWebSocket';

type TimeFilter = '7d' | '30d' | '3m' | 'thisYear';

// ── CUSTOM COMPONENTS ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 min-w-[220px]">
        <p className="font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-2 text-sm">{label}</p>
        <div className="space-y-3">
          {payload.map((entry: any, index: number) => {
            const isCount = entry.name === 'Số lượng' || entry.name === 'Số đơn hàng';
            const val = isCount ? Number(entry.value).toLocaleString('vi-VN') : formatCurrency(entry.value);
            return (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-slate-600">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{val}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const TimeFilterGroup = ({ active, onChange }: { active: TimeFilter, onChange: (val: TimeFilter) => void }) => {
  const options = [{ id: '7d', label: '7 ngày' }, { id: '30d', label: '30 ngày' }, { id: '3m', label: '3 tháng' }, { id: 'thisYear', label: 'Năm nay' }];
  return (
    <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 w-full sm:w-auto overflow-x-auto">
      {options.map(opt => (
        <button key={opt.id} onClick={() => onChange(opt.id as TimeFilter)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-1 sm:flex-none ${active === opt.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, isCashier, isAdmin } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = isCashier();

  // 1. STATES BỘ LỌC TÍCH HỢP
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  
  // KHỞI TẠO STATE AN TOÀN CHO MANAGER
  const [warehouseId, setWarehouseId] = useState<string>(() => {
    if (isAdmin()) return '';
    return user?.warehouseId || '';
  });

  const dateRange = {
    '7d':       { from: subDays(new Date(), 7).toISOString(),   to: new Date().toISOString(), period: 'day' },
    '30d':      { from: subDays(new Date(), 30).toISOString(),  to: new Date().toISOString(), period: 'day' },
    '3m':       { from: subMonths(new Date(), 3).toISOString(), to: new Date().toISOString(), period: 'week' },
    'thisYear': { from: startOfYear(new Date()).toISOString(),  to: new Date().toISOString(), period: 'month' },
  }[timeFilter];

  // 2. WEBSOCKET REAL-TIME
  const { isConnected: wsConnected } = useDashboardWebSocket({
    warehouseId: user?.warehouseId,
    enabled: !isStaff,
  });

  const queryWarehouseId = warehouseId || undefined;

  // 3. QUERIES DỮ LIỆU
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    enabled: isAdmin(),
  });

  // Lợi nhuận gộp & Doanh thu 
  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['revenue', timeFilter, queryWarehouseId],
    queryFn: () => reportService.getRevenue({ ...dateRange, warehouseId: queryWarehouseId }).then(r => r.data.data),
    enabled: !isStaff,
  });

  // Giá trị tồn kho
  const { data: inventoryValueData } = useQuery({
    queryKey: ['inventory-value', queryWarehouseId],
    queryFn: () => reportService.getInventoryValue(queryWarehouseId).then(r => r.data.data),
    enabled: !isStaff,
  });

  // Hàng tồn đọng
  const { data: deadStockList } = useQuery({
    queryKey: ['dead-stock', queryWarehouseId],
    queryFn: () => reportService.getDeadStock({ days: 90, warehouseId: queryWarehouseId }).then(r => Array.isArray(r.data?.data) ? r.data.data : []),
    enabled: !isStaff,
  });

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', timeFilter, queryWarehouseId],
    queryFn: () => reportService.getTopProducts({ ...dateRange, limit: 10, warehouseId: queryWarehouseId }).then(r => r.data.data),
    enabled: !isStaff,
  });

  // Các Widget phụ: Sổ quỹ, Ca chờ duyệt, Công nợ, Audit Logs
  const { data: cashBalance } = useQuery({
    queryKey: ['cash-balance', queryWarehouseId],
    queryFn: () => financeService.getCashbookBalance(queryWarehouseId).then(r => r.data.data),
    enabled: !isStaff,
  });

  const { data: pendingShifts } = useQuery({
    queryKey: ['pending-shifts', queryWarehouseId],
    queryFn: () => posService.getPendingShifts().then(r => r.data.data),
    enabled: !isStaff,
  });

  const { data: supplierDebts } = useQuery({
    queryKey: ['supplier-debts', queryWarehouseId],
    queryFn: () => financeService.getOutstandingDebts(queryWarehouseId).then(r => {
        const raw = r.data?.data ?? [];
        return [...raw].sort((a: any, b: any) => b.remainingAmount - a.remainingAmount).slice(0, 5);
      }),
    enabled: !isStaff,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminService.getAuditLogs(10).then(r => r.data.data),
    enabled: !isStaff && isAdmin(),
  });

  const handleApproveShift = async (shiftId: string) => {
    try {
      await posService.approveShift(shiftId);
      toast.success('Đã duyệt ca thành công');
      qc.invalidateQueries({ queryKey: ['pending-shifts'] });
      qc.invalidateQueries({ queryKey: ['cash-balance'] });
    } catch (e) { toast.error('Lỗi khi duyệt ca'); }
  };

  if (loadingRevenue && !isStaff) return <PageLoader />;

  // Xử lý data KPI
  const totalRevenue = (revenueData ?? []).reduce((s: number, d: any) => s + Number(d.revenue ?? 0), 0);
  const totalGrossProfit = (revenueData ?? []).reduce((s: number, d: any) => s + Number(d.gross_profit ?? 0), 0);
  const margin = totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100).toFixed(1) : '0.0';
  const totalOrders = (revenueData ?? []).reduce((s: number, d: any) => s + Number(d.invoice_count ?? 0), 0);
  
  const safeInventoryData = Array.isArray(inventoryValueData) ? inventoryValueData : [];
  const totalInvValue = safeInventoryData.reduce((sum, item) => sum + Number(item.total_value ?? 0), 0);

  // Tính tổng quỹ cục bộ
  const totalFund = (cashBalance?.CASH_111 || 0) + (cashBalance?.BANK_112 || 0);

  const chartData = (revenueData ?? []).map((d: any) => {
    let nameFormat = 'dd/MM';
    if (dateRange.period === 'month') nameFormat = 'MM/yyyy';
    else if (dateRange.period === 'week') nameFormat = "'Tuần' w, yyyy";
    return {
      dateRaw: d.period,
      name: d.period ? format(new Date(d.period), nameFormat) : '',
      revenue: Number(d.revenue ?? 0),
      gross_profit: Number(d.gross_profit ?? 0),
    };
  });

  const topProductsData = (topProducts ?? []).map((d: any) => ({
    name: String(d.name ?? 'SP').substring(0, 30) + (String(d.name).length > 30 ? '...' : ''),
    'Số lượng': Number(d.total_sold ?? 0),
  }));

  console.info("React DevTools message can be safely ignored in production.");

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
            Tổng quan Kinh doanh
            {queryWarehouseId && !isStaff && (
              <span className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${wsConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} /> Live
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> Dữ liệu được cập nhật tự động theo thời gian thực
          </p>
        </div>

        {!isStaff && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            {isAdmin() && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200/60 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6 w-full outline-none">
                  <option value="">Tất cả Chi nhánh</option>
                  {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            <TimeFilterGroup active={timeFilter} onChange={setTimeFilter} />
          </div>
        )}
      </div>

      {isStaff ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center justify-center text-center mt-6">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            <UserCheck className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Xin chào Thu ngân!</h2>
          <p className="text-slate-500 mb-8 max-w-md">Bạn đang đăng nhập với quyền thu ngân. Chuyển đến màn hình bán hàng để bắt đầu ca làm việc.</p>
          <Link to="/pos" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center px-8 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5">
            Vào Màn hình Bán hàng (POS) <ChevronRight className="w-5 h-5 ml-2" />
          </Link>
        </div>
      ) : (
        <>
          {/* ── DÀN THẺ KPI ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[
              { label: 'Doanh thu', value: formatCurrency(totalRevenue), icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-100' },
              { label: 'Lợi nhuận gộp', value: formatCurrency(totalGrossProfit), subLabel: `Biên LN: ${margin}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100', subColor: 'text-emerald-600 bg-emerald-100/50' },
              { label: 'Giá trị tồn kho', value: formatCurrency(totalInvValue), icon: PackageOpen, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
              { label: 'Đơn hoàn tất', value: totalOrders.toLocaleString('vi-VN'), icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
              { label: `Số dư quỹ ${queryWarehouseId ? '(Chi nhánh)' : '(Toàn bộ)'}`, value: formatCurrency(totalFund), icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-100' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-center gap-4 transition-all hover:shadow-lg hover:-translate-y-1 relative overflow-hidden group">
                <div className={`p-3.5 rounded-xl ${kpi.bg} ${kpi.color} ring-4 ${kpi.ring} transition-transform group-hover:scale-110`}>
                  <kpi.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-500 truncate mb-1">{kpi.label}</p>
                  {/* GIẢM SIZE VÀ TRACKING-TIGHT CHO KPI */}
                  <h3 className="text-base lg:text-lg font-bold tracking-tight text-slate-900 truncate">{kpi.value}</h3>
                  {kpi.subLabel && <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${kpi.subColor}`}>{kpi.subLabel}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* ── BIỂU ĐỒ & BẢNG CHI TIẾT (TỶ LỆ VÀNG 2:1) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Biểu đồ */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">Doanh thu & Lợi nhuận</h2>
              </div>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 600, color: '#475569' }} iconType="circle" />
                    <Bar dataKey="revenue" name="Doanh thu" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={45} />
                    <Line type="monotone" dataKey="gross_profit" name="Lợi nhuận gộp" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bảng dữ liệu kỳ này */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[456px] overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
                <FileText className="w-5 h-5 text-indigo-500"/>
                <h2 className="text-base font-bold text-slate-900">Bảng dữ liệu kỳ này</h2>
              </div>
              <div className="flex-1 overflow-x-auto custom-scrollbar p-2">
                <table className="w-full text-sm text-left min-w-[350px]">
                  <thead className="text-xs text-slate-500 uppercase font-bold sticky top-0 bg-white/90 backdrop-blur z-10">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-100">Thời gian</th>
                      <th className="px-4 py-3 text-right border-b border-slate-100">Doanh thu</th>
                      <th className="px-4 py-3 text-right border-b border-slate-100">Lãi gộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {chartData.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-12 text-slate-400 font-medium">Không có dữ liệu</td></tr>
                    ) : (
                      chartData.slice().reverse().map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-4 py-3.5 text-slate-700 font-semibold group-hover:text-indigo-600 transition-colors">{row.name}</td>
                          <td className="px-4 py-3.5 text-right text-indigo-600 font-bold tracking-tight">{formatCurrency(row.revenue)}</td>
                          <td className="px-4 py-3.5 text-right text-emerald-600 font-bold tracking-tight">{formatCurrency(row.gross_profit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── CẢNH BÁO TỒN KHO & TOP SẢN PHẨM (TỶ LỆ 1:1) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Hàng tồn đọng / sắp hết */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px] overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-rose-50/30">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <div className="p-1.5 bg-rose-100 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                  <h2 className="text-base font-bold text-slate-900">Cảnh báo Tồn đọng <span className="text-slate-500 font-medium text-sm ml-1">(&gt;90 ngày)</span></h2>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto custom-scrollbar p-2">
                <table className="w-full text-sm text-left min-w-[500px]">
                  <thead className="text-xs text-slate-500 font-bold sticky top-0 bg-white z-10">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-100">Tên Sản phẩm</th>
                      <th className="px-4 py-3 text-center border-b border-slate-100">SKU</th>
                      <th className="px-4 py-3 text-right border-b border-slate-100">Số lượng Tồn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {!deadStockList || deadStockList.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-16">
                           <CheckCircle className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
                           <p className="text-slate-500 font-medium">Kho hàng đang luân chuyển rất tốt</p>
                        </td>
                      </tr>
                    ) : (
                      deadStockList.slice(0,10).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-rose-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.product_name || item.productName}</td>
                          <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">{item.sku || item.isbn_barcode || '-'}</td>
                          <td className="px-4 py-3 text-right"><span className="inline-block px-3 py-1 bg-rose-100 text-rose-700 font-bold rounded-lg">{item.quantity ?? item.stock_qty ?? 0}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Sản phẩm */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[400px] overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-amber-50/30">
                <div className="flex items-center gap-2.5 text-amber-600">
                  <div className="p-1.5 bg-amber-100 rounded-lg"><Trophy className="w-5 h-5" /></div>
                  <h2 className="text-base font-bold text-slate-900">Top 10 Sản phẩm Bán chạy</h2>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto custom-scrollbar p-2">
                <table className="w-full text-sm text-left min-w-[500px]">
                  <thead className="text-xs text-slate-500 font-bold sticky top-0 bg-white z-10">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-100 w-12 text-center">Hạng</th>
                      <th className="px-4 py-3 border-b border-slate-100">Sản phẩm</th>
                      <th className="px-4 py-3 text-right border-b border-slate-100">Đã bán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topProductsData.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-16 text-slate-400 font-medium">Chưa có dữ liệu giao dịch</td></tr>
                    ) : (
                      topProductsData.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="px-4 py-3 text-right font-black text-indigo-600 tracking-tight">{item['Số lượng']}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── WIDGETS VẬN HÀNH (1:1:1) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {/* Component Sổ quỹ */}
             <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Sổ quỹ</h3>
                  <Link to="/finance" className="text-indigo-600 text-sm font-semibold hover:underline">Chi tiết</Link>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/50">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-emerald-100"><Banknote className="w-5 h-5 text-emerald-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 mb-0.5">Tiền mặt (TK 111)</p>
                      {/* GIẢM SIZE VÀ TRACKING-TIGHT CHO QUỸ */}
                      <p className="text-base font-black tracking-tight text-emerald-700 truncate">{formatCurrency(cashBalance?.CASH_111 ?? 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-100/50">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100"><Landmark className="w-5 h-5 text-blue-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 mb-0.5">Ngân hàng (TK 112)</p>
                      {/* GIẢM SIZE VÀ TRACKING-TIGHT CHO QUỸ */}
                      <p className="text-base font-black tracking-tight text-blue-700 truncate">{formatCurrency(cashBalance?.BANK_112 ?? 0)}</p>
                    </div>
                  </div>
                </div>
             </div>

             {/* Ca chờ duyệt */}
             <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><UserCheck className="w-4 h-4 text-purple-500" /> Ca chờ duyệt</h3>
                  <Link to="/pos" className="text-indigo-600 text-sm font-semibold hover:underline">Trang POS</Link>
                </div>
                <div className="divide-y divide-slate-50 flex-1 overflow-y-auto custom-scrollbar h-[200px]">
                  {(!pendingShifts || pendingShifts.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400">
                      <CheckCircle className="w-10 h-10 mb-3 text-emerald-400" />
                      <p className="text-sm font-medium">Tất cả các ca đã được duyệt</p>
                    </div>
                  ) : (
                    pendingShifts.map((s: any) => (
                      <div key={s.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-bold text-slate-800 truncate">{s.cashierName ?? 'Thu ngân'}</p>
                          <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> {formatDateTime(s.closedAt ?? s.openedAt)}</p>
                          {s.discrepancyAmount !== 0 && <p className={`text-xs font-bold mt-1.5 inline-block px-2 py-0.5 rounded tracking-tight ${s.discrepancyAmount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>Lệch: {formatCurrency(s.discrepancyAmount)}</p>}
                        </div>
                        <button onClick={() => handleApproveShift(s.id)} className="bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0">Duyệt Ca</button>
                      </div>
                    ))
                  )}
                </div>
             </div>

             {/* Công nợ */}
             <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-rose-500" /> Công nợ NCC</h3>
                  <Link to="/finance" className="text-indigo-600 text-sm font-semibold hover:underline">Thanh toán</Link>
                </div>
                <div className="divide-y divide-slate-50 flex-1 overflow-y-auto custom-scrollbar h-[200px]">
                  {(!supplierDebts || supplierDebts.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-slate-400">
                      <CheckCircle className="w-10 h-10 mb-3 text-emerald-400" />
                      <p className="text-sm font-medium">Không có công nợ cần thanh toán</p>
                    </div>
                  ) : (
                    supplierDebts.map((d: any) => (
                      <div key={d.id} className="p-4 flex justify-between items-start hover:bg-slate-50 transition-colors">
                        <div className="flex-1 pr-4 min-w-0">
                          <p className="text-sm font-bold text-slate-800 line-clamp-1" title={d.supplierName}>{d.supplierName || 'Nhà cung cấp'}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{d.purchaseOrderCode}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-rose-600 tracking-tight">{formatCurrency(d.remainingAmount)}</p>
                          <p className="text-[11px] font-semibold text-slate-400 mt-1">Hạn: {d.dueDate ? new Date(d.dueDate).toLocaleDateString('vi-VN') : '---'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </div>
          
          {/* Audit Logs cho Admin */}
          {isAdmin() && auditLogs && auditLogs.length > 0 && (
             <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mt-6 overflow-hidden">
               <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <h3 className="font-bold text-slate-900 flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /> Nhật ký Hoạt động hệ thống</h3>
                 <Link to="/settings" className="text-indigo-600 text-sm font-semibold hover:underline">Xem tất cả</Link>
               </div>
               <div className="p-5 space-y-4">
                 {auditLogs.slice(0,5).map((log: any, idx: number) => (
                   <div key={idx} className="flex gap-4 text-sm group">
                     <div className="flex flex-col items-center">
                       <div className="w-2.5 h-2.5 rounded-full bg-indigo-200 group-hover:bg-indigo-500 transition-colors mt-1.5 shadow-sm"/>
                       {idx !== auditLogs.slice(0,5).length - 1 && <div className="w-px h-full bg-slate-100 mt-2"></div>}
                     </div>
                     <div className="flex-1 pb-4">
                       <p className="text-slate-700 leading-relaxed">
                         <span className="font-bold text-slate-900 mr-1.5">{log.changedBy}</span>
                         thực hiện <span className="font-semibold text-indigo-600 mx-1">{log.actionType}</span> 
                         trên <span className="font-medium text-slate-800">{log.entityName}</span>
                       </p>
                       <p className="text-xs font-medium text-slate-400 mt-1">{formatTimeAgo(log.changedAt)}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </>
      )}
    </div>
  );
}

// Hàm bổ trợ thời gian
function formatTimeAgo(isoStr: string) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return format(new Date(isoStr), 'dd/MM HH:mm');
}