import React, { forwardRef } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/utils'; 

interface POSPrintTemplateProps {
  invoice: any; 
}

export const POSPrintTemplate = forwardRef<HTMLDivElement, POSPrintTemplateProps>(
  ({ invoice }, ref) => {
    if (!invoice) return null;

    return (
      <div 
        ref={ref} 
        // w-[80mm] là kích thước chuẩn của máy in nhiệt K80
        // Dùng font-mono để các ký tự đều nhau, giống bill siêu thị
        className="w-[80mm] p-4 text-black bg-white font-mono text-[12px] leading-tight print:block print:p-0"
      >
        {/* HEADER: Thông tin cửa hàng */}
        <div className="text-center mb-4">
          <h2 className="font-bold text-[16px] uppercase">SME ERP & POS</h2>
          <p>Hệ thống quản lý bán hàng đa kênh</p>
        </div>
        
        <h1 className="text-center font-bold text-[15px] mb-3 uppercase">Hóa đơn bán hàng</h1>
        
        {/* THÔNG TIN HÓA ĐƠN */}
        <div className="mb-2">
          <p>Mã HĐ: <span className="font-semibold">{invoice.code}</span></p>
          <p>Ngày: {formatDateTime(invoice.createdAt || new Date().toISOString())}</p>
          <p>Thu ngân: {invoice.cashierName || 'Admin'}</p>
          {invoice.customerName && <p>Khách hàng: {invoice.customerName}</p>}
        </div>
        
        <div className="border-t border-dashed border-black my-2"></div>
        
        {/* DANH SÁCH SẢN PHẨM */}
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-1 w-8">SL</th>
              <th className="py-1">Tên món</th>
              <th className="py-1 text-right">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any, index: number) => (
              <tr key={index}>
                <td className="py-1 align-top font-bold">{item.quantity}</td>
                <td className="py-1 pr-1">
                  {item.productName}
                  <br/> 
                  <span className="text-[10px] text-gray-700">
                    {formatCurrency(item.unitPrice)}
                  </span>
                </td>
                <td className="py-1 text-right align-top font-bold">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="border-t border-dashed border-black my-2"></div>
        
        {/* TỔNG KẾT THANH TOÁN */}
        <div className="flex justify-between font-bold text-[14px] mt-2">
          <span>TỔNG TIỀN HÀNG:</span>
          <span>{formatCurrency(invoice.totalAmount)}</span>
        </div>

        {invoice.discountAmount > 0 && (
          <div className="flex justify-between text-[12px] mt-1">
            <span>Giảm giá (Điểm):</span>
            <span>-{formatCurrency(invoice.discountAmount)}</span>
          </div>
        )}
        
        <div className="border-t border-dashed border-black my-2"></div>

        <div className="flex justify-between font-black text-[15px]">
          <span>KHÁCH PHẢI TRẢ:</span>
          <span>{formatCurrency(invoice.finalAmount)}</span>
        </div>

        {invoice.payments?.map((p: any, idx: number) => (
           <div key={idx} className="flex justify-between text-[12px] mt-1">
             <span>Khách đưa ({p.method}):</span>
             <span>{formatCurrency(p.amount)}</span>
           </div>
        ))}

        {/* ĐIỂM TÍCH LŨY */}
        {invoice.pointsEarned > 0 && (
          <div className="mt-4 pt-2 border-t border-dashed border-gray-400 text-center">
            <p>Điểm tích lũy hóa đơn này: <strong className="text-[14px]">+{invoice.pointsEarned}</strong></p>
            {invoice.customerName && <p className="text-[10px] mt-0.5">Áp dụng cho số ĐT: {invoice.customerPhone}</p>}
          </div>
        )}
        
        {/* FOOTER */}
        <div className="text-center mt-6">
          <p className="font-bold">Cảm ơn quý khách & Hẹn gặp lại!</p>
          <p className="text-[10px] mt-1">Powered by SME ERP</p>
        </div>
      </div>
    );
  }
);

POSPrintTemplate.displayName = 'POSPrintTemplate';