import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, FolderTree, Eye, EyeOff, CornerDownRight } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b flex justify-between">
          <h3 className="font-bold text-lg">{isEdit ? 'Sửa danh mục' : 'Thêm danh mục'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="label">Tên danh mục *</label>
            <input 
              className="input" 
              value={form.name} 
              onChange={e => setForm({ ...form, name: e.target.value })} 
              autoFocus 
              placeholder="VD: Điện thoại, Phụ kiện..."
            />
          </div>
          <div>
            <label className="label">Danh mục cha</label>
            <select className="input" value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}>
              <option value="">-- Không có (Danh mục gốc) --</option>
              {categories.filter(c => c.id !== category?.id).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Thứ tự hiển thị (Sort Order)</label>
            <input 
              type="number" 
              className="input" 
              value={form.sortOrder} 
              onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} 
            />
            <p className="text-[11px] text-gray-500 mt-1">Số nhỏ hơn sẽ hiển thị lên trước.</p>
          </div>
          <div>
            <label className="label">Mô tả (SEO)</label>
            <textarea 
              className="input resize-none" 
              rows={3} 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
              placeholder="Mô tả ngắn gọn về danh mục này..."
            />
          </div>
        </div>

        <div className="p-5 border-t flex gap-3 justify-end bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary bg-white">Hủy</button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || !form.name.trim()} 
            className="btn-primary min-w-[100px] flex justify-center"
          >
            {mut.isPending ? <Spinner size="sm" color="white" /> : 'Lưu lại'}
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Quản lý danh mục</h2>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Thêm danh mục
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead className="bg-gray-50">
              <tr>
                <th>Tên danh mục</th>
                <th>Slug (Đường dẫn)</th>
                <th className="text-center">Thứ tự</th>
                <th>Trạng thái</th>
                <th className="text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {treeCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState icon={FolderTree} title="Chưa có danh mục nào" subtitle="Hãy bấm Thêm danh mục để bắt đầu phân loại sản phẩm." />
                  </td>
                </tr>
              ) : (
                treeCategories.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td>
                      <div 
                        className="flex items-center gap-2"
                        // 3. LÙI LỀ DỰA TRÊN CẤP BẬC (LEVEL) CỦA DANH MỤC
                        style={{ paddingLeft: `${c.level * 1.5}rem` }} 
                      >
                        {c.level > 0 && <CornerDownRight className="w-4 h-4 text-gray-300" />}
                        <span className={`font-semibold ${c.level === 0 ? 'text-gray-800' : 'text-gray-600'}`}>
                          {c.name}
                        </span>
                      </div>
                      {c.description && (
                        <div 
                          className="text-[11px] text-gray-400 mt-1 truncate max-w-xs"
                          style={{ paddingLeft: c.level > 0 ? `${(c.level * 1.5) + 1.5}rem` : '0' }}
                        >
                          {c.description}
                        </div>
                      )}
                    </td>
                    <td className="font-mono text-gray-500 text-[13px]">{c.slug}</td>
                    <td className="text-center font-medium text-gray-600">{c.sortOrder}</td>
                    <td>
                      <span className={`badge ${c.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'} border`}>
                        {c.isActive ? 'Hoạt động' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditing(c); setShowForm(true); }} className="btn-ghost btn-sm p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100" title="Chỉnh sửa">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleMut.mutate(c)} 
                          className={`btn-ghost btn-sm p-1.5 ${c.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`} 
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