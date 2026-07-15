import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Trash2, Package, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx'; // Import thư viện xử lý Excel
import { supplierService } from '../services/supplier.service';
import { warehouseService } from '../services/warehouse.service';
import { productService } from '../services/product.service';
import { purchaseService } from '../services/purchase.service';
import { useAuthStore } from '../stores/auth.store';
import { Spinner } from '../components/ui';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreatePurchaseOrderModal({ onClose, onSaved }: Props) {
  const { user, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    supplierId: '',
    warehouseId: !isAdmin() ? (user?.warehouseId || '') : '',
    note: '',
  });

  const [items, setItems] = useState<Array<{ productId: string; quantity: number; importPrice: number | string }>>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-po'],
    queryFn: () => supplierService.getAll({ size: 1000 }).then((r: any) => r.data.data.content),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-po'],
    queryFn: () => warehouseService.getAll().then((r: any) => r.data.data),
    enabled: isAdmin(), 
  });

  // CHỈ FETCH KHI CHỌN NCC
  const { data: filteredProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-po', form.supplierId],
    queryFn: () => productService.getProducts({ supplierId: form.supplierId, size: 1000 }).then((r: any) => r.data.data.content),
    enabled: !!form.supplierId, 
  });

  useEffect(() => {
    setItems([]);
  }, [form.supplierId]);

  const createMut = useMutation({
    mutationFn: () => purchaseService.create({
      supplierId: form.supplierId,
      warehouseId: form.warehouseId,
      note: form.note,
      items: items.map(i => ({ ...i, importPrice: Number(i.importPrice) })) 
    }),
    onSuccess: () => {
      toast.success('Tạo phiếu nhập kho thành công! Phiếu đang chờ duyệt.');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Lỗi khi tạo phiếu nhập kho'),
  });

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1, importPrice: '' }]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    
    if (field === 'productId') {
      const isExist = newItems.some((item, i) => i !== index && item.productId === value);
      if (isExist && value !== '') {
        toast.error("Sản phẩm này đã có trong danh sách nhập!");
        return;
      }

      let autoImportPrice: number | string = '';

      if (value !== '') {
        const selectedProduct = filteredProducts?.find((p: any) => p.id === value);
        if (selectedProduct) {
          const basePrice = selectedProduct.wholesalePrice || selectedProduct.retailPrice || 0;
          if (basePrice > 0) {
            const calculatedPrice = basePrice * 0.9;
            autoImportPrice = Math.round(calculatedPrice / 1000) * 1000;
          }
        }
      }

      newItems[index] = { 
        ...newItems[index], 
        productId: value,
        importPrice: autoImportPrice 
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  // ============================================================================
  // TÍNH NĂNG IMPORT EXCEL
  // ============================================================================
  const handleDownloadTemplate = () => {
    const template = [
      { 'Mã SP (Barcode/SKU)': '8935235228115', 'Số lượng': 20, 'Giá nhập (Bỏ trống để tự tính)': 68000 },
      { 'Mã SP (Barcode/SKU)': '8936066684781', 'Số lượng': 15, 'Giá nhập (Bỏ trống để tự tính)': '' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_NhapKho');
    XLSX.writeFile(wb, 'File_Mau_Nhap_Kho.xlsx');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

        const newItems = [...items];
        let successCount = 0;
        let errorCount = 0;

        data.forEach((row: any) => {
          // Đọc các cột có thể có trong file Excel
          const code = String(row['Mã SP (Barcode/SKU)'] || row['Mã SP'] || row['Barcode'] || row['SKU'] || '').trim();
          const qty = Number(row['Số lượng'] || row['SL'] || 0);
          const price = Number(row['Giá nhập (Bỏ trống để tự tính)'] || row['Giá nhập'] || 0);

          if (!code || qty <= 0) { errorCount++; return; }

          // Tìm sản phẩm trong danh sách của Nhà cung cấp hiện tại
          const product = filteredProducts?.find((p: any) => p.isbnBarcode === code || p.sku === code);
          if (!product) { errorCount++; return; }

          // Kiểm tra xem đã có trong giỏ chưa
          if (newItems.some(i => i.productId === product.id)) {
            errorCount++; return;
          }

          // Tính giá nhập nếu trong Excel để trống
          let finalPrice = price;
          if (finalPrice <= 0) {
            const basePrice = product.wholesalePrice || product.retailPrice || 0;
            finalPrice = Math.round((basePrice * 0.9) / 1000) * 1000;
          }

          newItems.push({
            productId: product.id,
            quantity: qty,
            importPrice: finalPrice
          });
          successCount++;
        });

        setItems(newItems);
        if (successCount > 0) toast.success(`Đã thêm thành công ${successCount} sản phẩm từ file Excel.`);
        if (errorCount > 0) toast.error(`Bỏ qua ${errorCount} dòng không hợp lệ hoặc bị trùng lặp.`);

      } catch (err) {
        toast.error('Lỗi đọc file Excel! Vui lòng dùng file mẫu.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };
  // ============================================================================

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * (Number(item.importPrice) || 0)), 0);

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 sản phẩm");
      return;
    }
    const hasZeroPrice = items.some(item => Number(item.importPrice) <= 0);
    if (hasZeroPrice) {
      toast.error("Sản phẩm chưa có giá nhập hợp lệ (Lớn hơn 0)!");
      return;
    }
    createMut.mutate();
  };

  const isValid = form.supplierId && form.warehouseId && items.length > 0 && items.every(i => i.productId && i.quantity > 0 && Number(i.importPrice) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b shrink-0 bg-blue-600 text-white rounded-t-2xl">
          <h2 className="text-xl font-bold">Tạo Phiếu Nhập Kho Mới</h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-gray-50">
          
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nhà cung cấp <span className="text-red-500">*</span></label>
                <select 
                  className="input" 
                  value={form.supplierId} 
                  onChange={e => setForm({ ...form, supplierId: e.target.value })}
                >
                  <option value="">-- Chọn Nhà cung cấp --</option>
                  {suppliers?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} {s.taxCode ? `(MST: ${s.taxCode})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Nhập tại Chi nhánh <span className="text-red-500">*</span></label>
                {isAdmin() ? (
                  <select 
                    className="input" 
                    value={form.warehouseId} 
                    onChange={e => setForm({ ...form, warehouseId: e.target.value })}
                  >
                    <option value="">-- Chọn Chi nhánh --</option>
                    {warehouses?.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                ) : (
                  <select className="input bg-gray-100 cursor-not-allowed" disabled value={form.warehouseId}>
                    <option value={form.warehouseId}>{user?.warehouseName}</option>
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="label">Ghi chú phiếu nhập</label>
              <textarea 
                className="input resize-none" rows={2} 
                placeholder="Ví dụ: Nhập hàng đợt 1 tháng 10..."
                value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" /> Danh sách hàng nhập
              </h3>
              
              {/* CỤM NÚT IMPORT EXCEL VÀ THÊM TAY */}
              {form.supplierId && (filteredProducts || []).length > 0 && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleDownloadTemplate} className="btn-secondary btn-sm text-gray-600">
                    <Download className="w-4 h-4 mr-1" /> Tải file mẫu
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isImporting}
                    className="btn-secondary btn-sm text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  >
                    {isImporting ? <Spinner size="sm" /> : <Upload className="w-4 h-4 mr-1" />} Import Excel
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />

                  <button type="button" onClick={handleAddItem} className="btn-secondary btn-sm">
                    <Plus className="w-4 h-4 mr-1" /> Thêm tay
                  </button>
                </div>
              )}
            </div>

            {!form.supplierId ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Vui lòng chọn Nhà cung cấp ở trên để xem danh sách sản phẩm.
              </div>
            ) : loadingProducts ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (filteredProducts || []).length === 0 ? (
              <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg border border-dashed border-amber-200 flex flex-col items-center gap-3">
                <Package className="w-10 h-10 opacity-50" />
                <div>
                  <p className="font-bold text-lg">Chưa có sản phẩm nào!</p>
                  <p className="text-sm opacity-80 mt-1 max-w-md">
                    Hệ thống không tìm thấy sản phẩm nào thuộc Nhà cung cấp này. Bạn cần khai báo sản phẩm trước khi nhập hàng.
                  </p>
                </div>
                <button 
                  onClick={() => { onClose(); navigate('/products'); }}
                  className="btn-primary mt-2 shadow-md shadow-amber-200/50"
                >
                  <Plus className="w-4 h-4 mr-1" /> Đi tới Quản lý Sản phẩm
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="mb-2">Chưa có sản phẩm nào trong phiếu.</p>
                <p>Bạn có thể <strong className="text-indigo-600">Import từ Excel</strong> để nhập hàng loạt hoặc <strong className="text-gray-700">Thêm tay</strong> từng món.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-[200px]">
                      <label className="label text-xs">Sản phẩm</label>
                      <select 
                        className="input py-1.5 text-sm border-gray-300"
                        value={item.productId}
                        onChange={e => handleUpdateItem(index, 'productId', e.target.value)}
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {filteredProducts?.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="label text-xs">Số lượng</label>
                      <input 
                        type="number" min={1}
                        className="input py-1.5 text-sm font-semibold text-center border-gray-300"
                        value={item.quantity || ''}
                        onChange={e => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-40">
                      <label className="label text-xs">Giá nhập (VNĐ)</label>
                      <input 
                        type="number" min={1}
                        className={`input py-1.5 text-sm font-semibold text-right ${!item.importPrice || Number(item.importPrice) <= 0 ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        value={item.importPrice}
                        placeholder="Nhập giá..."
                        onChange={e => handleUpdateItem(index, 'importPrice', e.target.value)}
                      />
                    </div>
                    <div className="w-32 hidden md:block">
                      <label className="label text-xs">Thành tiền</label>
                      <div className="py-1.5 text-sm font-bold text-primary-600 text-right">
                        {formatCurrency(item.quantity * (Number(item.importPrice) || 0))}
                      </div>
                    </div>
                    <div className="pb-1">
                      <button 
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="flex justify-end pt-4 border-t mt-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Tổng tiền dự kiến</p>
                  <p className="text-3xl font-black text-primary-600">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary px-6">Hủy bỏ</button>
          <button 
            onClick={handleSubmit} 
            disabled={!isValid || createMut.isPending}
            className="btn-primary px-8 text-base"
          >
            {createMut.isPending ? <Spinner size="sm" /> : 'Xác nhận tạo phiếu'}
          </button>
        </div>

      </div>
    </div>
  );
}