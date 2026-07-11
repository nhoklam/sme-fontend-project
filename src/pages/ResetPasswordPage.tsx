import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { getErrorMessage } from '@/lib/utils';

const schema = z.object({
  newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword: data.newPassword });
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-white md:bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white md:rounded-[32px] md:shadow-2xl md:border border-slate-100 p-10 text-center animate-fade-in">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">Liên kết không hợp lệ</h2>
          <p className="text-sm text-slate-500 mb-6">Liên kết đặt lại mật khẩu bị thiếu hoặc không đúng định dạng.</p>
          <Link to="/forgot-password" className="text-indigo-600 font-bold text-sm hover:underline">
            Yêu cầu liên kết mới
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white md:rounded-[32px] md:shadow-2xl md:border border-slate-100 p-8 sm:p-10 animate-fade-in">
        <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
          <KeyRound className="w-7 h-7 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">Đặt mật khẩu mới</h2>
        <p className="text-sm font-medium text-slate-500 mb-8">Nhập mật khẩu mới cho tài khoản của bạn.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Mật khẩu mới</label>
            <div className="relative">
              <input
                {...register('newPassword')}
                type={showPwd ? 'text' : 'password'}
                className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white block p-4 pr-14 transition-all outline-none ${
                  errors.newPassword ? 'border-rose-500 bg-rose-50/50' : ''
                }`}
                placeholder="••••••••"
                autoFocus
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-slate-400 hover:text-indigo-600" tabIndex={-1}>
                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.newPassword && <span className="text-rose-500 text-xs font-bold mt-2 block pl-1">{errors.newPassword.message}</span>}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Xác nhận mật khẩu</label>
            <input
              {...register('confirmPassword')}
              type={showPwd ? 'text' : 'password'}
              className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white block p-4 transition-all outline-none ${
                errors.confirmPassword ? 'border-rose-500 bg-rose-50/50' : ''
              }`}
              placeholder="••••••••"
            />
            {errors.confirmPassword && <span className="text-rose-500 text-xs font-bold mt-2 block pl-1">{errors.confirmPassword.message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[16px] px-5 py-4 rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(79,70,229,0.4)] flex items-center justify-center disabled:opacity-70 mt-4"
          >
            {loading ? (<><Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang xử lý...</>) : 'Đặt lại mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}