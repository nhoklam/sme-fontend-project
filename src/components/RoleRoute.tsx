
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Trước đây KHÔNG có lớp chặn nào ở tầng route - chỉ Sidebar ẩn link đi, còn
 * nếu Cashier tự gõ thẳng URL (vd. /finance) thì AppLayout vẫn render trang đó,
 * và chỉ "vỡ" khi gọi API rồi nhận 403 từ backend (UX xấu: loading xong rồi
 * báo lỗi lung tung). Backend của bạn không hề bị lộ dữ liệu vì
 * SecurityConfig + @PreAuthorize đã chặn đúng - đây là vá lỗ ở tầng UI, không
 * phải vá lỗ bảo mật dữ liệu.
 */
export default function RoleRoute({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const role = useAuthStore((s) => s.user?.role ?? '');

  if (!roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
