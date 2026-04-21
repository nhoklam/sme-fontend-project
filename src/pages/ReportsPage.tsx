import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { reportService } from '@/services/report.service';
import api from '@/lib/axios';
import { formatCurrency } from '@/lib/utils';
import { PageLoader } from '@/components/ui';
import { subDays, subMonths, startOfYear, format } from 'date-fns';
import { 
  LayoutDashboard, Package, TrendingDown, TrendingUp, DollarSign, 
  AlertCircle, Building2, Wallet, Percent, Activity, Box, BarChart3,
  Calendar, ShoppingBag, Users, ChevronDown
} from 'lucide-react';

const COLORS = ['#6366f1', '#14b8a6', '#f43f5e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#84cc16'];

type TimeFilter = '7d' | '30d' | '3m' | 'thisYear' | 'all';
type TabType = 'overview' | 'inventory' | 'dead-stock' | 'top-products';

// ==========================================
// 1. COMPONENT: TÙY CHỈNH TOOLTIP CAO CẤP (GLASSMORPHISM)
// ==========================================
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 min-w-[220px] transition-all duration-200">
        <p className="font-semibold text-slate-800 mb-3 border-b border-slate-100/80 pb-2 text-sm">{label}</p>
        <div className="space-y-2.5">
          {payload.map((entry: any, index: number) => {
            const isCount = entry.name === 'Số đơn hàng' || entry.name === 'Số lượng';
            const displayValue = isCount 
              ? Number(entry.value).toLocaleString('vi-VN') 
              : formatCurrency(entry.value);
              
            return (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-slate-500">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{displayValue}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

// ==========================================
// 2. COMPONENT: NÚT CHỌN THỜI GIAN (SEGMENTED CONTROL STYLE)
// ==========================================
const TimeFilterGroup = ({ active, onChange }: { active: TimeFilter, onChange: (val: TimeFilter) => void }) => {
  const options = [
    { id: '7d', label: '7 ngày' },
    { id: '30d', label: '30 ngày' },
    { id: '3m', label: '3 tháng' },
    { id: 'thisYear', label: 'Năm nay' },
    { id: 'all', label: 'Tất cả' }
  ];
  return (
    <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 overflow-x-auto no-scrollbar max-w-full">
      {options.map(opt => (
        <button 
          key={opt.id} 
          onClick={() => onChange(opt.id as TimeFilter)}
          className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            active === opt.id 
              ? 'bg-white text-slate-900 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

// ==========================================
// 3. TAB: HÀNG TỒN ĐỌNG (DEAD STOCK)
// ==========================================
const DeadStockTab = ({ warehouseId }: { warehouseId: string }) => {
  const [days, setDays] = useState<number>(90);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['dead-stock', days, warehouseId],
    queryFn: () => reportService.getDeadStock({ days, warehouseId: warehouseId || undefined }).then(r => r.data?.data || r.data || []),
  });

  const safeData = Array.isArray(rawData) ? rawData : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Chi tiết Hàng tồn đọng</h3>
          <p className="text-sm text-slate-500 mt-1">Sản phẩm còn tồn kho nhưng không phát sinh giao dịch</p>
        </div>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="block w-full pl-9 pr-10 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            <option value={30}>Không GD trên 30 ngày</option>
            <option value={60}>Không GD trên 60 ngày</option>
            <option value={90}>Không GD trên 90 ngày</option>
            <option value={120}>Không GD trên 120 ngày</option>
            <option value={180}>Không GD trên 180 ngày</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12"><PageLoader /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Mã SKU / Barcode</th>
                  <th className="px-6 py-4">Tên Sản phẩm</th>
                  <th className="px-6 py-4">Kho hàng</th>
                  <th className="px-6 py-4 text-right">Tồn kho hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {safeData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                          <AlertCircle className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="font-medium text-slate-900 text-base">Tuyệt vời!</p>
                        <p className="text-slate-500 text-sm mt-1">Không có hàng tồn đọng quá {days} ngày.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  safeData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 group-hover:text-slate-700">{item.isbn_barcode || item.sku || item.product_sku || '-'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{item.product_name || item.productName || 'Không rõ'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/60 text-slate-600 text-xs font-medium">
                          {item.warehouse_name || item.warehouseName || 'Tất cả'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold text-sm">
                          {Number(item.quantity ?? item.stock_qty ?? item.total_qty ?? 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4. TAB: TOP SẢN PHẨM BÁN CHẠY
// ==========================================
const TopProductsTab = ({ warehouseId }: { warehouseId: string }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [limit, setLimit] = useState<number>(20);

  const dateRange = {
    '7d':       { from: subDays(new Date(), 7).toISOString(),   to: new Date().toISOString() },
    '30d':      { from: subDays(new Date(), 30).toISOString(),  to: new Date().toISOString() },
    '3m':       { from: subMonths(new Date(), 3).toISOString(), to: new Date().toISOString() },
    'thisYear': { from: startOfYear(new Date()).toISOString(),  to: new Date().toISOString() },
    'all':      { from: new Date('2020-01-01').toISOString(),   to: new Date().toISOString() },
  }[timeFilter];

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['top-products-detail', timeFilter, limit, warehouseId],
    queryFn: () => reportService.getTopProducts({ ...dateRange, limit, warehouseId: warehouseId || undefined }).then(r => r.data?.data || r.data || []),
  });

  const safeData = Array.isArray(rawData) ? rawData : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <TimeFilterGroup active={timeFilter} onChange={setTimeFilter} />

        <div className="relative group w-full lg:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <select 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
            className="block w-full lg:w-auto pl-9 pr-10 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow hover:bg-slate-50 cursor-pointer shadow-sm"
          >
            <option value={10}>Hiển thị Top 10</option>
            <option value={20}>Hiển thị Top 20</option>
            <option value={50}>Hiển thị Top 50</option>
            <option value={100}>Hiển thị Top 100</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12"><PageLoader /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-center w-24">Xếp hạng</th>
                  <th className="px-6 py-4">Tên Sản phẩm</th>
                  <th className="px-6 py-4 text-right">Số lượng bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {safeData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-16 text-center text-slate-500">
                      Không có dữ liệu bán hàng trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  safeData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-slate-200 text-slate-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{item.name || item.product_name || 'Không rõ'}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">
                        {Number(item.total_sold ?? 0).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 5. TRANG CHÍNH: BÁO CÁO (REPORTS PAGE)
// ==========================================
export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [warehouseId, setWarehouseId] = useState<string>('');

  const dateRange = {
    '7d':       { from: subDays(new Date(), 7).toISOString(),   to: new Date().toISOString(), period: 'day' },
    '30d':      { from: subDays(new Date(), 30).toISOString(),  to: new Date().toISOString(), period: 'day' },
    '3m':       { from: subMonths(new Date(), 3).toISOString(), to: new Date().toISOString(), period: 'week' },
    'thisYear': { from: startOfYear(new Date()).toISOString(),  to: new Date().toISOString(), period: 'month' },
    'all':      { from: new Date('2020-01-01').toISOString(),   to: new Date().toISOString(), period: 'year' },
  }[timeFilter];

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(r => r.data?.data || []),
  });

  const { data: revenue, isLoading: isRevLoading } = useQuery({
    queryKey: ['revenue', timeFilter, warehouseId],
    queryFn: () => reportService.getRevenue({ ...dateRange, warehouseId: warehouseId || undefined }).then(r => r.data.data),
  });

  const { data: topProducts, isLoading: isTopLoading } = useQuery({
    queryKey: ['top-products', timeFilter, warehouseId],
    queryFn: () => reportService.getTopProducts({ ...dateRange, limit: 10, warehouseId: warehouseId || undefined }).then(r => r.data.data),
  });

  const { data: inventoryValue, isLoading: isInvLoading } = useQuery({
    queryKey: ['inventory-value', warehouseId],
    queryFn: () => reportService.getInventoryValue(warehouseId || undefined).then(r => r.data.data),
  });

  if (isRevLoading || isInvLoading) return <PageLoader />;

  // --- XỬ LÝ DỮ LIỆU ---
  const chartData = (revenue ?? []).map((d: any) => {
    let nameFormat = 'dd/MM';
    if (dateRange.period === 'year') nameFormat = 'yyyy';
    else if (dateRange.period === 'month') nameFormat = 'MM/yyyy';
    else if (dateRange.period === 'week') nameFormat = "'Tuần' w, yyyy";

    return {
      name: d.period ? format(new Date(d.period), nameFormat) : '',
      'Doanh thu': Number(d.revenue ?? 0),
      'COGS':      Number(d.cogs ?? 0),
      'Lợi nhuận': Number(d.gross_profit ?? 0),
      'Số đơn hàng': Number(d.invoice_count ?? 0),
    };
  });

  const topProductsData = (topProducts ?? []).map((d: any) => ({
    name: String(d.name ?? 'SP').substring(0, 20) + (String(d.name).length > 20 ? '...' : ''),
    'Số lượng': Number(d.total_sold ?? 0),
  }));

  const totalRevenue = (revenue ?? []).reduce((s: number, d: any) => s + Number(d.revenue ?? 0), 0);
  const totalGrossProfit = (revenue ?? []).reduce((s: number, d: any) => s + Number(d.gross_profit ?? 0), 0);
  const margin = totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  const safeInventoryData = Array.isArray(inventoryValue) ? inventoryValue : [];
  const totalSystemQty = safeInventoryData.reduce((sum, item) => sum + Number(item.total_qty ?? 0), 0);
  const totalSystemValue = safeInventoryData.reduce((sum, item) => sum + Number(item.total_value ?? 0), 0);
  const totalSystemSku = safeInventoryData.reduce((sum, item) => sum + Number(item.sku_count ?? 0), 0);

  return (
    // Nền trắng tao nhã, chữ xám đen, loại bỏ -m-6 nếu không cần thiết, ở đây giữ nguyên cấu trúc cũ gọn gàng
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-8 font-sans pb-16 max-w-[1600px] mx-auto">
      
      {/* --- HEADER & GLOBAL WAREHOUSE FILTER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Báo cáo & Phân tích</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Theo dõi hiệu suất kinh doanh và tối ưu hóa vận hành.</p>
        </div>
        
        <div className="relative group w-full md:w-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Building2 className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="block w-full md:w-72 pl-10 pr-10 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm cursor-pointer transition-all hover:border-slate-300"
          >
            <option value="">Toàn hệ thống</option>
            {warehouses?.map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* --- TABS NAVIGATION (Thiết kế thanh lịch, underline tinh tế) --- */}
      <div className="border-b border-slate-200/80 overflow-x-auto no-scrollbar">
        <div className="flex gap-8 min-w-max pb-[1px]">
          {[
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'inventory', label: 'Giá trị tồn kho', icon: Package },
            { id: 'dead-stock', label: 'Hàng tồn đọng', icon: TrendingDown },
            { id: 'top-products', label: 'Sản phẩm bán chạy', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 pb-4 text-sm font-semibold transition-all relative ${
                  isActive 
                    ? 'text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- 1. TAB TỔNG QUAN --- */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 hidden sm:block">Chỉ số kinh doanh</h2>
            <div className="flex-1 sm:flex-none flex justify-end">
              <TimeFilterGroup active={timeFilter} onChange={setTimeFilter} />
            </div>
          </div>

          {/* COMPACT KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            <KPICard title="Tổng doanh thu" value={formatCurrency(totalRevenue)} icon={Wallet} color="text-indigo-600" bg="bg-indigo-50/50" />
            <KPICard title="Lợi nhuận gộp" value={formatCurrency(totalGrossProfit)} icon={DollarSign} color="text-teal-600" bg="bg-teal-50/50" />
            <KPICard title="Biên lợi nhuận" value={`${margin}%`} icon={Percent} color="text-rose-500" bg="bg-rose-50/50" />
            <KPICard title="Tổng đơn hàng" value={(revenue ?? []).reduce((s:number, d:any)=>s+(d.invoice_count||0),0).toLocaleString('vi-VN')} icon={ShoppingBag} color="text-amber-500" bg="bg-amber-50/50" />
          </div>

          {/* CHUYỂN SANG BỐ CỤC TỶ LỆ VÀNG (2:1 Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Biểu đồ Doanh thu - Cột lớn chiếm 2/3 không gian */}
            <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Biến động Doanh thu & Lợi nhuận</h3>
                  <p className="text-sm text-slate-500 mt-1">Xu hướng tăng trưởng trong khoảng thời gian đã chọn</p>
                </div>
              </div>
              <div className="flex-1 w-full min-h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} 
                      dy={15} 
                    />
                    <YAxis 
                      yAxisId="left" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} 
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(0)}Tr` : `${val / 1000}k`} 
                      dx={-10} 
                    />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Legend wrapperStyle={{ paddingTop: '24px' }} iconType="circle" />
                    
                    <Area 
                      yAxisId="left" 
                      type="monotone" 
                      name="Doanh thu" 
                      dataKey="Doanh thu" 
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }} 
                    />
                    <Area 
                      yAxisId="left" 
                      type="monotone" 
                      name="Lợi nhuận" 
                      dataKey="Lợi nhuận" 
                      stroke="#0d9488" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorProfit)" 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#0d9488' }} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Sản phẩm Mini - Cột nhỏ chiếm 1/3 không gian */}
            <div className="lg:col-span-1 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col">
              <div className="mb-8">
                <h3 className="text-base font-bold text-slate-900">Sản phẩm nổi bật</h3>
                <p className="text-sm text-slate-500 mt-1">Top 10 sản phẩm bán chạy nhất</p>
              </div>
              <div className="flex-1 w-full min-h-[360px]">
                {topProductsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} 
                        width={100} 
                      />
                      <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                      <Bar 
                        dataKey="Số lượng" 
                        fill="#e0e7ff" 
                        radius={[0, 6, 6, 0]} 
                        barSize={24}
                        label={{ position: 'right', fill: '#4f46e5', fontSize: 12, fontWeight: 700, formatter: (val: number) => val.toLocaleString() }}
                      >
                        {topProductsData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : index === 1 ? '#6366f1' : index === 2 ? '#818cf8' : '#e0e7ff'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>}
              </div>
            </div>
          </div>

          {/* Tóm tắt Tồn Kho - Thiết kế dạng List sạch sẽ */}
          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 p-6 sm:p-8">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Tóm tắt Giá trị Tồn kho <span className="font-normal text-slate-500 ml-1">({warehouseId ? 'Kho hiện tại' : 'Toàn hệ thống'})</span></h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {safeInventoryData.slice(0, 4).map((d: any, i: number) => (
                <div key={i} className="flex flex-col p-5 rounded-2xl bg-slate-50/50 border border-slate-100/80 hover:bg-white hover:shadow-lg hover:border-slate-200 transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white shadow-sm border border-slate-100 text-indigo-600">
                      <Box className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-slate-800 text-sm truncate" title={d.warehouse_name || d.warehouseName}>
                      {d.warehouse_name || d.warehouseName}
                    </h4>
                  </div>
                  <p className="text-xl font-bold text-slate-900">{formatCurrency(Number(d.total_value ?? 0))}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500">
                    <span className="bg-slate-200/50 px-2 py-0.5 rounded text-slate-600">{Number(d.sku_count ?? 0).toLocaleString()} SKU</span>
                    <span>•</span>
                    <span>{Number(d.total_qty ?? 0).toLocaleString()} Sản phẩm</span>
                  </div>
                </div>
              ))}
              {safeInventoryData.length === 0 && <p className="text-slate-400 text-sm col-span-full">Chưa có dữ liệu tồn kho.</p>}
            </div>
          </div>
        </div>
      )}

      {/* --- 2. TAB GIÁ TRỊ TỒN KHO CHI TIẾT --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 lg:space-y-8 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <KPICard title="Tổng sản phẩm" value={totalSystemQty.toLocaleString('vi-VN')} icon={Package} color="text-indigo-600" bg="bg-indigo-50/50" />
            <KPICard title="Tổng mã hàng (SKU)" value={totalSystemSku.toLocaleString('vi-VN')} icon={Box} color="text-purple-600" bg="bg-purple-50/50" />
            <KPICard title="Tổng giá trị ước tính" value={formatCurrency(totalSystemValue)} icon={DollarSign} color="text-teal-600" bg="bg-teal-50/50" />
          </div>

          <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Chi tiết theo {warehouseId ? 'kho đã chọn' : 'chi nhánh'}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 sm:px-8 py-5">Tên Chi Nhánh / Kho</th>
                    <th className="px-6 sm:px-8 py-5 text-right">Số lượng mã (SKU)</th>
                    <th className="px-6 sm:px-8 py-5 text-right">Tổng sản phẩm</th>
                    <th className="px-6 sm:px-8 py-5 text-right">Tổng giá trị vốn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/80">
                  {safeInventoryData.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">Không có dữ liệu tồn kho</td></tr>
                  ) : (
                    safeInventoryData.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 sm:px-8 py-6 font-bold text-slate-900 text-base">
                          {item.warehouse_name || item.warehouseName}
                        </td>
                        <td className="px-6 sm:px-8 py-6 text-right font-medium text-slate-600">
                          {Number(item.sku_count ?? 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-6 sm:px-8 py-6 text-right font-medium text-slate-700">
                          {Number(item.total_qty ?? 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-6 sm:px-8 py-6 text-right font-black text-slate-900 text-base">
                          {formatCurrency(Number(item.total_value ?? 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- CÁC TABS KHÁC --- */}
      {activeTab === 'dead-stock' && <DeadStockTab warehouseId={warehouseId} />}
      {activeTab === 'top-products' && <TopProductsTab warehouseId={warehouseId} />}
    </div>
  );
}

// ==========================================
// 6. COMPONENT PHỤ: Ô KPI (PREMIUM CLEAN DESIGN)
// ==========================================
function KPICard({ title, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-slate-100 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-slate-200 group">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}