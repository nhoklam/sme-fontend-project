import React, { forwardRef } from 'react';
import { formatDateTime, formatCurrency } from '@/lib/utils';

interface PrintTemplateProps {
  orderData: any;
  suppliers: any[];
  warehouses: any[];
  products: any[];
}

export const PurchaseOrderPrintTemplate = forwardRef<HTMLDivElement, PrintTemplateProps>(
  ({ orderData, suppliers, warehouses, products }, ref) => {
    if (!orderData) return null;

    const getSupplierName = (id: string) => suppliers?.find(s => s.id === id)?.name || id;
    const getWarehouseName = (id: string) => warehouses?.find(w => w.id === id)?.name || id;
    const getProductName = (id: string) => products?.find(p => p.id === id)?.name || id;

    return (
      <div ref={ref} className="p-10 bg-white text-black font-sans" style={{ width: '210mm', minHeight: '297mm' }}>
        
        {/* Header: Thông tin công ty & Tiêu đề */}
        <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold uppercase">Công ty TNHH SME ERP</h1>
            <p className="text-sm mt-1">Hệ thống quản lý bán hàng đa kênh</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase mb-1">Phiếu Nhập Kho</h2>
            <p className="text-sm italic">Mã phiếu: <strong>{orderData.code}</strong></p>
            <p className="text-sm italic">Ngày lập: {formatDateTime(orderData.createdAt)}</p>
          </div>
        </div>

        {/* Thông tin phiếu nhập */}
        <div className="mb-8 space-y-2 text-sm border border-black p-4 rounded">
          <p><strong>Nhà cung cấp:</strong> {getSupplierName(orderData.supplierId)}</p>
          <p><strong>Nhập tại kho:</strong> {getWarehouseName(orderData.warehouseId)}</p>
          <p><strong>Trạng thái:</strong> {orderData.status === 'COMPLETED' ? 'Đã nhập kho' : orderData.status === 'CANCELLED' ? 'Đã Hủy' : 'Chờ duyệt'}</p>
          <p><strong>Ghi chú:</strong> {orderData.note || 'Không có'}</p>
        </div>

        {/* Bảng chi tiết mặt hàng */}
        <table className="w-full text-sm border-collapse border border-gray-800 mb-6">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-800 p-2 text-center w-12">STT</th>
              <th className="border border-gray-800 p-2 text-left">Tên sản phẩm</th>
              <th className="border border-gray-800 p-2 text-center w-24">Số lượng</th>
              <th className="border border-gray-800 p-2 text-right w-32">Đơn giá</th>
              <th className="border border-gray-800 p-2 text-right w-32">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {orderData.items?.map((item: any, index: number) => (
              <tr key={index}>
                <td className="border border-gray-800 p-2 text-center">{index + 1}</td>
                <td className="border border-gray-800 p-2 font-medium">{getProductName(item.productId)}</td>
                <td className="border border-gray-800 p-2 text-center font-bold">{item.quantity}</td>
                <td className="border border-gray-800 p-2 text-right">{formatCurrency(item.importPrice)}</td>
                <td className="border border-gray-800 p-2 text-right font-bold">
                  {formatCurrency(item.quantity * item.importPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={4} className="border border-gray-800 p-3 text-right font-bold text-base">Tổng cộng:</td>
              <td className="border border-gray-800 p-3 text-right font-bold text-base">
                {formatCurrency(orderData.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Khu vực chữ ký */}
        <div className="flex justify-between mt-16 px-8">
          <div className="text-center w-1/3">
            <p className="font-bold mb-20 text-base">Người lập phiếu</p>
            <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold mb-20 text-base">Người giao hàng</p>
            <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold mb-20 text-base">Thủ kho</p>
            <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>
      </div>
    );
  }
);
PurchaseOrderPrintTemplate.displayName = 'PurchaseOrderPrintTemplate';