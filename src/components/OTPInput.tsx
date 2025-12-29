import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface OTPInputProps {
  onComplete: (otp: string) => void;
  length?: number;
  disabled?: boolean;
}

export default function OTPInput({ onComplete, length = 6, disabled = false }: OTPInputProps) {
  const { theme } = useTheme();
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input if value entered
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all inputs are filled
    if (newOtp.every(digit => digit !== '')) {
      const otpString = newOtp.join('');
      onComplete(otpString);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, length).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < length) {
            newOtp[i] = digit;
          }
        });
        setOtp(newOtp);
        const otpString = newOtp.join('');
        if (otpString.length === length) {
          onComplete(otpString);
        } else {
          inputRefs.current[digits.length]?.focus();
        }
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, length).split('');
    const newOtp = [...otp];
    digits.forEach((digit, i) => {
      if (i < length) {
        newOtp[i] = digit;
      }
    });
    setOtp(newOtp);
    const otpString = newOtp.join('');
    if (otpString.length === length) {
      onComplete(otpString);
    } else {
      inputRefs.current[digits.length]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:ring-2 focus:border-transparent transition-all"
          style={{
            backgroundColor: theme.inputBackground,
            borderColor: digit ? theme.primary : theme.inputBorder,
            color: theme.text,
            outlineColor: theme.primary,
          }}
        />
      ))}
    </div>
  );
}

