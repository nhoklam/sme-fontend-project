import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, X, UserPlus, Phone } from 'lucide-react';
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
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center sm:p-4 transition-all">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col h-[80vh] sm:h-[600px] animate-slide-up">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">Khách hàng thành viên</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-500 shadow-sm border"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto bg-white">
          {!isCreating ? (
            <>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="tel" 
                  placeholder="Nhập SĐT hoặc tên khách..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border-2 border-primary-200 rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:border-primary-500 transition-colors"
                  autoFocus
                />
                {isSearching && <Spinner size="sm" className="absolute right-4 top-1/2 -translate-y-1/2" />}
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(cust => (
                    <div 
                      key={cust.id} 
                      onClick={() => onSelect(cust)}
                      className="bg-gray-50 p-4 rounded-xl border border-gray-200 active:bg-primary-50 cursor-pointer transition-colors"
                    >
                      <p className="font-bold text-gray-800 text-base">{cust.fullName}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3"/> {cust.phoneNumber}</p>
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">Điểm: {cust.loyaltyPoints}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="text-center mt-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4 text-sm">Không tìm thấy khách hàng: <b className="text-gray-800">{searchQuery}</b></p>
                  <button 
                    onClick={() => {
                        setNewCustomerName(isNaN(Number(searchQuery)) ? searchQuery : '');
                        if(!isNaN(Number(searchQuery))) setSearchQuery(searchQuery);
                        setIsCreating(true);
                    }}
                    className="bg-primary-50 text-primary-700 border border-primary-200 px-6 py-3 rounded-xl font-bold w-full active:bg-primary-100"
                  >
                    + Thêm mới siêu tốc
                  </button>
                </div>
              ) : (
                <div className="text-center mt-12 text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nhập ít nhất 2 ký tự để tìm kiếm</p>
                </div>
              )}
            </>
          ) : (
            <div className="animate-fade-in">
              <div className="bg-primary-50 text-primary-800 p-3 rounded-lg text-sm font-medium mb-6">
                Tạo hồ sơ siêu tốc để tích điểm cho khách hàng
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Số điện thoại</label>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-50 border border-gray-200 mt-1 p-3 rounded-xl font-mono text-gray-800 font-bold focus:outline-primary-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Tên khách hàng</label>
                  <input 
                    type="text" 
                    placeholder="Ví dụ: Anh Tuấn" 
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full border-2 border-primary-200 mt-1 p-3 rounded-xl text-lg font-bold focus:outline-none focus:border-primary-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setIsCreating(false)} className="flex-1 py-3.5 bg-gray-100 rounded-xl font-bold text-gray-600 active:bg-gray-200">Quay lại</button>
                <button onClick={handleCreateNew} disabled={createMut.isPending} className="flex-[2] py-3.5 bg-primary-600 rounded-xl font-bold text-white active:bg-primary-700 shadow-md">
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