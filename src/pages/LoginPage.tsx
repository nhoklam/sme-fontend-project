import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShoppingCart, Loader2, Sparkles, Store } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

const schema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authService.login(data);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success(`Chào mừng, ${user.fullName}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    // Nền trắng trên Mobile để tạo cảm giác Native App, nền Slate-50 trên Desktop
    <div className="min-h-screen bg-white md:bg-slate-50 flex items-center justify-center p-0 md:p-8 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ── BACKGROUND BLOB DECORATIONS (Chỉ hiện trên Desktop) ── */}
      <div className="hidden md:block absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-300/30 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>
      <div className="hidden md:block absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-[100px] mix-blend-multiply pointer-events-none"></div>

      {/* ── MAIN CARD: Tràn viền trên Mobile, dạng thẻ trên Desktop ── */}
      <div className="w-full h-screen md:h-auto max-w-[1000px] bg-white md:rounded-[32px] md:shadow-2xl border-0 md:border border-slate-100 flex flex-col md:flex-row overflow-hidden z-10 animate-fade-in relative">
        
        {/* Lớp nền gradient mờ ở trên cùng dành cho Mobile */}
        <div className="md:hidden absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-indigo-50/80 to-white pointer-events-none"></div>

        {/* ── TRÁI: BRANDING PANEL (Ẩn trên Mobile) ── */}
        <div className="hidden md:flex w-1/2 bg-indigo-600 p-12 flex-col justify-between relative overflow-hidden">
          
          {/* Các vòng sáng trang trí bên trong thẻ Indigo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-900/40 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-8 backdrop-blur-md border border-white/20 shadow-xl">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-tight mb-4">
              SME ERP & POS <br/> Hệ thống Quản trị
            </h1>
            <p className="text-indigo-100/90 font-medium leading-relaxed max-w-sm text-[15px]">
              Giải pháp quản lý bán hàng đa kênh toàn diện, thanh lịch và tối ưu hiệu suất cho doanh nghiệp của bạn.
            </p>
          </div>

          {/* Social Proof / Trust Badge */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mt-12 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex -space-x-3">
                <div className="w-9 h-9 rounded-full bg-emerald-400 border-2 border-indigo-600 flex items-center justify-center text-white"><Sparkles className="w-4 h-4"/></div>
                <div className="w-9 h-9 rounded-full bg-amber-400 border-2 border-indigo-600 flex items-center justify-center text-white font-bold text-xs">+1k</div>
              </div>
              <p className="text-xs font-bold text-white tracking-widest uppercase opacity-90">Được tin dùng</p>
            </div>
            <p className="text-sm text-indigo-100/90 font-medium leading-relaxed">
              Bởi hơn 1,000+ cửa hàng bán lẻ và siêu thị trên toàn quốc.
            </p>
          </div>
        </div>

        {/* ── PHẢI: FORM ĐĂNG NHẬP ── */}
        <div className="w-full md:w-1/2 p-6 sm:p-12 md:p-14 flex flex-col justify-center min-h-screen md:min-h-0 relative z-10">
          
          {/* Logo & Header hiển thị riêng cho Mobile */}
          <div className="md:hidden flex flex-col items-center mb-10 pt-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-[20px] flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-5">
              <Store className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">SME ERP</h1>
            <p className="text-sm font-bold text-slate-500 mt-1.5 uppercase tracking-wider">Hệ thống quản trị</p>
          </div>

          {/* Header hiển thị trên Desktop */}
          <div className="hidden md:block mb-10 text-left">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Chào mừng trở lại 👋</h2>
            <p className="text-sm font-medium text-slate-500 mt-2">Vui lòng đăng nhập để truy cập vào hệ thống.</p>
          </div>
          
          {/* Header nhỏ cho Mobile sát Form */}
          <div className="md:hidden mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Đăng nhập 👋</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Chào mừng bạn quay lại hệ thống.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Tên đăng nhập</label>
              <input
                {...register('username')}
                className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white block p-4 transition-all outline-none ${
                  errors.username ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/50 text-rose-900' : ''
                }`}
                placeholder="Ví dụ: admin"
                autoComplete="username"
                autoFocus
              />
              {errors.username && (
                <span className="text-rose-500 text-xs font-bold mt-2 block animate-fade-in pl-1">{errors.username.message}</span>
              )}
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-slate-700">Mật khẩu</label>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white block p-4 pr-14 transition-all outline-none ${
                    errors.password ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/50 text-rose-900' : ''
                  }`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                {/* Vùng chạm (Touch Target) của nút bật mật khẩu được làm lớn hơn (w-14) để dễ bấm trên điện thoại */}
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors outline-none"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <span className="text-rose-500 text-xs font-bold mt-2 block animate-fade-in pl-1">{errors.password.message}</span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[16px] px-5 py-4 rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(79,70,229,0.4)] hover:shadow-[0_10px_25px_-6px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 flex items-center justify-center mt-6 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang xác thực...</>
              ) : 'Đăng nhập vào hệ thống'}
            </button>
          </form>

          {/* Development Hint Footer */}
          <div className="mt-10 md:mt-12 pt-6 border-t border-slate-100 text-center md:text-left">
            <p className="text-[13px] font-medium text-slate-500 flex flex-wrap items-center justify-center md:justify-start gap-2 leading-relaxed">
              
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}