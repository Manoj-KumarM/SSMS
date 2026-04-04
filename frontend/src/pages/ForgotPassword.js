import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../contexts/AuthContext';
import { formatApiErrorDetail } from '../utils/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/auth/forgot-password', { email });
      if (data.code_hint) {
        setSuccess(`Reset code: ${data.code_hint} (Email not configured - code shown directly)`);
        setCode(data.code_hint);
      } else {
        setSuccess('Reset code sent to your email');
      }
      setStep(2);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/api/auth/reset-password', {
        code,
        new_password: newPassword
      });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-zinc-50" data-testid="forgot-password-page">
      <div className="w-full max-w-md bg-white border border-zinc-200 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black tracking-tight mb-2" data-testid="forgot-password-title">
            RESET PASSWORD
          </h1>
          <p className="text-base text-zinc-600">
            {step === 1 ? 'Enter your email to receive a reset code' : 'Enter the code and your new password'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="space-y-6" data-testid="send-code-form">
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
                data-testid="email-input"
              />
            </div>

            {error && (
              <div className="p-4 border border-[#FF2A2A] bg-[#FF2A2A]/5 text-[#FF2A2A] text-sm" data-testid="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 border border-black bg-black/5 text-black text-sm" data-testid="success-message">
                {success}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider duration-150"
              data-testid="send-code-button"
            >
              {loading ? 'SENDING...' : 'SEND CODE'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6" data-testid="reset-password-form">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-xs uppercase tracking-widest font-bold">
                RESET CODE
              </Label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="rounded-none border-zinc-300 focus:border-black focus:ring-1 focus:ring-black"
                data-testid="code-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs uppercase tracking-widest font-bold">
                NEW PASSWORD
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="rounded-none border-zinc-300 focus:border-black focus:ring-1 focus:ring-black"
                data-testid="new-password-input"
              />
            </div>

            {error && (
              <div className="p-4 border border-[#FF2A2A] bg-[#FF2A2A]/5 text-[#FF2A2A] text-sm" data-testid="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 border border-black bg-black/5 text-black text-sm" data-testid="success-message">
                {success}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#002FA7] hover:bg-[#00227A] text-white rounded-none h-12 font-bold uppercase tracking-wider duration-150"
              data-testid="reset-password-button"
            >
              {loading ? 'RESETTING...' : 'RESET PASSWORD'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-zinc-600 hover:text-black duration-150 uppercase tracking-wider font-bold"
            data-testid="back-to-login-link"
          >
            BACK TO LOGIN
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
