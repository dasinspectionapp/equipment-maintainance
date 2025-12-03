import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to?: string; // Optional target path, defaults to /dashboard
  label?: string; // Optional button label, defaults to "Back to Dashboard"
}

export default function BackButton({ to = '/dashboard', label = 'Back to Dashboard' }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm mb-4"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>{label}</span>
    </button>
  );
}









