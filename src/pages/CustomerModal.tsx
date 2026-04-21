import React, { useState, useEffect } from 'react';
import { X, UserSquare2, Save } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { customerService } from '@/services/customer.service';
import { Spinner } from '@/components/ui';
import toast from 'react-hot-toast';
import type { Customer } from '@/types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Customer>) => Promise<void>;
  customerId?: string | null; 
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customerId,
}) => {
  const isEdit = !!customerId;

  const { data: freshCustomer, isLoading: loadingFresh } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: () => customerService.getById(customerId!).then(r => r.data.data),
    enabled: isEdit && isOpen, 
  });

  const [formData, setFormData] = useState<Partial<Customer>>({
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
    dateOfBirth: '',
    gender: 'OTHER',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && freshCustomer) {
      setFormData({
        ...freshCustomer,
        dateOfBirth: freshCustomer.dateOfBirth
          ? new Date(freshCustomer.dateOfBirth).toISOString().split('T')[0]
          : '',
      });
    } else if (!isEdit && isOpen) {
      setFormData({
        fullName: '', phoneNumber: '', email: '', address: '',
        dateOfBirth: '', gender: 'OTHER', notes: '',
      });
    }
  }, [freshCustomer, isEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose(); 
    } catch (error: any) {
      console.error('Lỗi khi lưu khách hàng', error);
      const errorMessage = error?.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin khách hàng. Vui lòng thử lại!';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-in border border-slate-100">
        
        {/* ── HEADER ── */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
              <UserSquare2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {isEdit ? 'Cập nhật thông tin Khách hàng' : 'Thêm Khách hàng mới'}
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {isEdit ? 'Chỉnh sửa thông tin liên hệ và cá nhân' : 'Tạo hồ sơ thành viên mới cho hệ thống'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── BODY ── */}
        {isEdit && loadingFresh ? (
          <div className="flex-1 flex flex-col justify-center items-center py-20 bg-slate-50/30">
            <Spinner size="lg" className="text-indigo-600 mb-4" />
            <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Tên khách hàng */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Tên khách hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required type="text" name="fullName"
                    value={formData.fullName || ''} onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    placeholder="VD: Nguyễn Văn A" autoFocus={!isEdit}
                  />
                </div>
                
                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Số điện thoại <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required type="tel" name="phoneNumber"
                    value={formData.phoneNumber || ''} onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm font-mono font-bold tracking-wider rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                    placeholder="0987 654 321"
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email liên hệ</label>
                  <input 
                    type="email" name="email" 
                    value={formData.email || ''} onChange={handleChange} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                    placeholder="email@domain.com" 
                  />
                </div>
                
                {/* Ngày sinh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ngày sinh</label>
                  <input 
                    type="date" name="dateOfBirth" 
                    value={formData.dateOfBirth || ''} onChange={handleChange} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm uppercase" 
                  />
                </div>
                
                {/* Giới tính */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Giới tính</label>
                  <div className="flex gap-4">
                    {['MALE', 'FEMALE', 'OTHER'].map((g) => (
                      <label key={g} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-xl cursor-pointer transition-all ${
                        formData.gender === g 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                      }`}>
                        <input 
                          type="radio" name="gender" value={g} 
                          checked={formData.gender === g} onChange={handleChange} 
                          className="hidden"
                        />
                        {g === 'MALE' ? 'Nam' : g === 'FEMALE' ? 'Nữ' : 'Khác'}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Địa chỉ */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Địa chỉ hiện tại</label>
                  <input 
                    type="text" name="address" 
                    value={formData.address || ''} onChange={handleChange} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                    placeholder="Số nhà, Phố, Quận/Huyện, Tỉnh/TP" 
                  />
                </div>
                
                {/* Ghi chú */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ghi chú nội bộ</label>
                  <textarea 
                    name="notes" 
                    value={formData.notes || ''} onChange={handleChange} 
                    rows={3} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm resize-none custom-scrollbar" 
                    placeholder="Ghi chú về thói quen mua hàng, sở thích..."
                  ></textarea>
                </div>
              </div>
            </div>
            
            {/* ── FOOTER ACTIONS ── */}
            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-4 shrink-0 rounded-b-3xl">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isSubmitting} 
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting || !formData.fullName || !formData.phoneNumber} 
                className="flex items-center justify-center min-w-[140px] px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgb(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                {isSubmitting ? <Spinner size="sm" className="text-white" /> : <><Save className="w-4 h-4 mr-2"/> {isEdit ? 'Lưu thay đổi' : 'Thêm mới'}</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};