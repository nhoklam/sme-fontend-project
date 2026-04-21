import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, FolderTree, Eye, EyeOff, CornerDownRight, X, Save } from 'lucide-react';
import { categoryService, Category, CategoryPayload } from '@/services/category.service';
import { PageLoader, EmptyState, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

// 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO CÂY DANH MỤC
interface CategoryNode extends Category {
  level: number;
  children: CategoryNode[];
}

function CategoryForm({ category, onClose, onSaved, categories }: {
  category?: Category; onClose: () => void; onSaved: () => void; categories: Category[];
}) {
  const isEdit = !!category;
  const [form, setForm] = useState({
    name: category?.name ?? '',
    parentId: category?.parentId ?? '',
    description: category?.description ?? '',
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload: CategoryPayload = {
        name: form.name.trim(),
        parentId: form.parentId === '' ? null : form.parentId,
        description: form.description,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
        isActive: form.isActive, 
      };

      return isEdit
        ? categoryService.update(category!.id, payload)
        : categoryService.create(payload);
    },
    onSuccess: () => { 
      toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm mới thành công'); 
      onSaved(); 
      onClose(); 
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Đã xảy ra lỗi hệ thống'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <FolderTree className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">{isEdit ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên danh mục <span className="text-rose-500">*</span></label>
            <input 
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium" 
              value={form.name} 
              onChange={e => setForm({ ...form, name: e.target.value })} 
              autoFocus 
              placeholder="VD: Điện thoại, Phụ kiện..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Danh mục cha</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium cursor-pointer" 
              value={form.parentId} 
              onChange={e => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">-- Không có (Danh mục gốc) --</option>
              {categories.filter(c => c.id !== category?.id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Thứ tự hiển thị (Sort Order)</label>
            <input 
              type="number" 
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium" 
              value={form.sortOrder} 
              onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} 
            />
            <p className="text-[11px] font-semibold text-slate-400 mt-1.5">Số nhỏ hơn sẽ được ưu tiên hiển thị lên trước.</p>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Mô tả (Hỗ trợ SEO)</label>
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-colors outline-none font-medium resize-none" 
              rows={3} 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
              placeholder="Mô tả ngắn gọn về danh mục này..."
            />
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm font-bold text-slate-700 cursor-pointer">Cho phép hoạt động</label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
            Hủy bỏ
          </button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || !form.name.trim()} 
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[120px]"
          >
            {mut.isPending ? <Spinner size="sm" className="text-white" /> : <><Save className="w-4 h-4 mr-2" /> Lưu lại</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();
  const qc = useQueryClient();

  const { data: rawCategories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll().then(r => r.data.data),
  });

  const toggleMut = useMutation({
    mutationFn: (c: Category) => categoryService.update(c.id, { 
      name: c.name, 
      parentId: c.parentId, 
      description: c.description, 
      sortOrder: c.sortOrder, 
      isActive: !c.isActive 
    }),
    onSuccess: () => { 
      toast.success('Đã cập nhật trạng thái hoạt động'); 
      qc.invalidateQueries({ queryKey: ['categories'] }); 
    },
  });

  // 2. THUẬT TOÁN ĐỆ QUY: XÂY DỰNG CÂY VÀ LÀM PHẲNG LẠI ĐỂ RENDER TABLE
  const treeCategories = useMemo(() => {
    if (!rawCategories) return [];

    // Hàm đệ quy tạo cây & sắp xếp theo sortOrder
    const buildTree = (parentId: string | null, level: number): CategoryNode[] => {
      return rawCategories
        .filter(c => c.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder) // Áp dụng Sort Order
        .map(c => ({
          ...c,
          level,
          children: buildTree(c.id, level + 1), // Đệ quy tìm con
        }));
    };

    const tree = buildTree(null, 0);

    // Làm phẳng cây để render bằng thẻ <tr> dễ dàng, nhưng vẫn giữ thứ tự Cha -> Con -> Cháu
    const flattenTree = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.reduce((acc: CategoryNode[], node) => {
        return [...acc, node, ...flattenTree(node.children)];
      }, []);
    };

    return flattenTree(tree);
  }, [rawCategories]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1200px] mx-auto pb-12">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-indigo-600" /> Quản lý Danh mục
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Sắp xếp, phân loại cấu trúc sản phẩm cho toàn hệ thống</p>
        </div>
        
        <div className="flex w-full sm:w-auto">
          <button 
            onClick={() => { setEditing(undefined); setShowForm(true); }} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold inline-flex items-center px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-1.5" /> Thêm danh mục
          </button>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="text-[11px] text-slate-500 uppercase font-bold bg-white/90 backdrop-blur sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Cấu trúc Danh mục</th>
                <th className="px-5 py-4">Đường dẫn (Slug)</th>
                <th className="px-5 py-4 text-center">Thứ tự</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {treeCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <EmptyState 
                      icon={FolderTree} 
                      title="Chưa có danh mục nào" 
                      description="Hãy bấm Thêm danh mục để bắt đầu phân loại sản phẩm." 
                    />
                  </td>
                </tr>
              ) : (
                treeCategories.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    
                    {/* Cột Cấu trúc Danh mục */}
                    <td className="px-5 py-4">
                      <div 
                        className="flex items-center gap-2"
                        // 3. LÙI LỀ DỰA TRÊN CẤP BẬC (LEVEL) CỦA DANH MỤC
                        style={{ paddingLeft: `${c.level * 1.5}rem` }} 
                      >
                        {c.level > 0 && <CornerDownRight className="w-4 h-4 text-slate-300 shrink-0" />}
                        <span className={`font-bold transition-colors ${c.level === 0 ? 'text-slate-900 text-[15px]' : 'text-slate-700 text-[14px] group-hover:text-indigo-600'}`}>
                          {c.name}
                        </span>
                      </div>
                      
                      {c.description && (
                        <div 
                          className="text-xs font-medium text-slate-400 mt-1.5 truncate max-w-sm"
                          style={{ paddingLeft: c.level > 0 ? `${(c.level * 1.5) + 1.5}rem` : '0' }}
                        >
                          {c.description}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-5 py-4 font-mono text-slate-500 font-medium text-[13px]">{c.slug}</td>
                    
                    <td className="px-5 py-4 text-center font-bold text-slate-600">{c.sortOrder}</td>
                    
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg border shadow-sm ${
                        c.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {c.isActive ? 'Hoạt động' : 'Đã ẩn'}
                      </span>
                    </td>
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditing(c); setShowForm(true); }} 
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors" 
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleMut.mutate(c)} 
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            c.isActive 
                              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700' 
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700'
                          }`} 
                          title={c.isActive ? 'Ẩn danh mục' : 'Hiện danh mục'}
                        >
                          {c.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL FORM ── */}
      {showForm && (
        <CategoryForm 
          category={editing} 
          categories={rawCategories ?? []} // Vẫn truyền mảng gốc vào Select box trong Form
          onClose={() => setShowForm(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['categories'] })} 
        />
      )}
    </div>
  );
}