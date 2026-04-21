import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, FolderTree, Eye, EyeOff, CornerDownRight, X, Save, Search, Activity } from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { categoryService, Category, CategoryPayload } from '@/services/category.service';
import { PageLoader, EmptyState, Spinner } from '@/components/ui';
import toast from 'react-hot-toast';

// 1. ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO CÂY DANH MỤC
interface CategoryNode extends Category {
  level: number;
  children: CategoryNode[];
}

// --- CẤU HÌNH TOOLTIP CHO BIỂU ĐỒ ---
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100/80 min-w-[160px]">
        <p className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-100/80 pb-1.5">{payload[0].name}</p>
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

// 2. COMPONENT MODAL THÊM/SỬA
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-scale-in border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 shrink-0">
          <div>
            <h3 className="font-bold text-xl text-slate-900 tracking-tight">{isEdit ? 'Cập nhật Danh mục' : 'Thêm Danh mục mới'}</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">Phân loại sản phẩm để quản lý dễ dàng hơn</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/30">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tên danh mục <span className="text-rose-500">*</span></label>
            <input 
              className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm font-bold" 
              value={form.name} 
              onChange={e => setForm({ ...form, name: e.target.value })} 
              autoFocus 
              placeholder="VD: Điện thoại, Phụ kiện..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Danh mục cha</label>
              <select 
                className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm font-medium cursor-pointer appearance-none" 
                value={form.parentId} 
                onChange={e => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">-- Không có (Gốc) --</option>
                {categories.filter(c => c.id !== category?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Thứ tự hiển thị</label>
              <input 
                type="number" 
                className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm font-medium" 
                value={form.sortOrder} 
                onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} 
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mô tả (Hỗ trợ SEO)</label>
            <textarea 
              className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm font-medium resize-none custom-scrollbar" 
              rows={3} 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
              placeholder="Mô tả ngắn gọn về danh mục này..."
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
            <input 
              type="checkbox" 
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm font-bold text-slate-700 cursor-pointer select-none">Kích hoạt danh mục này</label>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            Hủy bỏ
          </button>
          <button 
            onClick={() => mut.mutate()} 
            disabled={mut.isPending || !form.name.trim()} 
            className="flex items-center justify-center min-w-[140px] px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            {mut.isPending ? <Spinner size="sm" className="text-white" /> : <><Save className="w-4 h-4 mr-2" /> Lưu lại</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. TRANG CHÍNH QUẢN LÝ DANH MỤC
export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
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

  // XÂY DỰNG CÂY VÀ LÀM PHẲNG LẠI ĐỂ RENDER TABLE
  const treeCategories = useMemo(() => {
    if (!rawCategories) return [];

    const buildTree = (parentId: string | null, level: number): CategoryNode[] => {
      return rawCategories
        .filter(c => c.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(c => ({
          ...c,
          level,
          children: buildTree(c.id, level + 1),
        }));
    };

    const tree = buildTree(null, 0);

    const flattenTree = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.reduce((acc: CategoryNode[], node) => {
        return [...acc, node, ...flattenTree(node.children)];
      }, []);
    };

    return flattenTree(tree);
  }, [rawCategories]);

  // Bộ lọc nội bộ cho cây (Mở rộng)
  const displayCategories = useMemo(() => {
    if (!searchQuery.trim()) return treeCategories;
    const lower = searchQuery.toLowerCase();
    return treeCategories.filter(c => c.name.toLowerCase().includes(lower) || c.slug?.toLowerCase().includes(lower));
  }, [treeCategories, searchQuery]);

  // Tính toán dữ liệu cho Mini Dashboard
  const dashboardStats = useMemo(() => {
    if (!rawCategories) return { total: 0, active: 0, root: 0, chartData: [] };
    const total = rawCategories.length;
    const active = rawCategories.filter(c => c.isActive).length;
    const root = rawCategories.filter(c => !c.parentId).length;
    
    const chartData = [
      { name: 'Danh mục gốc', value: root, color: '#4f46e5' },
      { name: 'Danh mục con', value: total - root, color: '#0ea5e9' }
    ].filter(d => d.value > 0);
    
    return { total, active, root, chartData };
  }, [rawCategories]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Danh mục</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Phân loại, cấu trúc và sắp xếp sản phẩm cho toàn hệ thống.</p>
        </div>
        <button 
          onClick={() => { setEditing(undefined); setShowForm(true); }} 
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgb(0,0,0,0.1)] transition-all"
        >
          <Plus className="w-5 h-5" /> Thêm danh mục
        </button>
      </div>

      {/* ── MINI DASHBOARD (BỐ CỤC TỶ LỆ VÀNG) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
        {/* Card 1: Tổng số */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex items-center justify-center shadow-sm">
              <FolderTree className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Tổng Danh mục</p>
              <h3 className="text-3xl font-black text-slate-900 mt-0.5 tracking-tight">{dashboardStats.total}</h3>
            </div>
          </div>
          <div className="relative z-10 flex gap-2 items-center text-sm font-medium text-slate-600 bg-slate-50 w-max px-3 py-1.5 rounded-lg border border-slate-100">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-600 font-bold">{dashboardStats.active}</span> đang hoạt động
          </div>
        </div>

        {/* Card 2: Biểu đồ Cơ cấu */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 flex items-center gap-8">
          <div className="w-1/3 h-[120px] relative">
            {dashboardStats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboardStats.chartData} innerRadius={42} outerRadius={55} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {dashboardStats.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-400 bg-slate-50 rounded-full border border-slate-100 border-dashed">Trống</div>}
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cơ cấu Phân loại</p>
            <div className="space-y-3">
              {dashboardStats.chartData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-semibold">
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm shrink-0" style={{ backgroundColor: d.color }}/>
                    <span>{d.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{d.value} <span className="text-xs font-medium text-slate-400 ml-1">nhóm</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BẢNG DỮ LIỆU ── */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col animate-fade-in">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100/80 bg-white">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên danh mục..." 
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left min-w-[800px] text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold">
              <tr>
                <th className="px-6 py-5">Cấu trúc Danh mục</th>
                <th className="px-6 py-5">Đường dẫn (Slug)</th>
                <th className="px-6 py-5 text-center">Thứ tự</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {displayCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <EmptyState 
                      icon={FolderTree} 
                      title="Không tìm thấy danh mục nào" 
                      description={searchQuery ? "Thay đổi từ khóa tìm kiếm của bạn." : "Hãy thêm danh mục đầu tiên để bắt đầu phân loại."} 
                    />
                  </td>
                </tr>
              ) : (
                displayCategories.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors group ${!c.isActive ? 'opacity-60 bg-slate-50/40 grayscale-[20%]' : ''}`}>
                    
                    {/* Cột Cấu trúc Danh mục */}
                    <td className="px-6 py-4">
                      <div 
                        className="flex items-center gap-2"
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
                    
                    <td className="px-6 py-4 font-mono text-slate-500 font-medium text-[13px]">{c.slug}</td>
                    
                    <td className="px-6 py-4 text-center font-bold text-slate-700 bg-slate-50/50 w-24 border-x border-white">{c.sortOrder}</td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border shadow-sm ${
                        c.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {c.isActive ? 'Hoạt động' : 'Đã ẩn'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditing(c); setShowForm(true); }} 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleMut.mutate(c)} 
                          className={`p-1.5 rounded-lg transition-colors ${
                            c.isActive 
                              ? 'text-rose-500 hover:bg-rose-50' 
                              : 'text-emerald-600 hover:bg-emerald-50'
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
          categories={rawCategories ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['categories'] })} 
        />
      )}

      {/* CSS Animation Slide */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
}