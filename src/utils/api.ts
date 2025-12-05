// Centralized API configuration
// Use relative URL in production (nginx proxy), localhost in development
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:5000')

