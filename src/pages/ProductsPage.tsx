// src/pages/ProductsPage.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Package, Eye, EyeOff, ImagePlus, Filter } from 'lucide-react';
import { productService } from '@/services/product.service';
import { uploadService } from '@/services/upload.service';
import { categoryService, Category } from '@/services/category.service';
import { supplierService } from '@/services/supplier.service';
import { formatCurrency } from '@/lib/utils';
import { PageLoader, EmptyState, Pagination, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import type { ProductResponse, CreateProductRequest, UpdateProductRequest } from '@/types';

function ProductForm({
  product,
  onClose,
  onSaved,
  categories
}: {
  product?: ProductResponse;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
}) {
  const isEdit = !!product;
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-dict'],
    queryFn: () => supplierService.getAll({ size: 1000 }).then(r => r.data.data.content),
  });

  const mut = useMutation({
    mutationFn: () => {
      // ĐÃ SỬA: Type an toàn, không dùng 'any' bypass
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
      toast.success(isEdit ? 'Cập nhật sản phẩm thành công' : 'Tạo sản phẩm thành công');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Lỗi hệ thống'),
  });

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);

    try {
      const res = await uploadService.uploadImage(file);
      setForm(prev => ({ ...prev, imageUrl: res.data.data.url }));
      toast.success('Upload ảnh thành công!');
    } catch (err) {
      toast.error('Lỗi upload ảnh. Vui lòng thử lại.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <h3 className="font-bold text-lg">{isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tên sản phẩm *</label>
              <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Tên sản phẩm..." autoFocus />
            </div>
            <div>
              <label className="label">Mã ISBN/Barcode *</label>
              <input className="input" value={form.isbnBarcode} onChange={e => f('isbnBarcode', e.target.value)} disabled={isEdit} placeholder="Mã vạch..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Danh mục sản phẩm *</label>
              <select className="input bg-white" value={form.categoryId} onChange={e => f('categoryId', e.target.value)}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nhà cung cấp / NXB</label>
              <select className="input bg-white" value={form.supplierId} onChange={e => f('supplierId', e.target.value)}>
                <option value="">-- Tự do / Nhiều NCC --</option>
                {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Giá bán lẻ (đ) *</label>
              <input type="number" className="input" value={form.retailPrice} onChange={e => f('retailPrice', e.target.value)} />
            </div>
            <div>
              <label className="label">Giá bán sỉ / buôn (đ)</label>
              <input type="number" className="input" value={form.wholesalePrice} onChange={e => f('wholesalePrice', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Mã lưu kho (SKU)</label>
              <input className="input" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="VD: SP-001" />
            </div>
            <div>
              <label className="label">Đơn vị tính</label>
              <input className="input" value={form.unit} onChange={e => f('unit', e.target.value)} placeholder="VD: Cái, Hộp..." />
            </div>
            <div>
              <label className="label">Trọng lượng (gram)</label>
              <input type="number" className="input" value={form.weight} onChange={e => f('weight', e.target.value)} placeholder="VD: 200" />
            </div>
          </div>

          <div>
            <label className="label">Hình ảnh sản phẩm</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingImage ? <Spinner size="sm" /> : <ImagePlus className="w-5 h-5 text-gray-400" />}
                  <span className="text-sm text-gray-600">{uploadingImage ? 'Đang tải lên...' : 'Click để chọn file ảnh'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              </div>
              {form.imageUrl ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                  <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => f('imageUrl', '')} className="absolute top-1 right-1 bg-white/80 rounded-full w-6 h-6 flex items-center justify-center text-red-500 hover:bg-white transition-colors">✕</button>
                </div>
              ) : (
                <div className="w-20 h-20 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400 shrink-0">Trống</div>
              )}
            </div>
          </div>

          <div>
            <label className="label">Mô tả chi tiết</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => f('description', e.target.value)} />
          </div>
        </div>

        <div className="p-5 border-t flex gap-3 justify-end bg-gray-50 rounded-b-2xl shrink-0">
          <button onClick={onClose} className="btn-secondary bg-white">Hủy</button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || !form.name || !form.isbnBarcode || !form.retailPrice || !form.categoryId || uploadingImage} 
            className="btn-primary min-w-[120px] justify-center"
          >
            {mut.isPending ? <Spinner size="sm" color="white" /> : (isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [keyword, setKeyword] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>(''); // ĐÃ BỔ SUNG: State lọc Trạng thái
  const [page, setPage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductResponse | undefined>();
  const qc = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll().then(r => r.data.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-dict'],
    queryFn: () => supplierService.getAll({ size: 1000 }).then(r => r.data.data.content),
  });

  const getSupplierName = (id?: string) => {
    if (!id || !suppliers) return null;
    return suppliers.find((s: any) => s.id === id)?.name;
  };

  // ĐÃ SỬA: Truyền isActiveFilter vào param
  const { data, isLoading } = useQuery({
    queryKey: ['products', keyword, selectedCategoryId, isActiveFilter, page],
    queryFn: () => productService.getProducts({ 
      keyword: keyword || undefined, 
      categoryId: selectedCategoryId || undefined, 
      isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      page, 
      size: 20 
    }).then(r => r.data.data),
  });

  const toggleMut = useMutation({
    mutationFn: (p: ProductResponse) => productService.update(p.id, { isActive: !p.isActive }),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  // ĐÃ SỬA: Dùng API getById để lấy thông tin mới nhất khi Sửa
  const handleEditClick = async (productId: string) => {
    try {
      const res = await productService.getById(productId);
      setEditing(res.data.data);
      setShowForm(true);
    } catch (error) {
      toast.error('Không thể tải thông tin chi tiết của sản phẩm.');
    }
  };

  // ĐÃ SỬA: Yêu cầu xác nhận khi Ẩn/Hiện sản phẩm
  const handleToggleActive = (p: ProductResponse) => {
    const action = p.isActive ? 'ẩn (ngừng bán)' : 'hiện (mở bán)';
    if (window.confirm(`Bạn có chắc chắn muốn ${action} sản phẩm "${p.name}" không?`)) {
      toggleMut.mutate(p);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              className="input pl-10" 
              placeholder="Tìm theo tên, ISBN, SKU..." 
              value={keyword} 
              onChange={e => { setKeyword(e.target.value); setPage(0); }} 
            />
          </div>
          <div className="relative w-40 shrink-0">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
             <select 
               className="input pl-9 bg-white cursor-pointer" 
               value={selectedCategoryId} 
               onChange={(e) => { setSelectedCategoryId(e.target.value); setPage(0); }}
             >
               <option value="">Tất cả danh mục</option>
               {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          </div>

          {/* ĐÃ BỔ SUNG: Dropdown lọc trạng thái */}
          <div className="relative w-36 shrink-0">
             <select 
               className="input bg-white cursor-pointer" 
               value={isActiveFilter} 
               onChange={(e) => { setIsActiveFilter(e.target.value); setPage(0); }}
             >
               <option value="">Mọi trạng thái</option>
               <option value="true">Đang bán (Hiện)</option>
               <option value="false">Ngừng bán (Ẩn)</option>
             </select>
          </div>

        </div>
        
        <button onClick={() => { setEditing(undefined); setShowForm(true); }} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Thêm sản phẩm
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th>Sản phẩm</th>
                <th>Mã Barcode / SKU</th>
                <th>Nhà cung cấp</th>
                <th>Giá bán</th>
                <th>Giá vốn (MAC)</th>
                <th>Tồn kho</th>
                <th>Trạng thái</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.content ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState 
                      icon={Package} 
                      title="Không tìm thấy sản phẩm" 
                      description="Thử thay đổi từ khóa hoặc bộ lọc danh mục" 
                      action={<button onClick={() => setShowForm(true)} className="btn-primary mt-4">Thêm sản phẩm mới</button>} 
                    />
                  </td>
                </tr>
              ) : (
                (data?.content ?? []).map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200">
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" /> : <Package className="w-5 h-5 text-gray-400" />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                          <p className="text-gray-500 text-[13px]">{p.categoryName ?? 'Chưa phân loại'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-mono text-gray-700 text-[13px]">{p.isbnBarcode}</span>
                        {p.sku && <span className="font-mono text-gray-400 text-xs">SKU: {p.sku}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="text-gray-600 text-sm">{getSupplierName(p.supplierId) || '-'}</span>
                    </td>
                    <td>
                        <div className="font-semibold text-gray-800">{formatCurrency(p.retailPrice)}</div>
                        <div className="text-xs text-gray-400">Sỉ: {p.wholesalePrice ? formatCurrency(p.wholesalePrice) : '-'}</div>
                    </td>
                    
                    {/* ĐÃ BỔ SUNG HIỂN THỊ MAC PRICE */}
                    <td className="font-medium text-amber-600">{formatCurrency(p.macPrice || 0)}</td>
                    
                    <td className="font-bold text-blue-600">{p.availableQuantity || 0}</td>
                    <td>
                      <span className={`badge ${p.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-200 text-gray-500 border-gray-300'} border`}>
                        {p.isActive ? 'Hoạt động' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEditClick(p.id)} className="btn-ghost btn-sm p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100" title="Sửa sản phẩm">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleActive(p)} className={`btn-ghost btn-sm p-1.5 ${p.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`} title={p.isActive ? 'Ẩn sản phẩm' : 'Kích hoạt'}>
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
          <div className="p-4 border-t">
            <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} />
          </div>
        )}
      </div>

      {showForm && (
        <ProductForm 
          product={editing} 
          categories={categories ?? []} 
          onClose={() => setShowForm(false)} 
          onSaved={() => qc.invalidateQueries({ queryKey: ['products'] })} 
        />
      )}
    </div>
  );
}