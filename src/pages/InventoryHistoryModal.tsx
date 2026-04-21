import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, History, ArrowDownRight, ArrowUpRight, Undo2, AlertTriangle, SlidersHorizontal, Truck, PackageCheck, FileText, Package } from 'lucide-react';
import { inventoryService } from '../services/inventory.service';
import { formatDateTime } from '../lib/utils';
import { Pagination, Spinner, EmptyState } from '../components/ui';

interface InventoryHistoryModalProps {
  inventory: any;
  onClose: () => void;
}

export function InventoryHistoryModal({ inventory, onClose }: InventoryHistoryModalProps) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-history', inventory.id, page],
    queryFn: () => inventoryService.getTransactions(inventory.id, page, PAGE_SIZE).then((r: any) => r.data.data),
  });

  const transactions = data?.content || [];
  const totalPages = data?.totalPages || 0;
  const totalElements = data?.totalElements || 0;

  const getTransactionInfo = (type: string) => {
    const map: Record<string, any> = {
      'IMPORT': { label: 'Nhập hàng', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: ArrowDownRight },
      'EXPORT': { label: 'Xuất hàng', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: ArrowUpRight },
      'RETURN_TO_STOCK': { label: 'Khách trả hàng', color: 'text-green-700 bg-green-50 border-green-200', icon: Undo2 },
      'RETURN_TO_DEFECT': { label: 'Trả về kho lỗi', color: 'text-red-700 bg-red-50 border-red-200', icon: AlertTriangle },
      'ADJUSTMENT': { label: 'Kiểm kê', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: SlidersHorizontal },
      'TRANSFER_OUT': { label: 'Chuyển đi', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Truck },
      'TRANSFER_IN': { label: 'Chuyển đến', color: 'text-teal-700 bg-teal-50 border-teal-200', icon: PackageCheck },
      'SALE_POS': { label: 'Bán POS', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: ArrowUpRight },
      'SALE_ONLINE': { label: 'Bán Online', color: 'text-sky-700 bg-sky-50 border-sky-200', icon: ArrowUpRight },
    };
    return map[type] || { label: type, color: 'text-gray-700 bg-gray-50 border-gray-200', icon: FileText };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl shadow-sm border border-blue-200"><History className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Thẻ kho (Lịch sử giao dịch)</h2>
              <p className="text-sm text-gray-500 font-medium">
                {inventory.productName} <span className="text-gray-300 mx-1">|</span> SKU: {inventory.productSku || 'N/A'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-auto bg-white p-5">
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Spinner size="lg" /></div>
          ) : transactions.length === 0 ? (
            <div className="py-12"><EmptyState icon={Package} title="Chưa có giao dịch" description="Sản phẩm này chưa có biến động nào trong kho." /></div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3.5 px-4 text-center">Thời gian</th>
                    <th className="py-3.5 px-4">Loại giao dịch</th>
                    <th className="py-3.5 px-4 text-center">SL thay đổi</th>
                    <th className="py-3.5 px-4 text-center">Tồn cuối</th>
                    <th className="py-3.5 px-4 text-center">Tham chiếu</th>
                    <th className="py-3.5 px-4 w-full">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((txn: any) => {
                    const info = getTransactionInfo(txn.type);
                    const Icon = info.icon;
                    const isPositive = txn.quantityChange > 0;
                    const isNegative = txn.quantityChange < 0;

                    return (
                      <tr key={txn.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-gray-600 font-medium text-[13px]">{formatDateTime(txn.createdAt)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-semibold border ${info.color}`}>
                            <Icon className="w-3.5 h-3.5" /> {info.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
                            {isPositive ? '+' : ''}{txn.quantityChange}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-800">{txn.balance}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                            {txn.referenceCode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-[13px] max-w-xs truncate" title={txn.note || ''}>{txn.note || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex items-center justify-between rounded-b-2xl">
          <div className="text-sm text-gray-500 font-medium">Tổng cộng: <span className="font-bold text-gray-800">{totalElements}</span> giao dịch</div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} totalElements={totalElements} size={PAGE_SIZE} onPageChange={setPage} />}
        </div>
      </div>
    </div>
  );
}