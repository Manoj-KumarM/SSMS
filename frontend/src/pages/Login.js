import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatApiErrorDetail } from '../utils/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else if (user.role === 'student') {
        navigate('/student/dashboard');
      }
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" data-testid="login-page">
      <div
        className="hidden lg:block bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/b55e394e-fd9a-409c-9dce-86a13ebc07c3/images/e418a0c42d673191505e7439bc1f7d5ae454aaaf3fd8cc2505f022d4d89e4f11.png)'
        }}
      />
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h1 className="text-5xl font-black tracking-tight mb-2" data-testid="login-title">
              COLLEGE MANAGEMENT
            </h1>
            <p className="text-base text-zinc-600">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-widest font-bold">
                EMAIL ADDRESS
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-none border-zinc-300 focus:border-black focus:ring-1 focus:ring-black"
                data-testid="login-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-widest font-bold">
                PASSWORD
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-none border-zinc-300 focus:border-black focus:ring-1 focus:ring-black"
                data-testid="login-password-input"
              />
            </div>

            {error && (
              <div className="p-4 border border-[#FF2A2A] bg-[#FF2A2A]/5 text-[#FF2A2A] text-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider duration-150"
              data-testid="login-submit-button"
            >
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-zinc-600 hover:text-black duration-150 uppercase tracking-wider font-bold"
              data-testid="forgot-password-link"
            >
              FORGOT PASSWORD?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
