import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, X, UserPlus, Phone, Users } from 'lucide-react';
import { customerService } from '@/services/customer.service';
import { Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import type { Customer } from '@/types';

interface CustomerSelectModalProps {
  onSelect: (customer: Customer) => void;
  onClose: () => void;
}

export default function CustomerSelectModal({ onSelect, onClose }: CustomerSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const fetchCustomers = async () => {
      setIsSearching(true);
      try {
        const res = await customerService.getAll({ keyword: debouncedSearch, size: 5 });
        setSearchResults(res.data.data.content || res.data.data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    };
    fetchCustomers();
  }, [debouncedSearch]);

  const createMut = useMutation({
    mutationFn: (data: { fullName: string; phoneNumber: string }) => customerService.create(data).then(r => r.data.data),
    onSuccess: (cust) => {
      toast.success('Tạo khách hàng thành công!');
      onSelect(cust);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Lỗi tạo khách hàng');
    }
  });

  const handleCreateNew = () => {
    if (!newCustomerName.trim() || !searchQuery.trim()) {
      toast.error("Vui lòng nhập tên và SĐT");
      return;
    }
    createMut.mutate({ fullName: newCustomerName.trim(), phoneNumber: searchQuery.trim() });
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 transition-all">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col h-[85vh] sm:h-[650px] animate-slide-up sm:animate-scale-in shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* ── HEADER ── */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Khách hàng thành viên</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors border border-slate-100">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          {!isCreating ? (
            <>
              {/* Search Box */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="tel" 
                  placeholder="Nhập Số điện thoại hoặc Tên..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-12 py-3.5 text-[15px] font-medium text-slate-900 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  autoFocus
                />
                {isSearching && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" />}
              </div>

              {/* Results */}
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kết quả tìm kiếm</p>
                  {searchResults.map(cust => (
                    <div 
                      key={cust.id} 
                      onClick={() => onSelect(cust)}
                      className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all group shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
                    >
                      <p className="font-extrabold text-slate-800 text-[15px] group-hover:text-indigo-700 transition-colors">{cust.fullName}</p>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-sm font-mono font-semibold text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                          <Phone className="w-3.5 h-3.5 text-slate-400"/> {cust.phoneNumber}
                        </p>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/60 shadow-sm">
                          Điểm: <span className="text-[13px]">{cust.loyaltyPoints}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="text-center mt-10">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100/50 shadow-sm">
                    <UserPlus className="w-8 h-8 text-indigo-500" />
                  </div>
                  <p className="text-slate-500 mb-5 text-[15px] font-medium">Không tìm thấy thông tin cho: <br/><b className="text-slate-900 text-lg block mt-1">{searchQuery}</b></p>
                  <button 
                    onClick={() => {
                        setNewCustomerName(isNaN(Number(searchQuery)) ? searchQuery : '');
                        if(!isNaN(Number(searchQuery))) setSearchQuery(searchQuery);
                        setIsCreating(true);
                    }}
                    className="bg-white text-indigo-600 border-2 border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50 px-6 py-3.5 rounded-2xl font-bold w-full transition-all shadow-sm"
                  >
                    + Đăng ký thẻ thành viên mới
                  </button>
                </div>
              ) : (
                <div className="text-center mt-16 text-slate-400 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium">Nhập ít nhất 2 ký tự để tìm kiếm</p>
                </div>
              )}
            </>
          ) : (
            <div className="animate-fade-in">
              <div className="bg-indigo-50/50 border border-indigo-100 text-indigo-800 p-4 rounded-2xl text-sm font-medium mb-6 shadow-sm leading-relaxed">
                Tạo hồ sơ siêu tốc để <b className="text-indigo-900">tích điểm ngay</b> cho khách hàng trong đơn hàng này.
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Số điện thoại</label>
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl font-mono text-[15px] text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Tên khách hàng</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Anh Tuấn" 
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-[15px] text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsCreating(false)} className="flex-1 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                  Quay lại
                </button>
                <button onClick={handleCreateNew} disabled={createMut.isPending} className="flex-[2] py-3.5 bg-indigo-600 rounded-xl font-bold text-white hover:bg-indigo-700 shadow-[0_4px_12px_rgb(99,102,241,0.3)] transition-all flex items-center justify-center">
                  {createMut.isPending ? <Spinner size="sm" className="text-white" /> : 'Lưu & Áp dụng'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}