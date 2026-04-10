import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Handshake, Search, Plus, X, Edit, Eye, EyeOff, Info, CreditCard, Download, Upload, Package, Clock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { supplierService } from '@/services/supplier.service';
import { financeService } from '@/services/finance.service';
import { purchaseService } from '@/services/purchase.service'; // ĐÃ BỔ SUNG
import { PageLoader, EmptyState, Spinner, Pagination } from '@/components/ui'; // ĐÃ BỔ SUNG Pagination
import { formatCurrency, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Supplier } from '@/types';

// ─────────────────────────────────────────────────────────────────
// SCHEMA VALIDATION VỚI ZOD
// ─────────────────────────────────────────────────────────────────
const supplierSchema = z.object({
  name: z.string().min(1, 'Tên nhà cung cấp không được để trống'),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional().refine(val => !val || /^[0-9]{10,11}$/.test(val), {
    message: 'Số điện thoại phải từ 10-11 số hợp lệ',
  }),
  email: z.string().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Định dạng email không hợp lệ',
  }),
  address: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  paymentTerms: z.coerce.number().min(0, 'Số ngày nợ phải lớn hơn hoặc bằng 0').default(30),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ─────────────────────────────────────────────────────────────────
// COMPONENT 1: MODAL CHI TIẾT & LỊCH SỬ NHẬP KHO
// ─────────────────────────────────────────────────────────────────
function SupplierDetailsModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'INFO' | 'HISTORY'>('INFO');
  const [poPage, setPoPage] = useState(0);

  // Lấy Dư nợ Tổng cực nhanh từ Backend
  const { data: totalUnpaid = 0, isLoading: loadingTotal } = useQuery({
    queryKey: ['supplier-total-debt', supplier.id],
    queryFn: () => financeService.getTotalOutstandingBySupplier(supplier.id).then(r => r.data.data),
  });

  // Lấy Lịch sử nhập kho (Phân trang)
  const { data: poData, isLoading: loadingPo } = useQuery({
    queryKey: ['supplier-po-history', supplier.id, poPage],
    queryFn: () => purchaseService.getBySupplier(supplier.id, { page: poPage, size: 5 }).then(r => r.data.data),
    enabled: activeTab === 'HISTORY',
  });

  // (Tùy chọn) Lấy các công nợ chưa trả để hiện chi tiết ở tab INFO
  const { data: debts, isLoading: loadingDebts } = useQuery({
    queryKey: ['supplier-unpaid-debts', supplier.id],
    queryFn: () => financeService.getOutstandingDebts().then((r: any) => r.data.data),
  });
  const myDebts = debts?.filter((d: any) => d.supplierId === supplier.id) || [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up">
        
        <div className="bg-blue-600 p-5 text-white flex justify-between items-center shrink-0 rounded-t-2xl">
          <div>
            <h3 className="font-bold text-xl">{supplier.name}</h3>
            <p className="text-blue-100 text-sm mt-1">MST: {supplier.taxCode || '---'} | SĐT: {supplier.phone || '---'}</p>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-blue-700/50 p-2 rounded-full transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0 px-4 pt-2">
          <button
            onClick={() => setActiveTab('INFO')}
            className={`px-4 py-3 font-medium flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'INFO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Info className="w-4 h-4" /> Thông tin & Công nợ
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-3 font-medium flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="w-4 h-4" /> Lịch sử Nhập kho
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-gray-50">
          
          {/* TAB: THÔNG TIN CƠ BẢN */}
          {activeTab === 'INFO' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3 text-sm">
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Người đại diện:</span><span className="font-medium">{supplier.contactPerson || '-'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Email:</span><span className="font-medium">{supplier.email || '-'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Ngân hàng:</span><span className="font-medium">{supplier.bankName || '-'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Số tài khoản:</span><span className="font-mono font-medium">{supplier.bankAccount || '-'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Kỳ hạn nợ:</span><span className="font-medium">Net {supplier.paymentTerms}</span></div>
                  <div className="flex flex-col gap-1 pt-1"><span className="text-gray-500">Địa chỉ:</span><span className="font-medium text-gray-800">{supplier.address || '-'}</span></div>
                  <div className="flex flex-col gap-1 pt-1"><span className="text-gray-500">Ghi chú:</span><span className="font-medium italic text-gray-700">{supplier.notes || 'Không có ghi chú'}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col items-center justify-center shadow-sm">
                  <p className="text-red-800 text-sm font-medium mb-1">Cần thanh toán (Tổng nợ)</p>
                  {loadingTotal ? <Spinner size="sm" /> : (
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(totalUnpaid)}</p>
                  )}
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Mã Đơn nhập</th>
                        <th className="py-2.5 px-3 text-right">Số nợ</th>
                        <th className="py-2.5 px-3 text-center">Hạn chót</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDebts ? (
                        <tr><td colSpan={3} className="text-center py-6"><Spinner size="sm"/></td></tr>
                      ) : myDebts.length === 0 ? (
                        <tr><td colSpan={3} className="text-center py-6 text-gray-500">Không có công nợ</td></tr>
                      ) : (
                        myDebts.map((d: any) => (
                          <tr key={d.id} className="border-t hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-mono text-xs text-gray-500 uppercase">{d.purchaseOrderCode || d.purchaseOrderId.slice(0,8)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-red-600">
                              {formatCurrency(d.remainingAmount || (d.totalDebt - d.paidAmount))}
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-600">
                              {d.dueDate ? new Date(d.dueDate).toLocaleDateString('vi-VN') : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LỊCH SỬ NHẬP KHO */}
          {activeTab === 'HISTORY' && (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="p-3">Mã PO</th>
                    <th className="p-3">Ngày tạo</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingPo ? (
                    <tr><td colSpan={4} className="p-8 text-center"><Spinner size="md" /></td></tr>
                  ) : (poData?.content || []).length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">Chưa có lịch sử nhập kho.</td></tr>
                  ) : (
                    (poData?.content || []).map((po: any) => (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="p-3 font-mono font-medium text-blue-600">{po.code}</td>
                        <td className="p-3 text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3"/> {formatDateTime(po.createdAt)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            po.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                            po.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-gray-900">{formatCurrency(po.totalAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {poData && poData.totalPages > 1 && (
                <Pagination page={poPage} totalPages={poData.totalPages} totalElements={poData.totalElements} size={5} onPageChange={setPoPage} />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT 2: MODAL THÊM/SỬA (LẤY DỮ LIỆU MỚI NHẤT KHI SỬA)
// ─────────────────────────────────────────────────────────────────
function SupplierForm({ supplierId, onClose, onSaved }: { supplierId?: string; onClose: () => void; onSaved: () => void; }) {
  const isEdit = !!supplierId;
  
  // ĐÃ NÂNG CẤP: Gọi API lấy Fresh Data nếu đang ở chế độ Edit
  const { data: freshSupplier, isLoading: loadingFresh } = useQuery({
    queryKey: ['supplier-detail', supplierId],
    queryFn: () => supplierService.getById(supplierId!).then(r => r.data.data),
    enabled: isEdit, // Chỉ gọi khi có supplierId
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { paymentTerms: 30 },
  });

  // Tự động điền Form khi Fresh Data tải xong
  useEffect(() => {
    if (freshSupplier) {
      reset({
        name: freshSupplier.name,
        taxCode: freshSupplier.taxCode || '',
        contactPerson: freshSupplier.contactPerson || '',
        phone: freshSupplier.phone || '',
        email: freshSupplier.email || '',
        address: freshSupplier.address || '',
        bankAccount: freshSupplier.bankAccount || '',
        bankName: freshSupplier.bankName || '',
        paymentTerms: freshSupplier.paymentTerms ?? 30,
        notes: freshSupplier.notes || '',
      });
    }
  }, [freshSupplier, reset]);

  const mut = useMutation({
    mutationFn: (data: SupplierFormValues) => isEdit ? supplierService.update(supplierId!, data) : supplierService.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Cập nhật thông tin thành công!' : 'Thêm nhà cung cấp thành công!');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Có lỗi xảy ra khi lưu NCC'),
  });

  const onSubmit = (data: SupplierFormValues) => mut.mutate(data);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <h3 className="font-bold text-lg">{isEdit ? 'Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        
        {isEdit && loadingFresh ? (
          <div className="flex-1 flex justify-center items-center p-12"><Spinner size="lg"/></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Tên nhà cung cấp *</label><input {...register('name')} className={`input ${errors.name ? 'border-red-500 focus:ring-red-500' : ''}`} placeholder="Tên công ty/NCC..." autoFocus />{errors.name && <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>}</div>
                <div><label className="label">Mã số thuế</label><input {...register('taxCode')} className="input" placeholder="Mã số doanh nghiệp..." /></div>
                <div><label className="label">Người liên hệ</label><input {...register('contactPerson')} className="input" placeholder="Tên người đại diện..." /></div>
                <div><label className="label">Số điện thoại</label><input {...register('phone')} className={`input ${errors.phone ? 'border-red-500 focus:ring-red-500' : ''}`} placeholder="Số điện thoại..." />{errors.phone && <span className="text-red-500 text-xs mt-1 block">{errors.phone.message}</span>}</div>
                <div><label className="label">Email</label><input {...register('email')} className={`input ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`} placeholder="Email liên hệ..." />{errors.email && <span className="text-red-500 text-xs mt-1 block">{errors.email.message}</span>}</div>
                <div><label className="label">Net Terms (ngày)</label><input type="number" {...register('paymentTerms')} className={`input ${errors.paymentTerms ? 'border-red-500 focus:ring-red-500' : ''}`} placeholder="VD: 30" />{errors.paymentTerms && <span className="text-red-500 text-xs mt-1 block">{errors.paymentTerms.message}</span>}</div>
              </div>
              <div><label className="label">Địa chỉ</label><input {...register('address')} className="input" placeholder="Địa chỉ chi tiết..." /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Số tài khoản ngân hàng</label><input {...register('bankAccount')} className="input" placeholder="STK..." /></div>
                <div><label className="label">Tên ngân hàng</label><input {...register('bankName')} className="input" placeholder="VD: Vietcombank..." /></div>
              </div>
              <div><label className="label">Ghi chú</label><textarea {...register('notes')} className="input resize-none" rows={3} placeholder="Ghi chú thêm..." /></div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end shrink-0 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
              <button type="submit" disabled={mut.isPending} className="btn-primary min-w-[120px]">{mut.isPending ? <Spinner size="sm" /> : (isEdit ? 'Lưu thay đổi' : 'Thêm mới')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT 3: PAGE CHÍNH (ĐÃ THÊM PHÂN TRANG SERVER-SIDE)
// ─────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  
  // ĐÃ THÊM STATE PHÂN TRANG
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [viewing, setViewing] = useState<Supplier | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(0); // Reset page khi đổi từ khóa tìm kiếm
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  // ĐÃ NÂNG CẤP: Gọi API Phân trang từ Backend
  const { data: pagedData, isLoading } = useQuery({
    queryKey: ['suppliers', debouncedKeyword, page],
    queryFn: () => supplierService.getAll({ keyword: debouncedKeyword, page, size: PAGE_SIZE }).then(r => r.data.data),
  });

  const toggleMut = useMutation({
    mutationFn: (s: Supplier) => supplierService.update(s.id, { isActive: !s.isActive }),
    onSuccess: () => { 
      toast.success('Đã cập nhật trạng thái nhà cung cấp!'); 
      qc.invalidateQueries({ queryKey: ['suppliers'] }); 
    },
  });

  // HÀM XUẤT EXCEL (Ép tải size lớn để xuất toàn bộ)
  const [isExporting, setIsExporting] = useState(false);
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await supplierService.getAll({ size: 10000 });
      const allSuppliers = res.data.data.content;

      if (!allSuppliers || allSuppliers.length === 0) {
        toast.error('Không có dữ liệu để xuất');
        return;
      }
      const exportData = allSuppliers.map(s => ({
        'Tên NCC': s.name,
        'Mã số thuế': s.taxCode || '',
        'Người liên hệ': s.contactPerson || '',
        'Số điện thoại': s.phone || '',
        'Email': s.email || '',
        'Địa chỉ': s.address || '',
        'Ngân hàng': s.bankName || '',
        'Số tài khoản': s.bankAccount || '',
        'Net Terms': s.paymentTerms,
        'Trạng thái': s.isActive ? 'Hoạt động' : 'Dừng',
        'Ghi chú': s.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "NhaCungCap");
      XLSX.writeFile(workbook, `DanhSach_NhaCungCap_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      toast.error('Lỗi khi xuất Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // MUTATION NHẬP EXCEL
  const [isImporting, setIsImporting] = useState(false);
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsImporting(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        let successCount = 0;
        let errorCount = 0;

        for (const row of data as any[]) {
          if (!row['Tên NCC']) continue;
          
          const payload = {
            name: String(row['Tên NCC']).trim(),
            taxCode: row['Mã số thuế'] ? String(row['Mã số thuế']) : undefined,
            contactPerson: row['Người liên hệ'] ? String(row['Người liên hệ']) : undefined,
            phone: row['Số điện thoại'] ? String(row['Số điện thoại']) : undefined,
            email: row['Email'] ? String(row['Email']) : undefined,
            address: row['Địa chỉ'] ? String(row['Địa chỉ']) : undefined,
            bankName: row['Ngân hàng'] ? String(row['Ngân hàng']) : undefined,
            bankAccount: row['Số tài khoản'] ? String(row['Số tài khoản']) : undefined,
            paymentTerms: row['Net Terms'] ? Number(row['Net Terms']) : 30,
            notes: row['Ghi chú'] ? String(row['Ghi chú']) : undefined,
          };

          try {
            await supplierService.create(payload);
            successCount++;
          } catch (err) {
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`Đã thêm thành công ${successCount} nhà cung cấp.`);
          qc.invalidateQueries({ queryKey: ['suppliers'] });
        }
        if (errorCount > 0) {
          toast.error(`Có ${errorCount} bản ghi bị lỗi (Thiếu tên hoặc trùng Mã số thuế).`);
        }
      } catch (error) {
        toast.error('File Excel không đúng định dạng!');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  if (isLoading) return <PageLoader />;

  const suppliersList = pagedData?.content || [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className="input pl-10 py-2.5" 
            placeholder="Tìm Tên, Mã số thuế, SĐT, Email..."
            value={keyword} 
            onChange={e => setKeyword(e.target.value)} 
          />
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting}
            className="btn-secondary w-full md:w-auto flex-1 md:flex-none justify-center"
            title="Xuất file Excel"
          >
            {isExporting ? <Spinner size="sm" /> : <><Download className="w-4 h-4" /> <span className="hidden sm:inline">Xuất</span></>}
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting}
            className="btn-secondary w-full md:w-auto flex-1 md:flex-none justify-center"
            title="Nhập file Excel"
          >
            {isImporting ? <Spinner size="sm" /> : <><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Nhập</span></>}
          </button>
          <input 
            type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" 
          />

          <button 
            onClick={() => { setEditingId(undefined); setShowForm(true); }} 
            className="btn-primary w-full md:w-auto flex-[2] md:flex-none justify-center shrink-0"
          >
            <Plus className="w-4 h-4" /> Thêm NCC
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Tên NCC</th>
                <th>Mã số thuế</th>
                <th>Thông tin liên hệ</th>
                <th>Ngân hàng</th>
                <th>Net Terms</th>
                <th>Trạng thái</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {suppliersList.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState 
                      icon={Handshake} 
                      title="Không tìm thấy nhà cung cấp nào phù hợp" 
                      description="Hãy thử từ khóa tìm kiếm khác hoặc thêm mới" 
                    />
                  </td>
                </tr>
              ) : (
                suppliersList.map(s => (
                  <tr key={s.id} className={!s.isActive ? 'bg-gray-50 opacity-75' : ''}>
                    <td>
                      <p className="font-medium text-gray-800">{s.name}</p>
                      {s.contactPerson && <p className="text-gray-400 text-xs">Đại diện: {s.contactPerson}</p>}
                    </td>
                    <td className="font-mono text-gray-600">{s.taxCode ?? '-'}</td>
                    <td>
                      <p className="text-sm">{s.phone ?? '-'}</p>
                      <p className="text-gray-500 text-xs truncate max-w-[150px]" title={s.email}>{s.email}</p>
                    </td>
                    <td>
                      <p className="text-sm font-mono text-gray-600">{s.bankAccount ?? '-'}</p>
                      <p className="text-gray-400 text-xs">{s.bankName}</p>
                    </td>
                    <td><span className="font-medium">Net {s.paymentTerms}</span></td>
                    <td>
                      <span className={`badge ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.isActive ? 'Hoạt động' : 'Dừng'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewing(s)} className="btn-ghost btn-sm p-1.5" title="Xem chi tiết & Lịch sử">
                          <Info className="w-4 h-4 text-blue-500" />
                        </button>
                        <button onClick={() => { setEditingId(s.id); setShowForm(true); }} className="btn-ghost btn-sm p-1.5" title="Sửa thông tin">
                          <Edit className="w-4 h-4 text-slate-600" />
                        </button>
                        <button onClick={() => toggleMut.mutate(s)} className="btn-ghost btn-sm p-1.5" title={s.isActive ? 'Khóa (Ngừng hoạt động)' : 'Mở khóa (Kích hoạt)'}>
                          {s.isActive ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-green-500" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* ĐÃ THÊM: THANH PHÂN TRANG */}
        {pagedData && pagedData.totalPages > 1 && (
          <Pagination 
            page={page} 
            totalPages={pagedData.totalPages} 
            totalElements={pagedData.totalElements} 
            size={PAGE_SIZE} 
            onPageChange={setPage} 
          />
        )}
      </div>

      {showForm && <SupplierForm supplierId={editingId} onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['suppliers'] })} />}
      {viewing && <SupplierDetailsModal supplier={viewing} onClose={() => setViewing(undefined)} />}
    </div>
  );
}