import React from 'react';
import { formatDateTime } from '@/lib/utils';

interface TransferPrintTemplateProps {
  transfer: any;
  warehouses: any[];
  products: any[];
}

export const TransferPrintTemplate = React.forwardRef<HTMLDivElement, TransferPrintTemplateProps>(
  ({ transfer, warehouses, products }, ref) => {
    
    // Hàm lấy tên kho
    const getWarehouseName = (id: string) => {
      return warehouses?.find((w: any) => w.id === id)?.name || id;
    };

    // Hàm lấy tên sản phẩm
    const getProductName = (id: string) => {
      return products?.find((p: any) => p.id === id)?.name || `Mã SP: ${id.slice(0, 8)}`;
    };

    if (!transfer) return null;

    return (
      <div ref={ref} className="p-10 bg-white text-black min-h-screen font-sans">
        
        {/* HEADER PHIẾU IN */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-xl font-bold uppercase">SME ERP & POS</h2>
            <p className="text-sm">Hệ thống quản lý bán hàng</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold uppercase mb-1">Phiếu xuất kho kiêm VC nội bộ</h1>
            <p className="text-sm">Mã phiếu: <span className="font-bold">{transfer.code}</span></p>
            <p className="text-sm">Ngày tạo: {formatDateTime(transfer.createdAt)}</p>
            <p className="text-sm">Trạng thái: 
              <span className="font-semibold ml-1">
                {transfer.status === 'DRAFT' ? 'Nháp' : 
                 transfer.status === 'DISPATCHED' ? 'Đang vận chuyển' : 
                 transfer.status === 'RECEIVED' ? 'Đã nhận' : 'Đã hủy'}
              </span>
            </p>
          </div>
        </div>

        {/* THÔNG TIN KHO */}
        <div className="flex mb-8 border border-black">
          <div className="w-1/2 p-3 border-r border-black">
            <h3 className="text-sm font-semibold mb-1">Xuất tại kho (Bên giao):</h3>
            <p className="font-bold text-lg">{getWarehouseName(transfer.fromWarehouseId)}</p>
          </div>
          <div className="w-1/2 p-3">
            <h3 className="text-sm font-semibold mb-1">Nhập tại kho (Bên nhận):</h3>
            <p className="font-bold text-lg">{getWarehouseName(transfer.toWarehouseId)}</p>
          </div>
        </div>

        {/* BẢNG CHI TIẾT SẢN PHẨM */}
        <table className="w-full border-collapse border border-black mb-12 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 w-12 text-center">STT</th>
              <th className="border border-black p-2">Mã SP</th>
              <th className="border border-black p-2">Tên sản phẩm</th>
              <th className="border border-black p-2 text-center w-24">SL Gửi</th>
              <th className="border border-black p-2 text-center w-28">SL Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items?.map((item: any, index: number) => (
              <tr key={index}>
                <td className="border border-black p-2 text-center">{index + 1}</td>
                <td className="border border-black p-2 font-mono">{item.productId.slice(0, 8).toUpperCase()}</td>
                <td className="border border-black p-2 font-medium">{getProductName(item.productId)}</td>
                <td className="border border-black p-2 text-center font-bold">{item.quantity}</td>
                <td className="border border-black p-2 text-center">
                   {transfer.status === 'RECEIVED' ? item.receivedQty : ''}
                </td>
              </tr>
            ))}
            {/* Dòng tổng cộng */}
            <tr className="bg-gray-50 font-bold">
              <td colSpan={3} className="border border-black p-2 text-right">Tổng cộng:</td>
              <td className="border border-black p-2 text-center">
                {transfer.items?.reduce((sum: number, item: any) => sum + item.quantity, 0)}
              </td>
              <td className="border border-black p-2 text-center">
                {transfer.status === 'RECEIVED' 
                  ? transfer.items?.reduce((sum: number, item: any) => sum + (item.receivedQty || 0), 0)
                  : ''}
              </td>
            </tr>
          </tbody>
        </table>

        {/* CHỮ KÝ */}
        <div className="flex justify-between items-start mt-8 pt-4">
          <div className="text-center w-1/3">
            <p className="font-bold text-base mb-1">Thủ kho xuất</p>
            <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold text-base mb-1">Người vận chuyển</p>
            <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold text-base mb-1">Thủ kho nhập</p>
            <p className="text-xs italic">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>

      </div>
    );
  }
);