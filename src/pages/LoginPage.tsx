import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ShoppingCart, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SME ERP & POS</h1>
          <p className="text-primary-300 mt-1 text-sm">Hệ thống quản lý bán hàng đa kênh</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Đăng nhập</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div>
              <label className="label">Tên đăng nhập</label>
              <input
                {...register('username')}
                className={errors.username ? 'input-error' : 'input'}
                placeholder="admin"
                autoComplete="username"
                autoFocus
              />
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label">Mật khẩu</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  className={`${errors.password ? 'input-error' : 'input'} pr-10`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Đang đăng nhập...</>
              ) : 'Đăng nhập'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Tài khoản mặc định: <span className="font-mono">admin</span> / <span className="font-mono">Admin@123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
