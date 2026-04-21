import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  X, Package, Search, RefreshCw, Eye, MapPin, Store, Truck, Plus, 
  CheckCircle, Filter, ShoppingBag, ArrowRight, ChevronDown, BarChart3
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis
} from 'recharts';
import { orderService } from '@/services/order.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import { CreateOrderModal } from './CreateOrderModal'; 

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING',   label: 'Chờ xử lý' },
  { value: 'PACKING',   label: 'Đang đóng gói' },
  { value: 'SHIPPING',  label: 'Đang giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'RETURNED',  label: 'Hoàn trả' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả loại đơn' },
  { value: 'DELIVERY', label: 'Giao tận nơi' },
  { value: 'BOPIS',    label: 'Khách nhận tại quầy' },
];

// --- CẤU HÌNH UI BIỂU ĐỒ ---
const CHART_COLORS = ['#4f46e5', '#0d9488', '#f59e0b', '#e11d48', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100/80 min-w-[160px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-100/80 pb-1.5">{label || payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            <span className="text-sm font-medium text-slate-500">Số lượng:</span>
          </div>
          <span className="text-sm font-black text-slate-900">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function OrdersPage() {
  const { user, isAdmin, isManager } = useAuthStore();
  
  const [status, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); 
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // State Quản lý Modal Đánh chặn Shipping
  const [shippingOrder, setShippingOrder] = useState<any | null>(null);
  const [shippingProvider, setShippingProvider] = useState('');
  const [trackingCode, setTrackingCode] = useState('');

  const qc = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-dict'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
    enabled: isAdmin(),
  });

  const { data: pagedData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orders', status, typeFilter, page, warehouseId, debouncedKeyword],
    queryFn: async () => {
      const res = await orderService.getOrders({ 
        status: status || undefined, 
        type: typeFilter || undefined, 
        keyword: debouncedKeyword || undefined, 
        page, 
        size: 20,
        warehouseId: isAdmin() ? (warehouseId || undefined) : user?.warehouseId
      });
      return res.data.data; 
    }
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      orderService.updateStatus(id, body),
    onSuccess: async () => { 
      toast.success('Cập nhật trạng thái thành công'); 
      await qc.invalidateQueries({ queryKey: ['orders'] }); 
      setShippingOrder(null); 
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Lỗi cập nhật'),
  });

  const nextStatus: Record<string, string> = {
    PENDING: 'PACKING', 
    PACKING: 'SHIPPING', 
    SHIPPING: 'DELIVERED',
    DELIVERED: 'RETURNED'
  };

  const handleQuickUpdate = (order: any) => {
    const nextStatusStr = nextStatus[order.status];
    
    if (order.status === 'PACKING' && order.type === 'DELIVERY') {
      setShippingProvider('');
      setTrackingCode('');
      setShippingOrder(order); 
      return;
    }
    
    updateMut.mutate({ id: order.id, body: { status: nextStatusStr } });
  };

  const handleConfirmShippingModal = () => {
    if (!shippingOrder) return;
    updateMut.mutate({ 
      id: shippingOrder.id, 
      body: { 
        status: 'SHIPPING', 
        shippingProvider, 
        trackingCode 
      } 
    });
  };

  const displayList = pagedData?.content ?? [];

  // --- TÍNH TOÁN DATA CHO MINI DASHBOARD ---
  const dashboardStats = useMemo(() => {
    let delivery = 0, bopis = 0;
    const statusMap: Record<string, { count: number, color: string }> = {};

    displayList.forEach((o: any) => {
      if (o.type === 'DELIVERY') delivery++;
      else if (o.type === 'BOPIS') bopis++;

      const statusLabel = getOrderStatusLabel(o.status);
      if (!statusMap[statusLabel]) {
        // Gán màu ngẫu nhiên nhưng ổn định dựa trên logic
        let color = '#94a3b8'; // default
        if (o.status === 'PENDING') color = '#f59e0b';
        if (o.status === 'PACKING') color = '#3b82f6';
        if (o.status === 'SHIPPING') color = '#8b5cf6';
        if (o.status === 'DELIVERED') color = '#10b981';
        if (o.status === 'CANCELLED') color = '#f43f5e';

        statusMap[statusLabel] = { count: 0, color };
      }
      statusMap[statusLabel].count++;
    });

    const typeData = [
      { name: 'Giao tận nơi', value: delivery, color: '#4f46e5' },
      { name: 'Nhận tại quầy', value: bopis, color: '#0d9488' }
    ].filter(d => d.value > 0);

    const statusData = Object.entries(statusMap)
      .map(([name, data]) => ({ name, value: data.count, fill: data.color }))
      .sort((a,b) => b.value - a.value);

    return { typeData, statusData };
  }, [displayList]);

  if (isLoading && !displayList.length) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Đơn hàng</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Theo dõi, xử lý và tạo mới các đơn hàng đa kênh.</p>
        </div>
        {(isAdmin() || isManager()) && (
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all"
          >
            <Plus className="w-5 h-5" /> Tạo đơn Telesale
          </button>
        )}
      </div>

      {/* ── MINI DASHBOARD (BỐ CỤC TỶ LỆ VÀNG) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1: Tổng số đơn */}
        <div className="lg:col-span-3 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm">
              <ShoppingBag className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng Đơn Hàng</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{pagedData?.totalElements || 0}</h3>
            </div>
          </div>
          <div className="relative z-10 flex gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md border border-emerald-100/60">Live Sync</span>
          </div>
        </div>

        {/* Card 2: Kênh giao hàng */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-6">
          <div className="w-1/2 h-[120px] relative">
            {dashboardStats.typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardStats.typeData} innerRadius={42} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {dashboardStats.typeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-400 bg-slate-50 rounded-full border border-slate-100 border-dashed">Trống</div>}
          </div>
          <div className="w-1/2 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu Kênh giao</p>
            <div className="space-y-2.5">
              {dashboardStats.typeData.map((type, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2 h-2 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: type.color }}/>
                    <span className="truncate">{type.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{type.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Phân bổ trạng thái */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Trạng thái xử lý (Trang này)</p>
          <div className="h-[90px] w-full">
            {dashboardStats.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardStats.statusData} layout="vertical" margin={{ top: 0, right: 30, left: -10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} width={90} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                    {dashboardStats.statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm font-medium text-slate-400 text-center h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">Chưa có dữ liệu</p>}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR & DATA TABLE ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm mã đơn, SĐT khách hàng..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={keyword}
                onChange={e => { setKeyword(e.target.value); setPage(0); }}
              />
            </div>
            
            <div className="relative w-full sm:w-48 shrink-0 group">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={status} 
                 onChange={(e) => { setStatus(e.target.value); setPage(0); }}
               >
                 {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-48 shrink-0 group">
               <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 w-4 h-4 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-indigo-50/50 border border-indigo-100 text-indigo-700 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={typeFilter} 
                 onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
               >
                 {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 w-4 h-4 pointer-events-none" />
            </div>

            {isAdmin() && (
              <div className="relative w-full sm:w-56 shrink-0 group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                <select
                  value={warehouseId}
                  onChange={(e) => { setWarehouseId(e.target.value); setPage(0); }}
                  className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">Toàn hệ thống (Mọi kho)</option>
                  {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              </div>
            )}

            <button 
              onClick={() => refetch()} 
              disabled={isRefetching} 
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-3 rounded-xl font-bold transition-all shadow-sm shrink-0 flex justify-center items-center"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>}
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Mã đơn & Kênh</th>
                <th className="px-6 py-5">Khách hàng</th>
                <th className="px-6 py-5">Kho xử lý</th>
                <th className="px-6 py-5 text-right">Tổng tiền</th>
                <th className="px-6 py-5 text-center">Thanh toán</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5">Ngày tạo</th>
                <th className="px-6 py-5 text-right w-40">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {displayList.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={8} className="py-24">
                    <EmptyState 
                      icon={ShoppingBag} 
                      title="Chưa có đơn hàng nào" 
                      description="Hãy điều chỉnh lại bộ lọc tìm kiếm của bạn." 
                    />
                  </td>
                </tr>
              ) : (
                displayList.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => document.getElementById(`link-${order.id}`)?.click()}>
                    <td className="px-6 py-4">
                      <Link id={`link-${order.id}`} to={`/orders/${order.id}`} className="font-mono text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors block mb-1">
                        {order.code}
                      </Link>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        order.type === 'BOPIS' 
                          ? 'bg-purple-50 text-purple-700 border-purple-100/60' 
                          : 'bg-blue-50 text-blue-700 border-blue-100/60'
                      }`}>
                        {order.type === 'BOPIS' ? <><Store className="w-3 h-3"/> Nhận tại quầy</> : <><Truck className="w-3 h-3"/> Giao tận nơi</>}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{order.customerName ?? 'Khách lẻ'}</div>
                      <div className="text-slate-500 font-mono text-[11px] font-semibold mt-0.5">{order.shippingPhone || order.customerPhone}</div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {order.assignedWarehouseName ? (
                        <span className="text-[13px] font-bold text-slate-700">{order.assignedWarehouseName}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100/60 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle className="w-3 h-3" /> Chờ gán kho
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-slate-900 text-base">
                        {formatCurrency(order.finalAmount)}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{order.paymentMethod}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          order.paymentStatus === 'PAID' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' 
                            : 'bg-amber-50 text-amber-700 border-amber-100/60'
                        }`}>
                          {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa TT'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-bold rounded-md border uppercase tracking-wider ${getOrderStatusColor(order.status).replace('text-', 'text-').replace('bg-', 'bg-').replace('border-', 'border-')}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                      {order.paymentMethod === 'COD' && order.codReconciled && (
                         <div className="mt-1.5">
                           <span className="inline-block text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-widest">
                             Đã đối soát
                           </span>
                         </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                      {formatDateTime(order.createdAt)}
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        
                        {nextStatus[order.status] && order.status !== 'WAITING_FOR_CONSOLIDATION' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleQuickUpdate(order); }} 
                            disabled={(updateMut.isPending && updateMut.variables?.id === order.id) || isRefetching}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center shadow-sm disabled:opacity-50
                              ${order.status === 'DELIVERED' 
                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/50' 
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100/50'
                              }`}
                            title="Xử lý bước tiếp theo"
                          >
                            {(updateMut.isPending && updateMut.variables?.id === order.id)
                              ? <Spinner size="sm" className={order.status === 'DELIVERED' ? "text-rose-600" : "text-indigo-600"} /> 
                              : nextStatus[order.status] === 'PACKING' ? 'Gói' : 
                                nextStatus[order.status] === 'SHIPPING' ? 'Giao' : 
                                nextStatus[order.status] === 'RETURNED' ? 'Hoàn trả' : 'Hoàn tất'
                            }
                            {!(updateMut.isPending && updateMut.variables?.id === order.id) && <ArrowRight className="w-3 h-3 ml-1" />}
                          </button>
                        )}

                        <button 
                          onClick={(e) => { e.stopPropagation(); document.getElementById(`link-${order.id}`)?.click(); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagedData && pagedData.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination page={page} totalPages={pagedData.totalPages} totalElements={pagedData.totalElements} size={20} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* ── MODAL ĐÁNH CHẶN NHẬP VẬN ĐƠN TRƯỚC KHI GIAO HÀNG ── */}
      {shippingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Thông tin Vận chuyển</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Đơn hàng: <span className="font-mono text-indigo-600 font-bold">{shippingOrder.code}</span></p>
                </div>
              </div>
              <button onClick={() => setShippingOrder(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 flex-1 bg-slate-50/30">
              <div className="bg-blue-50/50 text-blue-700 p-4 rounded-2xl text-sm font-medium border border-blue-100/50 leading-relaxed shadow-sm">
                Vui lòng nhập thông tin Đơn vị vận chuyển trước khi chuyển đơn sang trạng thái Đang giao.
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Đơn vị vận chuyển *</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                    placeholder="VD: GHTK, Viettel Post..." 
                    value={shippingProvider} 
                    onChange={e => setShippingProvider(e.target.value)} 
                    autoFocus 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mã vận đơn (Tracking Code)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                    placeholder="Nhập mã vận đơn..." 
                    value={trackingCode} 
                    onChange={e => setTrackingCode(e.target.value)} 
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white shrink-0">
              <button 
                onClick={() => setShippingOrder(null)} 
                className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmShippingModal} 
                disabled={updateMut.isPending || !shippingProvider} 
                className="flex items-center justify-center min-w-[160px] px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {updateMut.isPending ? <Spinner size="sm" className="text-white"/> : 'Xác nhận Giao hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ORDER MODAL ── */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['report-summary'] });
          }}
        />
      )}

      {/* CSS Animation Slide */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}