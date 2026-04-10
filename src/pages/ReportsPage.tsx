import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { reportService } from '@/services/report.service';
import api from '@/lib/axios';
import { formatCurrency } from '@/lib/utils';
import { PageLoader } from '@/components/ui';
import { subDays, subMonths, startOfYear, format } from 'date-fns';
import { 
  LayoutDashboard, Package, TrendingDown, TrendingUp, DollarSign, 
  AlertCircle, Building2, Wallet, Percent, Activity, Box, BarChart3
} from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

type TimeFilter = '7d' | '30d' | '3m' | 'thisYear' | 'all';
type TabType = 'overview' | 'inventory' | 'dead-stock' | 'top-products';

// --- COMPONENT CHUNG: TIME FILTER BUTTONS ---
const TimeFilterGroup = ({ active, onChange }: { active: TimeFilter, onChange: (val: TimeFilter) => void }) => {
  const options = [
    { id: '7d', label: '7 ngày qua' },
    { id: '30d', label: '30 ngày qua' },
    { id: '3m', label: '3 tháng qua' },
    { id: 'thisYear', label: 'Năm nay' },
    { id: 'all', label: 'Tất cả' }
  ];
  return (
    <div className="flex flex-wrap gap-1.5 p-1 bg-gray-50 border border-gray-200 rounded-lg">
      {options.map(opt => (
        <button 
          key={opt.id} 
          onClick={() => onChange(opt.id as TimeFilter)}
          className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
            active === opt.id 
              ? 'bg-white text-primary-600 shadow-sm border border-gray-200/50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

// --- COMPONENT: TAB HÀNG TỒN ĐỌNG (DEAD STOCK) ---
const DeadStockTab = ({ warehouseId }: { warehouseId: string }) => {
  const [days, setDays] = useState<number>(90);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['dead-stock', days, warehouseId],
    queryFn: () => reportService.getDeadStock({ days, warehouseId: warehouseId || undefined }).then(r => r.data?.data || r.data || []),
  });

  const safeData = Array.isArray(rawData) ? rawData : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Chi tiết Hàng tồn đọng</h3>
          <p className="text-sm text-gray-500 mt-0.5">Sản phẩm còn tồn kho nhưng không phát sinh giao dịch</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap"><Activity className="w-4 h-4 inline-block mr-1.5 text-gray-400"/>Không giao dịch:</label>
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="border-gray-300 bg-white rounded-lg text-sm font-medium focus:ring-primary-500 focus:border-primary-500 py-1.5 px-3"
          >
            <option value={30}>Trên 30 ngày</option>
            <option value={60}>Trên 60 ngày</option>
            <option value={90}>Trên 90 ngày</option>
            <option value={120}>Trên 120 ngày</option>
            <option value={180}>Trên 180 ngày</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12"><PageLoader /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[11px] tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Mã SKU / Barcode</th>
                  <th className="px-6 py-4">Tên Sản phẩm</th>
                  <th className="px-6 py-4">Kho hàng</th>
                  <th className="px-6 py-4 text-right">Tồn kho hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {safeData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <AlertCircle className="w-10 h-10 mb-3 text-green-500 opacity-50" />
                        <p className="font-medium text-gray-600">Tuyệt vời! Không có hàng tồn đọng quá {days} ngày.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  safeData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.isbn_barcode || item.sku || item.product_sku || '-'}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.product_name || item.productName || 'Không rõ'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium">
                          {item.warehouse_name || item.warehouseName || 'Tất cả'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-rose-600 font-bold">
                        {Number(item.quantity ?? item.stock_qty ?? item.total_qty ?? 0).toLocaleString()}
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

// --- COMPONENT: TAB TOP SẢN PHẨM BÁN CHẠY (TOP PRODUCTS) ---
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <TimeFilterGroup active={timeFilter} onChange={setTimeFilter} />

        <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap"><BarChart3 className="w-4 h-4 inline-block mr-1.5 text-gray-400"/>Hiển thị:</label>
          <select 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border-gray-300 bg-white rounded-lg text-sm font-medium focus:ring-primary-500 focus:border-primary-500 py-1.5 px-3"
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12"><PageLoader /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[11px] tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4 text-center w-20">Hạng</th>
                  <th className="px-6 py-4">Tên Sản phẩm</th>
                  <th className="px-6 py-4 text-right">Số lượng bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {safeData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-16 text-center text-gray-400 font-medium">
                      Không có dữ liệu bán hàng trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  safeData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs shadow-sm border ${
                          index === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          index === 1 ? 'bg-gray-100 text-gray-600 border-gray-200' :
                          index === 2 ? 'bg-orange-50 text-orange-600 border-orange-200' :
                          'bg-white text-gray-500 border-gray-100'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name || item.product_name || 'Không rõ'}</td>
                      <td className="px-6 py-4 text-right text-primary-600 font-bold text-base">
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

// --- TRANG CHÍNH ---
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
      'Doanh thu': Math.round(Number(d.revenue ?? 0) / 1000),
      'COGS':      Math.round(Number(d.cogs ?? 0) / 1000),
      'Lợi nhuận': Math.round(Number(d.gross_profit ?? 0) / 1000),
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
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1600px] mx-auto">
      
      {/* --- HEADER & GLOBAL WAREHOUSE FILTER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Báo cáo & Phân tích</h1>
          <p className="text-sm text-gray-500 mt-1">Theo dõi các chỉ số kinh doanh và tồn kho theo thời gian thực</p>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 w-full md:w-auto">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
            <Building2 className="w-4 h-4 text-primary-600" />
          </div>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="bg-transparent border-none text-sm font-bold text-gray-800 focus:ring-0 cursor-pointer pr-8 w-full md:w-auto outline-none"
          >
            <option value="">Toàn hệ thống (Tất cả chi nhánh)</option>
            {warehouses?.map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 inline-flex w-full md:w-auto overflow-x-auto no-scrollbar">
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
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* --- 1. TAB TỔNG QUAN --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Filter cho Tổng quan */}
          <div className="flex justify-end">
            <TimeFilterGroup active={timeFilter} onChange={setTimeFilter} />
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><Wallet className="w-7 h-7" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng doanh thu</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign className="w-7 h-7" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Lợi nhuận gộp</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-1">{formatCurrency(totalGrossProfit)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-purple-50 text-purple-600 rounded-xl"><Percent className="w-7 h-7" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Biên lợi nhuận</p>
                <p className="text-3xl font-extrabold text-purple-600 mt-1">{margin}%</p>
              </div>
            </div>
          </div>

          {/* Biểu đồ Doanh thu */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Biến động Doanh thu & Lợi nhuận</h3>
                <p className="text-xs text-gray-500 mt-0.5">Đơn vị tiền tệ: Nghìn VNĐ</p>
              </div>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} tickMargin={12} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${val.toLocaleString()}`} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#d97706' }} axisLine={false} tickLine={false} />
                  
                  <Tooltip 
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }}
                    formatter={(v: number, name: string) => {
                      if (name === 'Số đơn hàng') return [`${v} đơn`, name];
                      return [`${v.toLocaleString()}k đ`, name];
                    }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '24px' }} iconType="circle" />
                  <Line yAxisId="left" type="monotone" dataKey="Doanh thu" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line yAxisId="left" type="monotone" dataKey="Lợi nhuận" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line yAxisId="right" type="monotone" dataKey="Số đơn hàng" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Biểu đồ Top Sản Phẩm */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="p-5 border-b border-gray-50 bg-gray-50/30">
                <h3 className="text-lg font-bold text-gray-900">Top 10 Sản phẩm bán chạy</h3>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-center">
                {topProductsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={140} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="Số lượng" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-gray-400 py-12 text-sm font-medium">Chưa có dữ liệu bán hàng</p>}
              </div>
            </div>

            {/* List Tồn Kho Mini */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="p-5 border-b border-gray-50 bg-gray-50/30">
                <h3 className="text-lg font-bold text-gray-900">Giá trị Tồn kho ({warehouseId ? 'Chi nhánh hiện tại' : 'Toàn hệ thống'})</h3>
              </div>
              <div className="p-2 flex-1">
                {safeInventoryData.length > 0 ? (
                  <div className="p-2 space-y-2">
                    {safeInventoryData.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                            <Box className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{d.warehouse_name || d.warehouseName}</span>
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                              {Number(d.sku_count ?? 0).toLocaleString()} mã SKU
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-gray-900 text-base">{formatCurrency(Number(d.total_value ?? 0))}</p>
                          <p className="text-gray-500 text-xs font-medium mt-0.5">{Number(d.total_qty ?? 0).toLocaleString()} SP</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-center text-gray-400 py-12 text-sm font-medium">Chưa có dữ liệu tồn kho</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 2. TAB GIÁ TRỊ TỒN KHO CHI TIẾT --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><Package className="w-7 h-7" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng số lượng tồn</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{totalSystemQty.toLocaleString('vi-VN')}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-purple-50 text-purple-600 rounded-xl"><Box className="w-7 h-7" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng số mã hàng (SKU)</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{totalSystemSku.toLocaleString('vi-VN')}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign className="w-7 h-7" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng giá trị ước tính</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-1">{formatCurrency(totalSystemValue)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-50 bg-gray-50/30">
              <h3 className="text-lg font-bold text-gray-900">Chi tiết Tồn kho theo {warehouseId ? 'kho đã chọn' : 'từng chi nhánh'}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase text-[11px] tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Tên Chi Nhánh / Kho</th>
                    <th className="px-6 py-4 text-right">Số lượng mã (SKU)</th>
                    <th className="px-6 py-4 text-right">Tổng sản phẩm (Cái)</th>
                    <th className="px-6 py-4 text-right">Tổng giá trị vốn (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {safeInventoryData.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-16 text-center text-gray-400 font-medium">Không có dữ liệu tồn kho</td></tr>
                  ) : (
                    safeInventoryData.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 text-base">
                          {item.warehouse_name || item.warehouseName}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md font-bold text-xs">
                            {Number(item.sku_count ?? 0).toLocaleString('vi-VN')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-gray-700">{Number(item.total_qty ?? 0).toLocaleString('vi-VN')}</td>
                        <td className="px-6 py-4 text-right text-emerald-600 font-extrabold text-base">{formatCurrency(Number(item.total_value ?? 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- 3. TAB HÀNG TỒN ĐỌNG --- */}
      {activeTab === 'dead-stock' && <DeadStockTab warehouseId={warehouseId} />}

      {/* --- 4. TAB SẢN PHẨM BÁN CHẠY --- */}
      {activeTab === 'top-products' && <TopProductsTab warehouseId={warehouseId} />}
    </div>
  );
}
