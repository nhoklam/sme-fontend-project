
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, PackageOpen, AlertTriangle, Wallet, ChevronRight } from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { formatCurrency } from '@/lib/utils';
import { PageLoader } from '@/components/ui';

/**
 * View dành riêng cho Cashier - CHỈ hiển thị thông tin ca làm việc của chính
 * họ + việc cần làm hôm nay. Tuyệt đối không gọi bất kỳ API doanh thu chi
 * nhánh/toàn chuỗi nào - kể cả khi tò mò mở dev tools xem network tab, Cashier
 * cũng không thấy số liệu nào ngoài phạm vi của mình vì backend (DashboardService.
 * getCashierDashboard) chỉ tính trên đúng warehouseId + cashierId của họ.
 */
export default function CashierDashboardView() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-cashier'],
    queryFn: () => dashboardService.getCashierDashboard().then(r => r.data.data),
    refetchInterval: 30_000, // tự cập nhật mỗi 30s, không cần WebSocket riêng cho trang này
  });

  if (isLoading || !data) return <PageLoader />;

  const shiftOpen = data.shift.status === 'OPEN';

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1100px] mx-auto">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-xl font-bold text-slate-900">Ca làm việc của tôi</h1>
        <p className="text-sm text-slate-500 mt-1">Tổng quan công việc hôm nay tại chi nhánh của bạn.</p>
      </div>

      {/* WIDGET 1: TRẠNG THÁI CA */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-2.5 h-2.5 rounded-full ${shiftOpen ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          <span className="font-semibold text-slate-800">
            {shiftOpen ? 'Ca đang mở' : 'Chưa mở ca'}
          </span>
        </div>
        {shiftOpen ? (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-slate-400">Bắt đầu</p>
              <p className="text-sm font-medium text-slate-700">
                {data.shift.openedAt ? new Date(data.shift.openedAt).toLocaleTimeString('vi-VN') : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Tiền đầu ca</p>
              <p className="text-sm font-medium text-slate-700">{formatCurrency(data.shift.startingCash ?? 0)}</p>
            </div>
          </div>
        ) : (
          <Link to="/pos" className="inline-block mt-2 text-sm font-semibold text-indigo-600 hover:underline">
            Mở ca ngay →
          </Link>
        )}
      </div>

      {/* WIDGET 2: THỐNG KÊ CA HIỆN TẠI - chỉ số liệu CA CỦA MÌNH, không phải cả chi nhánh */}
      {shiftOpen && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-3 text-slate-500">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-semibold">Thống kê ca hiện tại</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400">Hóa đơn</p>
              <p className="text-2xl font-bold text-slate-900">{data.currentShiftStats.invoiceCount}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400">Tổng thu (trong ca)</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(data.currentShiftStats.totalRevenue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* WIDGET 3: ĐƠN CẦN ĐÓNG GÓI */}
      <Link
        to="/orders"
        className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <PackageOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{data.pendingPackCount} đơn cần bạn đóng gói</p>
            <p className="text-xs text-slate-400">Đơn đã được Quản lý xác nhận, sẵn sàng đóng gói</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
      </Link>

      {/* WIDGET 4: CẢNH BÁO TỒN KHO THẤP */}
      {data.lowStockCount > 0 && (
        <Link
          to="/inventory"
          className="flex items-center justify-between bg-amber-50 p-5 rounded-2xl border border-amber-100 hover:border-amber-300 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <p className="font-semibold text-amber-800">{data.lowStockCount} sản phẩm sắp hết hàng tại chi nhánh</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition-colors" />
        </Link>
      )}

      <button
        onClick={() => qc.invalidateQueries({ queryKey: ['dashboard-cashier'] })}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mx-auto"
      >
        <Clock className="w-3 h-3" /> Làm mới dữ liệu
      </button>
    </div>
  );
}
