import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { transferService } from '@/services/transfer.service';
import { productService } from '@/services/product.service';
import { Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

interface Props {
  transferId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ReceiveTransferModal({ transferId, onClose, onSaved }: Props) {
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>({});

  const { data: transfer, isLoading } = useQuery({
    queryKey: ['transfer-detail-receive', transferId],
    queryFn: () => transferService.getById(transferId).then(r => r.data.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products-dict'],
    queryFn: () => productService.getProducts({ size: 1000 }).then(r => r.data.data.content),
  });

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    products?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [products]);

  useEffect(() => {
    if (transfer) {
      const initialRecord: Record<string, number> = {};
      transfer.items.forEach(item => {
        initialRecord[item.productId] = item.quantity;
      });
      setReceivedItems(initialRecord);
    }
  }, [transfer]);

  const receiveMut = useMutation({
    mutationFn: () => {
      // ĐÃ KIỂM TRA: Payload được map thành mảng Object chuẩn để gửi lên Backend
      const payload = Object.entries(receivedItems).map(([productId, receivedQty]) => ({
        productId,
        receivedQty
      }));
      return transferService.receive(transferId, payload); 
    },
    onSuccess: () => {
      toast.success('Đã xác nhận nhận hàng và cập nhật tồn kho đích!');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi khi nhận hàng'),
  });

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseInt(val);
    setReceivedItems(prev => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num
    }));
  };

  if (isLoading || !transfer) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><Spinner size="lg" className="text-white" /></div>;
  }

  const hasDiscrepancy = transfer.items.some(item => receivedItems[item.productId] !== item.quantity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800">Kiểm đếm nhận hàng: <span className="text-primary-600">{transfer.code}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 text-blue-800 text-sm">
            <Package className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Vui lòng kiểm đếm số lượng thực tế nhận được. Nếu có sai lệch (thất thoát, hư hỏng), hãy điều chỉnh số lượng ở cột <strong>"Thực nhận"</strong>.</p>
          </div>

          <div className="border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 border-b">
                <tr>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3 text-center">SL Gửi (Manifest)</th>
                  <th className="p-3 text-center w-32">Thực nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transfer.items.map((item) => {
                  const diff = (receivedItems[item.productId] || 0) - item.quantity;
                  return (
                    <tr key={item.id} className={diff !== 0 ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                      <td className="p-3">
                        <p className="font-medium text-gray-800">{productMap.get(item.productId) || 'Đang tải tên...'}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{item.productId.slice(0, 8)}...</p>
                      </td>
                      <td className="p-3 text-center font-semibold text-gray-600">
                        {item.quantity}
                      </td>
                      <td className="p-3">
                        <input 
                          type="number" min={0} max={item.quantity}
                          className={`input py-1.5 text-center font-bold ${diff !== 0 ? 'border-red-400 text-red-600' : 'text-green-600'}`}
                          value={receivedItems[item.productId] ?? ''}
                          onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                        />
                        {diff !== 0 && (
                          <p className="text-xs text-red-500 text-center mt-1 font-medium">Thiếu {Math.abs(diff)}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasDiscrepancy && (
            <div className="bg-amber-50 p-3 rounded-lg flex items-start gap-2 text-amber-800 text-sm border border-amber-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <p><strong>Cảnh báo:</strong> Có sự sai lệch giữa số lượng gửi và thực nhận. Kho đích sẽ chỉ được cộng số lượng thực nhận. Bạn có chắc chắn muốn xác nhận?</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button 
            onClick={() => receiveMut.mutate()} 
            disabled={receiveMut.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {receiveMut.isPending ? <Spinner size="sm" /> : <CheckCircle className="w-4 h-4" />} 
            Xác nhận nhận hàng
          </button>
        </div>
      </div>
    </div>
  );
}