import React, { forwardRef } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { CodReconciliationResult } from '@/types';

interface Props {
  result: CodReconciliationResult;
  warehouseName: string;
  reconciledByName: string;
}

export const CodReconciliationPrintTemplate = forwardRef<HTMLDivElement, Props>(
  ({ result, warehouseName, reconciledByName }, ref) => {
    if (!result) return null;
    const now = new Date().toISOString();

    return (
      <div ref={ref} className="p-10 bg-white text-black font-sans" style={{ width: '210mm', minHeight: '297mm' }}>
        <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold uppercase">Công ty TNHH SME ERP</h1>
            <p className="text-sm mt-1">Hệ thống quản lý bán hàng đa kênh</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase mb-1">Biên Bản Đối Soát COD</h2>
            <p className="text-sm italic">Ngày lập: {formatDateTime(now)}</p>
          </div>
        </div>

        <div className="mb-6 space-y-1 text-sm border border-black p-4 rounded">
          <p><strong>Chi nhánh đối soát:</strong> {warehouseName}</p>
          <p><strong>Người thực hiện:</strong> {reconciledByName}</p>
          <p><strong>Số đơn đối soát thành công:</strong> {result.matched} &nbsp;|&nbsp; <strong>Không khớp:</strong> {result.notFound}</p>
        </div>

        <table className="w-full text-sm border-collapse border border-gray-800 mb-6">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-800 p-2 text-center w-10">STT</th>
              <th className="border border-gray-800 p-2 text-left">Mã đơn</th>
              <th className="border border-gray-800 p-2 text-left">Khách hàng</th>
              <th className="border border-gray-800 p-2 text-left">ĐVVC</th>
              <th className="border border-gray-800 p-2 text-right">Tiền COD</th>
              <th className="border border-gray-800 p-2 text-right">Phí ship</th>
              <th className="border border-gray-800 p-2 text-right">Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((it, i) => (
              <tr key={it.orderCode}>
                <td className="border border-gray-800 p-2 text-center">{i + 1}</td>
                <td className="border border-gray-800 p-2 font-mono">{it.orderCode}</td>
                <td className="border border-gray-800 p-2">{it.customerName}</td>
                <td className="border border-gray-800 p-2">{it.shippingProvider}</td>
                <td className="border border-gray-800 p-2 text-right">{formatCurrency(it.amountReceived)}</td>
                <td className="border border-gray-800 p-2 text-right">{formatCurrency(it.shippingFee)}</td>
                <td className="border border-gray-800 p-2 text-right font-bold">{formatCurrency(it.netAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-bold">
              <td colSpan={4} className="border border-gray-800 p-3 text-right">Tổng cộng:</td>
              <td className="border border-gray-800 p-3 text-right">{formatCurrency(result.totalReceived)}</td>
              <td className="border border-gray-800 p-3 text-right">{formatCurrency(result.totalShippingFee)}</td>
              <td className="border border-gray-800 p-3 text-right">{formatCurrency(result.netAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-between mt-16 px-8">
          <div className="text-center w-1/3">
            <p className="font-bold mb-20 text-base">Người lập biên bản</p>
            <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold mb-20 text-base">Kế toán</p>
            <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          </div>
          <div className="text-center w-1/3">
            <p className="font-bold mb-20 text-base">Giám đốc</p>
            <p className="italic text-xs">(Ký, ghi rõ họ tên)</p>
          </div>
        </div>
      </div>
    );
  }
);
CodReconciliationPrintTemplate.displayName = 'CodReconciliationPrintTemplate';