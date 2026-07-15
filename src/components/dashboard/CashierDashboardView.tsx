import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Briefcase, AlertTriangle, ChevronRight, CheckCircle2, Package, Wallet } from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { formatCurrency } from '@/lib/utils';
import { PageLoader } from '@/components/ui';

export default function CashierDashboardView() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-cashier'],
    queryFn: () => dashboardService.getCashierDashboard().then(r => r.data.data),
    refetchInterval: 30_000, 
  });

  if (isLoading || !data) return <PageLoader />;

  const shiftOpen = data.shift.status === 'OPEN';

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1100px] mx-auto">
      
      <div className="bg-white p-5 md:p-6 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Ca làm việc của tôi</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Tổng quan tiến độ công việc hôm nay tại chi nhánh của bạn.</p>
      </div>

      {/* WIDGET 1: TRẠNG THÁI CA */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100">
        <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-4">
          <div className={`w-3 h-3 rounded-full ${shiftOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="font-bold text-slate-800 text-lg tracking-tight">
            {shiftOpen ? 'Ca đang mở' : 'Két tiền đang khóa'}
          </span>
        </div>
        {shiftOpen ? (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Giờ bắt đầu</p>
              <p className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400"/>
                {data.shift.openedAt ? new Date(data.shift.openedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tiền mặt đầu ca</p>
              <p className="text-lg font-black text-slate-700">{formatCurrency(data.shift.startingCash ?? 0)}</p>
            </div>
          </div>
        ) : (
          <Link to="/pos" className="inline-flex items-center justify-center bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 transition-colors">
            Mở ca bán hàng ngay →
          </Link>
        )}
      </div>

      {/* WIDGET 2: THỐNG KÊ CÔNG VIỆC TRONG CA (THAY THẾ CHO DOANH THU CŨ) */}
      {shiftOpen && (
        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100">
          <div className="flex items-center gap-2.5 mb-5 text-slate-800 border-b border-slate-50 pb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Briefcase className="w-4 h-4" /></div>
            <span className="text-lg font-bold tracking-tight">Tiến độ công việc</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Link to="/pos" className="bg-indigo-50/50 hover:bg-indigo-50 transition-colors rounded-2xl p-5 border border-indigo-100/50 group flex justify-between items-center">
              <div>
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5"/> Hóa đơn tại quầy (POS)
                </p>
                <p className="text-4xl font-black text-indigo-700 tracking-tight">
                  {data.currentShiftStats.invoiceCount} <span className="text-sm font-semibold text-indigo-500/70 lowercase">hóa đơn</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <ChevronRight className="w-5 h-5 text-indigo-500" />
              </div>
            </Link>
            
            <Link to="/orders" className="bg-amber-50/50 hover:bg-amber-50 transition-colors rounded-2xl p-5 border border-amber-100/50 group flex justify-between items-center">
              <div>
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5"/> Đơn Online chờ đóng gói
                </p>
                <p className="text-4xl font-black text-amber-700 tracking-tight">
                  {data.pendingPackCount} <span className="text-sm font-semibold text-amber-600/70 lowercase">đơn hàng</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <ChevronRight className="w-5 h-5 text-amber-500" />
              </div>
            </Link>
          </div>
        </div>
      )}

      <div className="flex justify-center mt-8">
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-cashier'] })}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl shadow-sm transition-colors"
        >
          <Clock className="w-3.5 h-3.5" /> Làm mới dữ liệu thủ công
        </button>
      </div>
    </div>
  );
}