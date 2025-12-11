
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../utils/api'

export default function LoginForm() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    application: '',
  });
  const [errors, setErrors] = useState({
    userId: '',
    password: '',
    application: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const applications = [
    { value: '', label: 'Select Application' },
    { value: 'equipment-maintenance', label: 'Equipment Maintenance' },
    { value: 'equipment-survey', label: 'Equipment Survey' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setLoginError('');
  };

  const validateForm = () => {
    const newErrors = {
      userId: '',
      password: '',
      application: '',
    };

    if (!formData.userId.trim()) {
      newErrors.userId = 'User ID is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Application is not mandatory for Admin role
    // Validation for non-Admin users will happen after login response
    // if (!formData.application) {
    //   newErrors.application = 'Please select an application';
    // }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: formData.userId,
          password: formData.password,
          application: formData.application
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Validate application for non-Admin users
      if (data.user && data.user.role !== 'Admin' && !formData.application) {
        setErrors(prev => ({
          ...prev,
          application: 'Please select an application'
        }));
        setLoginError('Application selection is required for non-Admin users');
        setIsLoading(false);
        return;
      }

      // Store token and user data in localStorage
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        // Store selected application for dashboard routing
        if (formData.application) {
          localStorage.setItem('selectedApplication', formData.application);
        }
      }

      console.log('Login successful:', data);
      
      // Set login error to empty
      setLoginError('');
      
      // Redirect based on role
      const userRole = data.user?.role || '';
      if (userRole === 'CCR' || userRole.toLowerCase() === 'ccr') {
        // Redirect CCR role directly to Equipment Dashboard
        window.location.href = '/dashboard/equipment-dashboard';
      } else {
        // Redirect other roles to default dashboard
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Login Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-electrical-blue text-center">
            Sign In
          </h2>
          <p className="text-center text-gray-600 mt-2">
            Distribution Automation System
          </p>
        </div>

        {/* Error Message */}
        {loginError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* User ID Field */}
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="text"
              id="userId"
              name="userId"
              value={formData.userId}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent transition-all ${
                errors.userId ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your user ID"
            />
            {errors.userId && (
              <p className="mt-1 text-sm text-red-600">{errors.userId}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent transition-all pr-12 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-electrical-blue transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          {/* Application Dropdown */}
          <div>
            <label htmlFor="application" className="block text-sm font-medium text-gray-700 mb-2">
              Application <span className="text-gray-500 text-xs font-normal">(Required for non-Admin users)</span>
            </label>
            <select
              id="application"
              name="application"
              value={formData.application}
              onChange={handleChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent transition-all appearance-none bg-white ${
                errors.application ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {applications.map(app => (
                <option key={app.value} value={app.value}>
                  {app.label}
                </option>
              ))}
            </select>
            {errors.application && (
              <p className="mt-1 text-sm text-red-600">{errors.application}</p>
            )}
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <a
              href="/forgot-password"
              className="text-sm text-electrical-blue hover:text-electrical-blue-dark transition-colors"
            >
              Forgot Password?
            </a>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-electrical-blue hover:bg-electrical-blue-dark text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Sign Up Button */}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="w-full border-2 border-electrical-blue text-electrical-blue hover:bg-electrical-blue hover:text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign Up
          </button>
        </form>

        {/* Footer Text */}
        <p className="mt-6 text-center text-sm text-gray-500">
          © 2024 BESCOM. All rights reserved.
        </p>
      </div>
    </div>
  );
}

