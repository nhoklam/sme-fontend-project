import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Receipt, Search, CheckCircle2, AlertCircle, Upload,
  Truck, DollarSign, X, ChevronRight, FileText, Check,
  Building2, Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { financeService } from '@/services/finance.service';
import { orderService } from '@/services/order.service';
import { warehouseService } from '@/services/warehouse.service';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { PageLoader, EmptyState, Spinner } from '@/components/ui';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface CodOrder {
  id: string;
  code: string;
  customerName?: string;
  finalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  codReconciled: boolean;
  assignedWarehouseId: string;
  assignedWarehouseName?: string;
  shippingProvider?: string;
  trackingCode?: string;
  createdAt: string;
}

interface ReconcileRow {
  orderCode: string;
  amountReceived: number;
  shippingFee: number;
  shippingProvider: string;
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function CodReconciliationPage() {
  const { user } = useAuthStore();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [searchKw, setSearchKw] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [feeMap, setFeeMap] = useState<Record<string, number>>({});          // orderCode → shippingFee
  const [providerMap, setProviderMap] = useState<Record<string, string>>({}); // orderCode → provider
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Danh sách kho
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-cod'],
    queryFn: () => warehouseService.getAll().then(r => r.data.data),
  });

  // Danh sách đơn COD chưa đối soát
  const { data: ordersPage, isLoading } = useQuery({
    queryKey: ['cod-unreconciled', selectedWarehouseId],
    queryFn: () => orderService.getOrders({
      status: 'DELIVERED',
      warehouseId: selectedWarehouseId || undefined,
      size: 100,
      page: 0,
    }).then(r => r.data.data),
    enabled: true,
  });

  const codOrders = useMemo<CodOrder[]>(() => {
    const all = ordersPage?.content ?? [];
    return all.filter((o: any) =>
      o.paymentMethod === 'COD' && !o.codReconciled
    ) as CodOrder[];
  }, [ordersPage]);

  const filtered = useMemo(() => {
    if (!searchKw) return codOrders;
    const kw = searchKw.toLowerCase();
    return codOrders.filter(o =>
      o.code?.toLowerCase().includes(kw) ||
      o.customerName?.toLowerCase().includes(kw) ||
      o.trackingCode?.toLowerCase().includes(kw)
    );
  }, [codOrders, searchKw]);

  const toggleAll = () => {
    if (selectedOrders.size === filtered.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filtered.map(o => o.code)));
    }
  };

  const totalSelected = [...selectedOrders].reduce((sum, code) => {
    const order = codOrders.find(o => o.code === code);
    return sum + (order?.finalAmount ?? 0);
  }, 0);

  const totalFee = [...selectedOrders].reduce((sum, code) => {
    return sum + (feeMap[code] ?? 0);
  }, 0);

  const reconMut = useMutation({
    mutationFn: () => {
      if (!selectedWarehouseId) throw new Error('Chọn chi nhánh trước');
      const rows: ReconcileRow[] = [...selectedOrders].map(code => {
        const order = codOrders.find(o => o.code === code);
        return {
          orderCode:     code,
          amountReceived: order?.finalAmount ?? 0,
          shippingFee:   feeMap[code] ?? 0,
          shippingProvider: providerMap[code] ?? (order?.shippingProvider ?? 'Unknown'),
        };
      });
      return financeService.reconcileCOD(rows, selectedWarehouseId).then(r => r.data.data);
    },
    onSuccess: (result) => {
      setLastResult(result);
      setShowResult(true);
      setSelectedOrders(new Set());
      toast.success(`Đối soát thành công ${result.matched} đơn!`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi đối soát'),
  });

  const allChecked = filtered.length > 0 && selectedOrders.size === filtered.length;
  const someChecked = selectedOrders.size > 0 && selectedOrders.size < filtered.length;

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-indigo-600" />
            Đối soát COD
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Xác nhận thanh toán từ đối tác vận chuyển cho các đơn COD đã giao
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chi nhánh</label>
          <select
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
            value={selectedWarehouseId}
            onChange={e => { setSelectedWarehouseId(e.target.value); setSelectedOrders(new Set()); }}
          >
            <option value="">-- Chọn chi nhánh để đối soát --</option>
            {(warehouses ?? []).map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tìm kiếm</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="Mã đơn, khách, mã vận đơn..."
              value={searchKw}
              onChange={e => setSearchKw(e.target.value)}
            />
          </div>
        </div>
        {!selectedWarehouseId && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mt-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Chọn chi nhánh để bắt đầu đối soát
          </div>
        )}
      </div>

      {/* Stats row */}
      {selectedWarehouseId && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Đơn chờ đối soát', value: codOrders.length, color: 'text-slate-700' },
            { label: 'Đơn đã chọn',       value: selectedOrders.size, color: 'text-indigo-700' },
            { label: 'Tổng tiền (đã chọn)', value: formatCurrency(totalSelected), color: 'text-emerald-700', isText: true },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className={cn('font-black mt-1', s.isText ? 'text-xl' : 'text-3xl', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      {selectedOrders.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-indigo-800">
              {selectedOrders.size} đơn được chọn — Tổng thu: {formatCurrency(totalSelected)}
            </p>
            {totalFee > 0 && (
              <p className="text-xs text-indigo-600 mt-0.5">
                Phí vận chuyển: {formatCurrency(totalFee)} — Thực nhận: {formatCurrency(totalSelected - totalFee)}
              </p>
            )}
          </div>
          <button
            onClick={() => reconMut.mutate()}
            disabled={reconMut.isPending || !selectedWarehouseId}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {reconMut.isPending ? <Spinner size="sm" className="text-white" /> : <CheckCircle2 className="w-4 h-4" />}
            Xác nhận đối soát {selectedOrders.size} đơn
          </button>
        </div>
      )}

      {/* Table */}
      {!selectedWarehouseId ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
          <Building2 className="w-12 h-12 text-slate-200 mb-3" />
          <p className="text-slate-400 font-semibold">Chọn chi nhánh để xem đơn chờ đối soát</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><PageLoader /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Không có đơn COD chờ đối soát"
          description={searchKw ? 'Không tìm thấy đơn phù hợp' : 'Tất cả đơn COD đã được đối soát'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    className="accent-indigo-600 w-4 h-4 rounded cursor-pointer"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã đơn / Khách</th>
                <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Tiền COD</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-[200px]">Đơn vị vận chuyển</th>
                <th className="text-right px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-[130px]">Phí ship</th>
                <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày giao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(order => {
                const isSelected = selectedOrders.has(order.code);
                return (
                  <tr
                    key={order.id}
                    className={cn('transition-colors cursor-pointer',
                      isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50')}
                    onClick={() => {
                      const next = new Set(selectedOrders);
                      if (next.has(order.code)) next.delete(order.code);
                      else next.add(order.code);
                      setSelectedOrders(next);
                    }}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-indigo-600 w-4 h-4 rounded cursor-pointer"
                        checked={isSelected}
                        onChange={() => {
                          const next = new Set(selectedOrders);
                          if (next.has(order.code)) next.delete(order.code);
                          else next.add(order.code);
                          setSelectedOrders(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 font-mono text-sm">{order.code}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{order.customerName ?? 'Khách lẻ'}</p>
                      {order.trackingCode && (
                        <p className="text-[11px] text-indigo-500 font-mono mt-0.5 flex items-center gap-1">
                          <Truck className="w-3 h-3" />{order.trackingCode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-emerald-700 text-base">{formatCurrency(order.finalAmount)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                        placeholder="GHTK, Viettel Post..."
                        value={providerMap[order.code] ?? (order.shippingProvider ?? '')}
                        onChange={e => setProviderMap(prev => ({ ...prev, [order.code]: e.target.value }))}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="relative">
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-right pr-7 focus:ring-1 focus:ring-indigo-400 outline-none"
                          placeholder="0"
                          value={feeMap[order.code] ?? ''}
                          onChange={e => setFeeMap(prev => ({ ...prev, [order.code]: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Result Modal */}
      {showResult && lastResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-slate-100">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Đối soát hoàn tất!</h2>
            </div>
            <div className="space-y-3 mb-6">
              {[
                { label: 'Đơn đã đối soát', value: lastResult.matched, color: 'text-emerald-700' },
                { label: 'Không tìm thấy', value: lastResult.notFound, color: 'text-red-500' },
                { label: 'Tổng tiền nhận', value: formatCurrency(lastResult.totalReceived), color: 'text-indigo-700' },
                { label: 'Phí vận chuyển', value: formatCurrency(lastResult.totalShippingFee), color: 'text-amber-700' },
                { label: 'Thực nhận (vào TK 112)', value: formatCurrency(lastResult.netAmount), color: 'text-emerald-800' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">{s.label}</span>
                  <span className={cn('font-black text-sm', s.color)}>{s.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowResult(false)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}