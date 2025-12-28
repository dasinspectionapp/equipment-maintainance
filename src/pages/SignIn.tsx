import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import { useTheme } from '../context/ThemeContext';

export default function SignIn() {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (token && storedUser) {
        try {
          JSON.parse(storedUser);
          setIsLoading(false);
          // Redirect to dashboard if user is authenticated
          navigate('/dashboard');
          return;
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
    
    // Listen for custom login event
    const handleLogin = () => {
      checkAuth();
    };
    
    window.addEventListener('userLogin', handleLogin);
    
    return () => {
      window.removeEventListener('userLogin', handleLogin);
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.background }}>
        <div className="text-xl" style={{ color: theme.text }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ backgroundColor: theme.background }}>
      {/* Electrical Power System Network/Grid/Distribution Background Image */}
      <div className="absolute inset-0 overflow-hidden bg-cover bg-center bg-no-repeat" 
           style={{
             backgroundImage: 'url(https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&h=1080&fit=crop)',
             opacity: isDark ? 0.2 : 0.4
           }}>
      </div>
      
      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center transition-colors relative z-20"
          style={{ color: theme.text }}
          onMouseEnter={(e) => e.currentTarget.style.color = theme.primary}
          onMouseLeave={(e) => e.currentTarget.style.color = theme.text}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>
        <LoginForm />
      </div>
    </div>
  );
}
