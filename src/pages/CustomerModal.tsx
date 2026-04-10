import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { customerService } from '@/services/customer.service';
import { Spinner } from '@/components/ui';
import type { Customer } from '@/types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Customer>) => Promise<void>;
  customerId?: string | null; // ĐÃ SỬA: Nhận ID thay vì toàn bộ object Customer
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customerId,
}) => {
  const isEdit = !!customerId;

  // ĐÃ NÂNG CẤP: Lấy dữ liệu mới nhất từ Server khi mở Modal ở chế độ Sửa
  const { data: freshCustomer, isLoading: loadingFresh } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: () => customerService.getById(customerId!).then(r => r.data.data),
    enabled: isEdit && isOpen, // Chỉ gọi API khi có ID và Modal đang mở
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

  // Đổ dữ liệu vào Form khi Fresh Data tải xong
  useEffect(() => {
    if (isEdit && freshCustomer) {
      setFormData({
        ...freshCustomer,
        // Chuyển đổi định dạng ngày sinh để hiển thị đúng trên thẻ input type="date"
        dateOfBirth: freshCustomer.dateOfBirth
          ? new Date(freshCustomer.dateOfBirth).toISOString().split('T')[0]
          : '',
      });
    } else if (!isEdit && isOpen) {
      // Reset form khi Thêm mới
      setFormData({
        fullName: '',
        phoneNumber: '',
        email: '',
        address: '',
        dateOfBirth: '',
        gender: 'OTHER',
        notes: '',
      });
    }
  }, [freshCustomer, isEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose(); // Đóng modal khi lưu thành công
    } catch (error) {
      console.error('Lỗi khi lưu khách hàng', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Cập nhật thông tin Khách hàng' : 'Thêm Khách hàng mới'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 bg-gray-100 p-1.5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hiển thị Spinner chờ gọi API lấy Fresh Data */}
        {isEdit && loadingFresh ? (
          <div className="flex-1 flex justify-center items-center p-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Tên khách hàng */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên khách hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    name="fullName"
                    value={formData.fullName || ''}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nguyễn Văn A"
                    autoFocus={!isEdit}
                  />
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber || ''}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0987654321"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="email@example.com"
                  />
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth || ''}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Giới tính */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
                  <select
                    name="gender"
                    value={formData.gender || 'OTHER'}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>

                {/* Địa chỉ */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Số nhà, Đường, Quận/Huyện, Tỉnh/TP"
                  />
                </div>

                {/* Ghi chú */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú nội bộ</label>
                  <textarea
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="Ghi chú thêm về sở thích, thói quen của khách hàng..."
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn-secondary min-w-[100px]"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.fullName || !formData.phoneNumber}
                className="btn-primary min-w-[120px] flex justify-center"
              >
                {isSubmitting ? <Spinner size="sm" /> : (isEdit ? 'Lưu thay đổi' : 'Thêm mới')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};