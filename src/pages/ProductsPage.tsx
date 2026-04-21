import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, Search, Edit, Package, Eye, EyeOff, ImagePlus, Filter, 
  X, CheckCircle2, AlertCircle, Box, ImageIcon, ChevronDown, PackagePlus, ScanLine
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis
} from 'recharts';
import AsyncSelect from 'react-select/async'; 
import { productService } from '@/services/product.service';
import { uploadService } from '@/services/upload.service';
import { categoryService, Category } from '@/services/category.service';
import { supplierService } from '@/services/supplier.service';
import { formatCurrency } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import type { ProductResponse, CreateProductRequest, UpdateProductRequest } from '@/types';

// Component Điều chỉnh kho nhanh & Quét mã vạch
import InventoryAdjustModal from './InventoryAdjustModal'; 
import BarcodeScanner from '@/components/BarcodeScanner';

// ==========================================
// 1. TÙY CHỈNH MÀU SẮC & TOOLTIP BIỂU ĐỒ 
// ==========================================
const CHART_COLORS = ['#4f46e5', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#0284c7'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100/80 min-w-[160px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-100/80 pb-1.5">{label || payload[0].name}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
            <span className="text-sm font-medium text-slate-500">Số lượng:</span>
          </div>
          <span className="text-sm font-black text-slate-900">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

// ==========================================
// 2. COMPONENT FORM: THÊM / SỬA SẢN PHẨM
// ==========================================
function ProductForm({ product, onClose, onSaved, categories }: { product?: ProductResponse; onClose: () => void; onSaved: () => void; categories: Category[]; }) {
  const isEdit = !!product;
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // State quản lý Bật/Tắt Camera quét mã
  const [isScanning, setIsScanning] = useState(false);

  // Lấy dữ liệu tên Nhà Cung cấp hiện tại để hiển thị sẵn trong AsyncSelect khi Edit
  const [currentSupplier, setCurrentSupplier] = useState<{value: string, label: string} | null>(null);

  const [form, setForm] = useState({
    name: product?.name ?? '',
    isbnBarcode: product?.isbnBarcode ?? '',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? '',
    supplierId: product?.supplierId ?? '',
    retailPrice: String(product?.retailPrice ?? ''),
    wholesalePrice: String(product?.wholesalePrice ?? ''),
    unit: product?.unit ?? 'Cái',
    weight: String(product?.weight ?? ''), 
    description: product?.description ?? '',
    imageUrl: product?.imageUrl ?? '',
  });

  // Thiết lập giá trị mặc định cho AsyncSelect nếu đang Edit
  useEffect(() => {
    if (isEdit && product.supplierId) {
      // Gọi API lấy thông tin chi tiết NCC để lấy tên hiển thị
      supplierService.getById(product.supplierId).then(res => {
        setCurrentSupplier({
          value: res.data.data.id,
          label: res.data.data.name
        });
      }).catch(err => console.error("Lỗi lấy thông tin NCC", err));
    }
  }, [isEdit, product]);

  // HÀM LOAD DỮ LIỆU BẤT ĐỒNG BỘ CHO REACT-SELECT
  const loadSupplierOptions = async (inputValue: string) => {
      try {
          const response = await supplierService.getAll({ 
              keyword: inputValue, 
              size: 20 // Chỉ tải 20 kết quả nhẹ nhất
          });

          const suppliers = response.data.data.content || []; 
          return suppliers.map((supplier: any) => ({
              value: supplier.id,
              label: supplier.name
          }));
      } catch (error) {
          console.error("Lỗi tải nhà cung cấp:", error);
          return [];
      }
  };

  const mut = useMutation({
    mutationFn: () => {
      if (isEdit) {
        const payload: UpdateProductRequest = {
          name: form.name.trim(),
          categoryId: form.categoryId,
          supplierId: form.supplierId || null,
          hasSupplierId: true, 
          retailPrice: parseFloat(form.retailPrice) || 0,
          wholesalePrice: parseFloat(form.wholesalePrice) || undefined,
          unit: form.unit.trim() || 'Cái',
          weight: parseFloat(form.weight) || undefined, 
          description: form.description.trim(),
          imageUrl: form.imageUrl,
        };
        return productService.update(product!.id, payload);
      } else {
        const payload: CreateProductRequest = {
          name: form.name.trim(),
          isbnBarcode: form.isbnBarcode.trim(),
          sku: form.sku.trim() || undefined,
          categoryId: form.categoryId,
          supplierId: form.supplierId || undefined,
          retailPrice: parseFloat(form.retailPrice) || 0,
          wholesalePrice: parseFloat(form.wholesalePrice) || undefined,
          unit: form.unit.trim() || 'Cái',
          weight: parseFloat(form.weight) || undefined, 
          description: form.description.trim(),
          imageUrl: form.imageUrl,
        };
        return productService.create(payload);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Hồ sơ sản phẩm đã được cập nhật' : 'Sản phẩm mới đã được tạo');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Đã xảy ra lỗi hệ thống'),
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);

    try {
      const res = await uploadService.uploadImage(file);
      setForm(prev => ({ ...prev, imageUrl: res.data.data.url }));
      toast.success('Đã tải ảnh lên thành công!');
    } catch (err) {
      toast.error('Lỗi upload ảnh. Vui lòng thử lại.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-opacity">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in border border-slate-100 overflow-hidden">
          
          {/* Header Modal */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80">
            <div>
              <h3 className="font-bold text-xl text-slate-900 tracking-tight">{isEdit ? 'Cập nhật Sản phẩm' : 'Thêm Sản phẩm mới'}</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">Cung cấp đầy đủ thông tin để quản lý hiệu quả</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Modal */}
          <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
            
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] space-y-5">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-3"><Box className="w-4 h-4 text-indigo-500" /> Thông tin cơ bản</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Tên sản phẩm *</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Tên sản phẩm..." autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Mã Barcode / ISBN *</label>
                  <div className="relative">
                    <input 
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed" 
                      value={form.isbnBarcode} 
                      onChange={e => f('isbnBarcode', e.target.value)} 
                      disabled={isEdit} 
                      placeholder="Mã vạch..." 
                    />
                    {/* Nút quét mã chỉ hiển thị khi thêm mới */}
                    {!isEdit && (
                      <button
                        type="button"
                        onClick={() => setIsScanning(true)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg transition-colors"
                        title="Quét mã bằng Camera"
                      >
                        <ScanLine className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="relative">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Phân loại *</label>
                  <select className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none cursor-pointer" value={form.categoryId} onChange={e => f('categoryId', e.target.value)}>
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-[34px] w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Nhà cung cấp</label>
                  <AsyncSelect
                      cacheOptions
                      defaultOptions 
                      loadOptions={loadSupplierOptions}
                      placeholder="Gõ để tìm Nhà cung cấp..."
                      noOptionsMessage={() => "Không tìm thấy nhà cung cấp nào"}
                      value={currentSupplier}
                      onChange={(selectedOption: any) => {
                          setCurrentSupplier(selectedOption);
                          setForm({ ...form, supplierId: selectedOption ? selectedOption.value : '' });
                      }}
                      isClearable={true}
                      className="text-sm font-medium"
                      styles={{
                          control: (baseStyles, state) => ({
                              ...baseStyles,
                              backgroundColor: state.isFocused ? '#ffffff' : '#f8fafc',
                              borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
                              boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
                              borderRadius: '0.75rem',
                              padding: '2px',
                              transition: 'all 0.2s ease'
                          }),
                      }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] space-y-5">
                 <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-3"><Package className="w-4 h-4 text-indigo-500" /> Bán hàng & Lưu kho</h4>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Giá bán lẻ *</label>
                     <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-indigo-600 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.retailPrice} onChange={e => f('retailPrice', e.target.value)} />
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Giá sỉ (Tùy chọn)</label>
                     <input type="number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-teal-600 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.wholesalePrice} onChange={e => f('wholesalePrice', e.target.value)} />
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Mã SKU</label>
                     <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="VD: SP-001" />
                   </div>
                   <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Đơn vị / Trọng lượng</label>
                     <div className="flex gap-2">
                        <input className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" value={form.unit} onChange={e => f('unit', e.target.value)} placeholder="Cái" />
                        <input type="number" className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" value={form.weight} onChange={e => f('weight', e.target.value)} placeholder="Gram" />
                     </div>
                   </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)] flex flex-col">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-3 mb-4"><ImagePlus className="w-4 h-4 text-indigo-500" /> Hình ảnh đại diện</h4>
                <div className="flex-1 flex flex-col items-center justify-center">
                  {form.imageUrl ? (
                    <div className="relative w-36 h-36 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
                      <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                      <button type="button" onClick={() => f('imageUrl', '')} className="absolute top-2 right-2 bg-white/90 backdrop-blur rounded-full w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-all opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                  ) : (
                    <label className={`w-full h-full min-h-[144px] flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-4 cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 transition-all ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingImage ? <Spinner size="md" className="text-indigo-500" /> : <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center"><ImageIcon className="w-6 h-6 text-slate-400" /></div>}
                      <span className="text-sm font-medium text-slate-500">{uploadingImage ? 'Đang xử lý ảnh...' : 'Nhấn để tải ảnh lên (Tỉ lệ 1:1)'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_24px_rgb(0,0,0,0.02)]">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Mô tả sản phẩm</label>
              <textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none custom-scrollbar" rows={3} value={form.description} onChange={e => f('description', e.target.value)} placeholder="Nhập mô tả chi tiết, thành phần, công dụng..." />
            </div>
          </div>

          {/* Footer Modal */}
          <div className="p-6 border-t border-slate-100 flex gap-4 justify-end bg-white">
            <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">Hủy bỏ</button>
            <button 
              onClick={() => mut.mutate()} 
              disabled={mut.isPending || !form.name || !form.isbnBarcode || !form.retailPrice || !form.categoryId || uploadingImage} 
              className="flex items-center justify-center min-w-[160px] px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {mut.isPending ? <Spinner size="sm" className="text-white" /> : (isEdit ? 'Lưu thay đổi' : 'Hoàn tất tạo mới')}
            </button>
          </div>
        </div>
      </div>

      {/* Gọi Camera Quét Mã (Z-index cao nhất đè lên Modal Form) */}
      {isScanning && (
        <BarcodeScanner 
          onScanSuccess={(code) => {
            f('isbnBarcode', code);
            setIsScanning(false);
          }}
          onClose={() => setIsScanning(false)}
        />
      )}
    </>
  );
}

// ==========================================
// 3. TRANG CHÍNH: DANH SÁCH SẢN PHẨM
// ==========================================
export default function ProductsPage() {
  const [keyword, setKeyword] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  
  // BỘ LỌC NHÀ CUNG CẤP
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');
  const [page, setPage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductResponse | undefined>();
  const [viewingProduct, setViewingProduct] = useState<ProductResponse | null>(null);
  
  // STATE ĐIỀU CHỈNH TỒN KHO NHANH
  const [adjustingProduct, setAdjustingProduct] = useState<ProductResponse | null>(null);

  const qc = useQueryClient();

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => categoryService.getAll().then(r => r.data.data) });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers-dict'], queryFn: () => supplierService.getAll({ size: 1000 }).then(r => r.data.data.content) });

  const getSupplierName = (id?: string) => {
    if (!id || !suppliers) return null;
    return suppliers.find((s: any) => s.id === id)?.name;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['products', keyword, selectedCategoryId, supplierFilter, isActiveFilter, page],
    queryFn: () => productService.getProducts({ 
      keyword: keyword || undefined, 
      categoryId: selectedCategoryId || undefined, 
      supplierId: supplierFilter || undefined, 
      isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      page, size: 20 
    }).then(r => r.data.data),
  });

  const toggleMut = useMutation({
    mutationFn: (p: ProductResponse) => productService.update(p.id, { isActive: !p.isActive }),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái kinh doanh');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const handleEditClick = async (productId: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    try {
      const res = await productService.getById(productId);
      setEditing(res.data.data);
      setShowForm(true);
    } catch (error) {
      toast.error('Không thể tải thông tin chi tiết của sản phẩm.');
    }
  };

  const handleToggleActive = (p: ProductResponse, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    const action = p.isActive ? 'ngừng kinh doanh' : 'mở bán lại';
    if (window.confirm(`Xác nhận ${action} sản phẩm "${p.name}"?`)) {
      toggleMut.mutate(p);
    }
  };

  const dashboardStats = useMemo(() => {
    const prods = data?.content || [];
    let inStock = 0, lowStock = 0, outStock = 0;
    const catMap: Record<string, number> = {};

    prods.forEach(p => {
      const qty = p.availableQuantity || 0;
      if (qty === 0) outStock++;
      else if (qty < 10) lowStock++;
      else inStock++;

      const cName = p.categoryName || 'Khác';
      catMap[cName] = (catMap[cName] || 0) + 1;
    });

    const categoryData = Object.entries(catMap)
      .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value).slice(0, 5); 

    const stockData = [
      { name: 'Đủ hàng', value: inStock, fill: '#10b981' },
      { name: 'Sắp hết', value: lowStock, fill: '#f59e0b' },
      { name: 'Hết hàng', value: outStock, fill: '#f43f5e' },
    ].filter(s => s.value > 0);

    return { categoryData, stockData };
  }, [data?.content]);

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Danh mục Sản phẩm</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Quản lý kho hàng, thông tin hàng hóa và định giá.</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all">
          <Plus className="w-5 h-5" /> Thêm sản phẩm
        </button>
      </div>

      {/* MINI DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm"><Package className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Mã hàng hệ thống</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{data?.totalElements || 0}</h3>
            </div>
          </div>
          <div className="relative z-10 flex gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md border border-emerald-100/60">Live Sync</span>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-6">
          <div className="w-1/2 h-[120px] relative">
            {dashboardStats.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardStats.categoryData} innerRadius={42} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {dashboardStats.categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-400 bg-slate-50 rounded-full border border-slate-100 border-dashed">Trống</div>}
          </div>
          <div className="w-1/2 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu danh mục</p>
            <div className="space-y-2.5">
              {dashboardStats.categoryData.slice(0, 3).map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold truncate pr-2">
                    <div className="w-2 h-2 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: cat.color }}/>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Cảnh báo tồn kho (Trang này)</p>
          <div className="h-[90px] w-full">
            {dashboardStats.stockData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardStats.stockData} layout="vertical" margin={{ top: 0, right: 30, left: -10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} width={80} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                    {dashboardStats.stockData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm font-medium text-slate-400 text-center h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">Dữ liệu hoàn hảo</p>}
          </div>
        </div>
      </div>

      {/* KHU VỰC BẢNG DỮ LIỆU SẢN PHẨM */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
        
        {/* Thanh công cụ (Toolbar) */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-white">
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="relative flex-1 group min-w-[250px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Tìm tên, ISBN, SKU..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={keyword}
                onChange={e => { setKeyword(e.target.value); setPage(0); }}
              />
            </div>
            
            <div className="relative w-full sm:w-48 shrink-0 group">
               <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
               <select 
                 className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={selectedCategoryId} 
                 onChange={(e) => { setSelectedCategoryId(e.target.value); setPage(0); }}
               >
                 <option value="">Tất cả danh mục</option>
                 {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            {/* DROPDOWN LỌC NHÀ CUNG CẤP */}
            <div className="relative w-full sm:w-48 shrink-0 group">
              <select
                value={supplierFilter}
                onChange={(e) => { setSupplierFilter(e.target.value); setPage(0); }}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Tất cả Nhà Cung Cấp</option>
                {suppliers?.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-40 shrink-0 group">
               <select 
                 className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer" 
                 value={isActiveFilter} 
                 onChange={(e) => { setIsActiveFilter(e.target.value); setPage(0); }}
               >
                 <option value="">Mọi trạng thái</option>
                 <option value="true">Đang kinh doanh</option>
                 <option value="false">Ngừng kinh doanh</option>
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto relative min-h-[400px]">
          {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>}
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Sản phẩm</th>
                <th className="px-6 py-5">Mã Barcode / SKU</th>
                <th className="px-6 py-5">Phân loại & NCC</th>
                <th className="px-6 py-5 text-right">Giá bán (VNĐ)</th>
                <th className="px-6 py-5 text-right">Tồn kho</th>
                <th className="px-6 py-5 text-center w-36">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {(data?.content ?? []).length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={6} className="py-24">
                    <EmptyState 
                      icon={Package} 
                      title="Chưa có dữ liệu sản phẩm" 
                      description="Hãy thêm sản phẩm mới hoặc điều chỉnh lại bộ lọc tìm kiếm." 
                      action={<button onClick={() => setShowForm(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm">Thêm mới ngay</button>} 
                    />
                  </td>
                </tr>
              ) : (
                (data?.content ?? []).map((p: ProductResponse) => (
                  <tr key={p.id} onClick={() => setViewingProduct(p)} className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${!p.isActive ? 'opacity-60 bg-slate-50/50 grayscale-[20%]' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl border border-slate-100 overflow-hidden bg-white shrink-0 shadow-sm relative group-hover:shadow-md transition-all">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          )}
                        </div>
                        <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-[13px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-max">{p.isbnBarcode}</span>
                        {p.sku && <span className="font-mono text-xs font-semibold text-slate-400">SKU: {p.sku}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-indigo-600 text-[13px]">{p.categoryName ?? 'Chưa phân loại'}</span>
                        <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px] uppercase tracking-wide">{getSupplierName(p.supplierId) || 'Đa NCC'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-black text-slate-900 text-base">{formatCurrency(p.retailPrice)}</p>
                      <p className="text-[11px] text-slate-400 mt-1 font-medium" title="Giá vốn (MAC) / Giá Sỉ">
                        <span className="text-amber-600">{formatCurrency(p.macPrice || 0)}</span>
                        {p.wholesalePrice ? ` / ${formatCurrency(p.wholesalePrice)}` : ''}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-black text-slate-900 text-lg">{p.availableQuantity || 0}</span>
                        {p.isActive ? (
                          (p.availableQuantity || 0) > 10 ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-100/60 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Còn hàng</span> :
                          (p.availableQuantity || 0) > 0 ? <span className="bg-amber-50 text-amber-700 border border-amber-100/60 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Sắp hết</span> :
                          <span className="bg-rose-50 text-rose-700 border border-rose-100/60 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Hết hàng</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Ngừng bán</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setViewingProduct(p); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chi tiết"><Eye className="w-4 h-4"/></button>
                        <button onClick={(e) => handleEditClick(p.id, e)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Sửa"><Edit className="w-4 h-4"/></button>
                        
                        {/* NÚT NHẬP KHO NHANH */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setAdjustingProduct(p); }} 
                            className="text-emerald-600 hover:text-emerald-800 transition p-1.5 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                            title="Điều chỉnh / Nhập kho nhanh"
                        >
                            <PackagePlus className="w-4 h-4" />
                        </button>

                        <button onClick={(e) => handleToggleActive(p, e)} className={`p-1.5 rounded-lg transition-colors ${p.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={p.isActive ? 'Ngừng kinh doanh' : 'Mở bán lại'}>
                          {p.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {data && data.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* CHI TIẾT SẢN PHẨM */}
      {viewingProduct && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 transition-opacity" onClick={() => setViewingProduct(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#fcfcfd] shadow-2xl z-50 flex flex-col border-l border-slate-100 animate-slide-in-right">
            
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Hồ sơ Sản phẩm</h2>
              <button onClick={() => setViewingProduct(null)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all bg-white shadow-sm border border-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              <div className="w-full aspect-[4/3] rounded-3xl bg-white border border-slate-100 overflow-hidden relative shadow-[0_4px_20px_rgb(0,0,0,0.03)] group">
                {viewingProduct.imageUrl ? (
                  <img src={viewingProduct.imageUrl} alt={viewingProduct.name} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-slate-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  {!viewingProduct.isActive ? <span className="bg-slate-900/90 text-white backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">Ngừng bán</span> :
                    (viewingProduct.availableQuantity || 0) > 10 ? <span className="bg-emerald-500/90 text-white backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider"><CheckCircle2 className="w-3.5 h-3.5"/> Đang bán</span> :
                    <span className="bg-rose-500/90 text-white backdrop-blur px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider"><AlertCircle className="w-3.5 h-3.5"/> Thiếu hàng</span>
                  }
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-100/50 uppercase tracking-wider">{viewingProduct.categoryName || 'Chưa phân loại'}</span>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">SKU: {viewingProduct.sku || 'N/A'}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{viewingProduct.name}</h3>
                <p className="font-mono text-sm font-semibold text-slate-500 mt-3 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 w-max shadow-sm">
                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h2v12H4zm4 0h2v12H8zm4 0h2v12h-2zm6 0h-2v12h2v-12zM2 4v16h20V4H2zm18 14H4V6h16v12z"/></svg>
                  {viewingProduct.isbnBarcode}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Giá bán lẻ</p>
                  <p className="text-2xl font-black text-indigo-600">{formatCurrency(viewingProduct.retailPrice)}</p>
                  <div className="mt-3 pt-3 border-t border-slate-50 space-y-1.5">
                    <p className="text-[11px] text-slate-500 flex justify-between"><span>Giá sỉ:</span> <span className="font-bold text-slate-700">{viewingProduct.wholesalePrice ? formatCurrency(viewingProduct.wholesalePrice) : '---'}</span></p>
                    <p className="text-[11px] text-slate-500 flex justify-between"><span>Giá vốn:</span> <span className="font-black text-amber-600">{formatCurrency(viewingProduct.macPrice || 0)}</span></p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tồn kho</p>
                  <p className="text-2xl font-black text-slate-900">{viewingProduct.availableQuantity || 0} <span className="text-sm font-semibold text-slate-500 ml-0.5">{viewingProduct.unit || 'SP'}</span></p>
                  <div className="mt-auto pt-3 border-t border-slate-50 space-y-1.5">
                    <p className="text-[11px] text-slate-500 flex justify-between"><span>Chờ giao:</span> <span className="font-bold text-slate-700">0</span></p>
                    <p className="text-[11px] text-slate-500 flex justify-between"><span>Đang nhập:</span> <span className="font-bold text-indigo-600">0</span></p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                <div className="flex items-center gap-2 mb-4">
                  <Box className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-slate-900 text-sm">Thuộc tính bổ sung</h4>
                </div>
                <ul className="space-y-3 text-[13px]">
                  <li className="flex justify-between items-center"><span className="text-slate-500 font-medium">Đơn vị tính</span><span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded">{viewingProduct.unit || '---'}</span></li>
                  <li className="flex justify-between items-center"><span className="text-slate-500 font-medium">Trọng lượng</span><span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded">{viewingProduct.weight ? `${viewingProduct.weight} gram` : '---'}</span></li>
                  <li className="flex justify-between items-center"><span className="text-slate-500 font-medium">Nhà cung cấp</span><span className="font-bold text-slate-800 text-right max-w-[180px] truncate">{getSupplierName(viewingProduct.supplierId) || 'Đa nhà cung cấp'}</span></li>
                </ul>
              </div>

              {viewingProduct.description && (
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                  <h4 className="font-bold text-slate-900 text-sm mb-3">Mô tả sản phẩm</h4>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">{viewingProduct.description}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white grid grid-cols-2 gap-4 shrink-0">
              <button onClick={() => { setViewingProduct(null); handleEditClick(viewingProduct.id); }} className="flex justify-center items-center gap-2 bg-slate-100 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-200 transition-colors">
                <Edit className="w-4 h-4" /> Sửa thông tin
              </button>
              <button onClick={() => { setViewingProduct(null); setAdjustingProduct(viewingProduct); }} className="flex justify-center items-center gap-2 bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-800 transition-colors">
                <PackagePlus className="w-4 h-4" /> Cập nhật kho
              </button>
            </div>

          </div>
        </>
      )}

      {/* MODAL ĐIỀU CHỈNH TỒN KHO NHANH */}
      {adjustingProduct && (
          <InventoryAdjustModal
              product={adjustingProduct} 
              onClose={() => setAdjustingProduct(null)}
              onSuccess={() => {
                  setAdjustingProduct(null);
                  qc.invalidateQueries({ queryKey: ['products'] }); 
              }}
          />
      )}

      {/* Form modal ẩn / hiện */}
      {showForm && (
        <ProductForm product={editing} categories={categories ?? []} onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['products'] })} />
      )}

      {/* CSS Animation Slide */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-right { animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}