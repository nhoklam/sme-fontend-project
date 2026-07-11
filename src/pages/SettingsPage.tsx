import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Bot, Upload, FileText, Trash2, Eye, Search, Lock,
  Shield, ChevronDown, CheckCircle2, BrainCircuit, User2
} from 'lucide-react';
import { authService } from '@/services/auth.service';
import { aiService, KnowledgeDocument } from '@/services/ai.service';
import { useAuthStore } from '@/stores/auth.store';
import { formatDateTime } from '@/lib/utils';
import { Spinner, ConfirmDialog, EmptyState } from '@/components/ui';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// SETTINGS PAGE ROOT
// ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { isAdmin, user } = useAuthStore();
  
  // Mặc định Admin vào sẽ thấy Dữ liệu AI, các role khác sẽ thấy Bảo mật
  const defaultTab = isAdmin() ? 'ai' : 'password';
  const [tab, setTab] = useState<'ai' | 'password'>(defaultTab as any);

  const tabs = [
    { id: 'ai',       label: 'Dữ liệu AI', icon: BrainCircuit, show: isAdmin() }, 
    { id: 'password', label: 'Bảo mật',    icon: Lock,         show: true },      
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-slate-50/30 text-slate-800 p-4 md:p-8 space-y-6 md:space-y-8 font-sans pb-16 max-w-[1600px] mx-auto relative">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Cài đặt hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Quản lý bảo mật tài khoản cá nhân và cấu hình trí tuệ nhân tạo.</p>
        </div>
      </div>

      {/* ── TABS NAVIGATION THIẾT KẾ BO GÓC HIỆN ĐẠI ── */}
      <div className="bg-white p-2 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-x-auto custom-scrollbar animate-fade-in">
        <div className="flex items-center min-w-max gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-bold rounded-2xl transition-all ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/60' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── NỘI DUNG TABS ── */}
      <div className="animate-fade-in">
        {tab === 'ai'       && <AIDocumentsTab />}
        {tab === 'password' && <ChangePasswordTab user={user} />}
      </div>

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

// ─────────────────────────────────────────────────────────────
// TAB 1: AI DOCUMENTS (DỮ LIỆU AI)
// ─────────────────────────────────────────────────────────────
function AIDocumentsTab() {
  const [uploading, setUploading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [docToView, setDocToView] = useState<KnowledgeDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [topK, setTopK] = useState(5);
  const qc = useQueryClient();

  const { data: documents, isLoading } = useQuery({ queryKey: ['ai-documents'], queryFn: () => aiService.getDocuments().then(r => r.data.data) });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiService.deleteDocument(id),
    onSuccess: () => { toast.success('Đã làm sạch dữ liệu AI'); qc.invalidateQueries({ queryKey: ['ai-documents'] }); setDocToDelete(null); },
    onError: () => toast.error('Lỗi khi xóa tài liệu'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await aiService.uploadDocument(file, file.name);
      toast.success(`Học thành công: ${res.data.data.chunks ?? 'nhiều'} đoạn kiến thức`);
      qc.invalidateQueries({ queryKey: ['ai-documents'] });
    } catch {
      toast.error('Lỗi upload tài liệu');
    } finally {
      setUploading(false); e.target.value = '';
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await aiService.searchSemantic(searchQuery, topK);
      setSearchResults(res.data.data);
      if (res.data.data.length === 0) toast('Không tìm thấy ngữ nghĩa phù hợp', { icon: '🔍' });
    } catch { toast.error('Lỗi tìm kiếm AI'); } finally { setSearching(false); }
  };

  return (
    <div className="space-y-6">
      
      {/* DROPZONE CAO CẤP */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-20 -mt-20 pointer-events-none" />
        <div className="w-full max-w-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/80 rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-colors relative z-10">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-indigo-100 mb-5 group-hover:scale-110 transition-transform">
            <BrainCircuit className="w-10 h-10 text-indigo-600" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Huấn luyện AI Bán hàng</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm font-medium leading-relaxed">
            Tải lên các tài liệu PDF, DOCX, TXT chứa Chính sách, Cẩm nang sản phẩm, Quy trình để Trợ lý AI học và tư vấn cho nhân viên.
          </p>
          <label className={`mt-8 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] transition-all cursor-pointer ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
            {uploading ? <><Spinner size="sm" className="text-white" /> Đang xử lý ngôn ngữ tự nhiên...</> : <><Upload className="w-5 h-5" /> Tải lên tài liệu</>}
            <input type="file" accept=".pdf,.docx,.doc,.txt,.pptx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEARCH RAG (KIỂM THỬ) */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 p-6 md:p-8 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100/80">
            <div>
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2 tracking-tight">
                <Search className="w-5 h-5 text-indigo-500" /> Kiểm thử trí thông minh (RAG)
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Tìm kiếm ngữ nghĩa để xem AI hiểu tài liệu thế nào.</p>
            </div>
            <span className="bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm">Testing</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <input
                className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                placeholder="Hỏi AI: Chính sách đổi trả..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSemanticSearch()}
              />
            </div>
            <div className="flex gap-3">
              <div className="relative w-28 shrink-0">
                <select className="w-full pl-4 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                  <option value={3}>Top 3</option>
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <button onClick={handleSemanticSearch} disabled={searching || !searchQuery.trim()} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center justify-center shrink-0">
                {searching ? <Spinner size="sm" className="text-white" /> : 'Tìm'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-inner">
            {!searchResults ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Bot className="w-12 h-12 mb-3 text-slate-300 opacity-50" />
                <p className="text-sm font-medium">Kết quả tìm kiếm sẽ hiển thị tại đây</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium">Không tìm thấy dữ liệu. Hãy dạy thêm cho AI.</div>
            ) : (
              <div className="space-y-4">
                {searchResults.map((result: any, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-3">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100/60 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Trích đoạn #{idx + 1}
                      </span>
                      {result.score !== undefined && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/60 uppercase tracking-wider">
                          Độ tin cậy: {(result.score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-700 leading-relaxed font-medium">{result.content ?? result.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DANH SÁCH TÀI LIỆU */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 md:p-8 border-b border-slate-100/80 bg-white shrink-0">
            <h3 className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500"/> Thư viện tri thức hiện hành
            </h3>
            <p className="text-sm text-slate-500 mt-1 font-medium">Các tài liệu AI đang sử dụng làm căn cứ tư vấn.</p>
          </div>
          
          <div className="flex-1 flex flex-col relative bg-slate-50/30">
            {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>}
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase text-[11px] tracking-wider font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5">Tài liệu</th>
                    <th className="px-6 py-5 text-center">Đoạn (Chunks)</th>
                    <th className="px-6 py-5 text-right w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/80">
                  {(documents ?? []).length === 0 && !isLoading ? (
                    <tr><td colSpan={3} className="text-center py-24"><EmptyState icon={FileText} title="Chưa có tri thức nào" description="Tải lên tài liệu để bắt đầu huấn luyện AI." /></td></tr>
                  ) : (
                    (documents ?? []).map((doc: KnowledgeDocument) => (
                      <tr key={doc.id} className="hover:bg-white transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-slate-900 text-[14px] leading-snug">{doc.title}</span>
                            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                              {formatDateTime(doc.createdAt)} • 
                              <span className="uppercase font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/60">{doc.fileType}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex bg-slate-100 text-slate-700 font-black text-[13px] px-3 py-1 rounded-lg border border-slate-200/60 shadow-sm">{doc.chunkCount}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setDocToView(doc)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Xem chi tiết">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDocToDelete(doc.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors" title="Xóa tài liệu">
                              <Trash2 className="w-4 h-4" />
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
        </div>
      </div>

      {docToView && <DocumentDetailsModal doc={docToView} onClose={() => setDocToView(null)} />}

      <ConfirmDialog
        open={!!docToDelete}
        title="Xóa tri thức AI"
        description="Bạn có chắc chắn muốn xóa tài liệu này? Mọi hiểu biết (Vector data) của AI về tài liệu này sẽ bị xóa vĩnh viễn khỏi hệ thống."
        danger={true}
        onConfirm={() => deleteMut.mutate(docToDelete!)}
        onCancel={() => setDocToDelete(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function DocumentDetailsModal({ doc, onClose }: { doc: KnowledgeDocument; onClose: () => void }) {
  const { data: chunks, isLoading } = useQuery({ queryKey: ['ai-document-chunks', doc.id], queryFn: () => aiService.getDocumentChunks(doc.id).then(r => r.data.data) });

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[95vh] animate-scale-in border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center border-b border-slate-100 bg-white/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 tracking-tight max-w-md truncate" title={doc.title}>{doc.title}</h3>
              <p className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-2">
                Định dạng <span className="uppercase text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-1.5 py-0.5 rounded shadow-sm">{doc.fileType}</span> • Học vào {formatDateTime(doc.createdAt)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors border border-slate-100">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 p-8 space-y-5">
          <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2">
            Dữ liệu Vector đã lưu ({doc.chunkCount} đoạn)
          </h4>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" className="text-indigo-600" /></div>
          ) : chunks?.length === 0 ? (
            <div className="text-slate-500 text-sm font-medium text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">Chưa tải được nội dung.</div>
          ) : (
            <div className="space-y-4">
              {chunks?.map((content: string, idx: number) => (
                <div key={idx} className="bg-white border border-slate-100 p-5 md:p-6 rounded-2xl text-[13px] text-slate-700 font-medium leading-relaxed shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <div className="font-bold text-indigo-700 text-[10px] mb-3 uppercase tracking-wider flex items-center gap-1.5">
                    Chunk #{idx + 1}
                  </div>
                  {content}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shadow-sm">Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2: ĐỔI MẬT KHẨU (BẢO MẬT) - THIẾT KẾ KÉT SẮT CAO CẤP
// ─────────────────────────────────────────────────────────────
function ChangePasswordTab({ user }: { user: any }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changeMut = useMutation({
    mutationFn: () => {
      if (form.newPassword !== form.confirmPassword) throw new Error('Mật khẩu mới và xác nhận không khớp');
      if (form.newPassword.length < 8) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return authService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
    },
    onSuccess: () => { toast.success('Khóa bảo mật đã được cập nhật!'); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); },
    onError: (e: any) => { toast.error(e?.message || e?.response?.data?.message || 'Đổi mật khẩu thất bại'); },
  });

  const isValid = form.currentPassword.trim() && form.newPassword.trim() && form.confirmPassword.trim() && form.newPassword === form.confirmPassword && form.newPassword.length >= 8;
  const passwordsMatch = form.confirmPassword === '' || form.newPassword === form.confirmPassword;

  return (
    <div className="max-w-md mx-auto pt-8 md:pt-12 animate-fade-in">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
        {/* Nền trang trí */}
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
          <Shield className="w-48 h-48" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center mb-5 shadow-xl shadow-slate-900/20">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h3 className="font-extrabold text-2xl text-slate-900 tracking-tight">Bảo mật tài khoản</h3>
            <div className="flex items-center gap-1.5 mt-3 text-[13px] text-slate-500 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
              <User2 className="w-4 h-4" /> <span className="font-bold text-slate-700">{user?.username}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu hiện tại</label>
              <div className="relative group/input">
                <input type={showCurrent ? 'text' : 'password'} className="w-full pl-4 pr-12 py-3.5 bg-white shadow-sm border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="••••••••" value={form.currentPassword} onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))} />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                  {showCurrent ? <Eye className="w-5 h-5 opacity-50" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-6" />

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mật khẩu mới</label>
              <div className="relative group/input">
                <input type={showNew ? 'text' : 'password'} className="w-full pl-4 pr-12 py-3.5 bg-white shadow-sm border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="Tối thiểu 8 ký tự" value={form.newPassword} onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))} />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors">
                  {showNew ? <Eye className="w-5 h-5 opacity-50" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.newPassword && (
                <div className="mt-3.5 flex gap-1.5 items-center">
                  <div className="flex-1 flex gap-1.5 h-1.5">
                    {[...Array(4)].map((_, i) => {
                      const strength = getPasswordStrength(form.newPassword);
                      return (
                        <div key={i} className={`h-full flex-1 rounded-full transition-colors duration-300 ${i < strength ? strength === 1 ? 'bg-rose-500' : strength === 2 ? 'bg-amber-400' : strength === 3 ? 'bg-emerald-400' : 'bg-emerald-500' : 'bg-slate-100'}`} />
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-bold uppercase w-20 text-right text-slate-400">
                    {['', 'Rất Yếu', 'Yếu', 'Khá', 'Rất Mạnh'][getPasswordStrength(form.newPassword)]}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Xác nhận mật khẩu</label>
              <div className="relative group/input">
                <input type={showConfirm ? 'text' : 'password'} className={`w-full pl-4 pr-12 py-3.5 bg-white shadow-sm border rounded-xl text-sm font-bold text-slate-800 outline-none transition-all ${form.confirmPassword && !passwordsMatch ? 'border-rose-400 focus:ring-rose-500/20 bg-rose-50/30' : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}`} placeholder="Nhập lại chính xác" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
              </div>
              {form.confirmPassword && !passwordsMatch && <p className="text-rose-500 text-[11px] font-bold mt-2 flex items-center gap-1.5 uppercase tracking-wider"><X className="w-3.5 h-3.5"/> Không khớp</p>}
              {form.confirmPassword && passwordsMatch && form.newPassword && <p className="text-emerald-600 text-[11px] font-bold mt-2 flex items-center gap-1.5 uppercase tracking-wider"><CheckCircle2 className="w-3.5 h-3.5"/> Trùng khớp</p>}
            </div>
          </div>

          <button onClick={() => changeMut.mutate()} disabled={!isValid || changeMut.isPending} className="w-full mt-10 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-[0_4px_12px_rgb(0,0,0,0.1)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2">
            {changeMut.isPending ? <Spinner size="sm" className="text-white" /> : <><Shield className="w-4 h-4" /> Xác nhận đổi khóa</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}