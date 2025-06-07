import React, { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const OTPVerification = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, success, error
  const [errorMessage, setErrorMessage] = useState('');
  
  const inputRefs = useRef([]);
  const email = "user@example.com"; // This would come from props or context

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Prevent multiple characters
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setStatus('idle');
    setErrorMessage('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      handleVerifyOtp(pastedData);
    }
  };

  const handleVerifyOtp = async (otpCode) => {
    setIsLoading(true);
    setStatus('idle');
    
    try {
      // Simulate API call - replace with actual OTP verification
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success/error based on OTP
      if (otpCode === '123456') {
        setStatus('success');
        setTimeout(() => {
          // Redirect to dashboard or next step
          alert('OTP verified successfully! Redirecting...');
        }, 1500);
      } else {
        throw new Error('Kode OTP tidak valid');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    
    setIsLoading(true);
    try {
      // Simulate resend API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCanResend(false);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      setStatus('idle');
      setErrorMessage('');
      inputRefs.current[0]?.focus();
    } catch (error) {
      setErrorMessage('Gagal mengirim ulang kode OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Kembali
          </button>
          
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Verifikasi OTP
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed px-4">
            Masukkan kode 6 digit yang telah dikirim ke
            <span className="block font-semibold text-gray-900 mt-1">
              {email}
            </span>
          </p>
        </div>

        {/* OTP Input Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex justify-center space-x-3 mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="number"
                inputMode="numeric"
                maxLength="1"
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isLoading}
                className={`
                  w-12 h-12 text-center text-xl font-bold rounded-xl border-2 
                  transition-all duration-200 focus:outline-none
                  ${status === 'error' 
                    ? 'border-red-300 bg-red-50 text-red-600' 
                    : status === 'success'
                    ? 'border-green-300 bg-green-50 text-green-600'
                    : digit 
                    ? 'border-blue-400 bg-blue-50 text-blue-600' 
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  focus:border-blue-500 focus:bg-blue-50 focus:shadow-lg
                `}
                style={{ 
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield'
                }}
              />
            ))}
          </div>

          {/* Status Messages */}
          {status === 'success' && (
            <div className="flex items-center justify-center text-green-600 mb-4">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Kode OTP berhasil diverifikasi!</span>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="flex items-center justify-center text-red-600 mb-4">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {/* Manual Verify Button (shows when OTP is complete but not auto-submitted) */}
          {otp.every(digit => digit !== '') && status === 'idle' && !isLoading && (
            <button
              onClick={() => handleVerifyOtp(otp.join(''))}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors mb-4"
            >
              Verifikasi Kode
            </button>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center text-blue-600 mb-4">
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              <span className="text-sm">Memverifikasi...</span>
            </div>
          )}
        </div>

        {/* Resend Section */}
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-3">
            Tidak menerima kode?
          </p>
          
          {canResend ? (
            <button
              onClick={handleResendOtp}
              disabled={isLoading}
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors disabled:opacity-50"
            >
              Kirim Ulang Kode
            </button>
          ) : (
            <div className="text-gray-500 text-sm">
              Kirim ulang dalam{' '}
              <span className="font-mono font-semibold text-blue-600">
                {formatTime(countdown)}
              </span>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 leading-relaxed px-4">
            Pastikan Anda memeriksa folder spam jika tidak menerima email. 
            Kode OTP berlaku selama 10 menit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;