import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { MailCheck, Loader2, ArrowLeft } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { getErrorMessage } from '@/lib/utils';

const schema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authService.forgotPassword(data);
      setSent(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white md:bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white md:rounded-[32px] md:shadow-2xl md:border border-slate-100 p-8 sm:p-10">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
        </Link>

        {sent ? (
          <div className="text-center py-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <MailCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Kiểm tra email của bạn</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Nếu email này tồn tại trong hệ thống, chúng tôi đã gửi một liên kết đặt lại mật khẩu.
              Liên kết có hiệu lực trong 15 phút.
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">Quên mật khẩu?</h2>
            <p className="text-sm font-medium text-slate-500 mb-8">
              Nhập email đã đăng ký, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  className={`w-full bg-slate-50 border border-slate-200 text-slate-900 text-[15px] font-medium rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white block p-4 transition-all outline-none ${
                    errors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/50' : ''
                  }`}
                  placeholder="ban@congty.com"
                  autoFocus
                />
                {errors.email && (
                  <span className="text-rose-500 text-xs font-bold mt-2 block pl-1">{errors.email.message}</span>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[16px] px-5 py-4 rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(79,70,229,0.4)] flex items-center justify-center disabled:opacity-70"
              >
                {loading ? (<><Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang gửi...</>) : 'Gửi liên kết đặt lại'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}