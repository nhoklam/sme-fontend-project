import React, { forwardRef } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface OrderPrintProps {
  order: any;
}

export const OrderPrintTemplate = forwardRef<HTMLDivElement, OrderPrintProps>(({ order }, ref) => {
  if (!order) return null;

  return (
    // Thiết lập khổ giấy A6 (10cm) phù hợp in bill nhiệt/mã vận đơn
    <div ref={ref} className="p-4 bg-white text-black text-sm w-[10cm] print:w-full print:p-0 font-sans">
      <div className="border-2 border-black p-3 rounded-lg">
        
        {/* Header - Mã vận đơn */}
        <div className="text-center border-b-2 border-black pb-3 mb-3">
          <h1 className="text-xl font-bold uppercase">{order.shippingProvider || 'SME GIAO HÀNG'}</h1>
          <p className="text-lg font-black mt-1">Mã VĐ: {order.trackingCode || 'CHƯA CÓ MÃ'}</p>
        </div>

        {/* Thông tin Khách hàng */}
        <div className="mb-3 space-y-1">
          <p><strong>Đến:</strong> {order.shippingName || order.customerName}</p>
          <p><strong>SĐT:</strong> {order.shippingPhone || order.customerPhone}</p>
          <p className="leading-tight"><strong>Đ/C:</strong> {order.shippingAddress}, {order.provinceCode}</p>
        </div>

        {/* Thông tin đơn hàng & thu hộ (COD) */}
        <div className="border-t-2 border-dashed border-gray-400 pt-3 mb-3 space-y-1">
          <p>Mã đơn nội bộ: <strong>{order.code}</strong></p>
          <p>Ngày đặt: {formatDateTime(order.createdAt)}</p>
          <p>Loại đơn: <strong>{order.type === 'BOPIS' ? 'Nhận tại quầy' : 'Giao hàng tận nơi'}</strong></p>
          
          <div className="mt-3 bg-gray-100 p-2 text-center border border-black rounded">
            <p className="text-sm font-bold uppercase">Tổng thu hộ (COD)</p>
            <p className="text-2xl font-black">
              {order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID' 
                ? formatCurrency(order.finalAmount) 
                : '0 đ (Đã thanh toán)'}
            </p>
          </div>
        </div>

        {/* Danh sách sản phẩm (rút gọn) */}
        <p className="font-bold mb-1">Nội dung hàng hóa:</p>
        <table className="w-full text-left text-xs border-collapse mb-3">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1">Sản phẩm</th>
              <th className="py-1 text-right w-10">SL</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-1.5 pr-2 font-medium">{item.productName}</td>
                <td className="py-1.5 text-right font-bold text-base">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Ghi chú */}
        {order.note && (
          <div className="mt-3 pt-2 border-t border-black text-xs italic">
            <strong>Ghi chú:</strong> {order.note}
          </div>
        )}
      </div>
    </div>
  );
});

OrderPrintTemplate.displayName = 'OrderPrintTemplate';