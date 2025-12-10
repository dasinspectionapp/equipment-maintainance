import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// Default logo path - Vite serves files from public folder at root
const DEFAULT_LOGO = '/bescom-logo.svg'

type NavItem = {
  label: string
  href?: string
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About DAS', href: '#about' },
  { label: 'Projects', href: '#updates' },
  { label: 'Resources', href: '/resources' },
  { label: 'Contact', href: '#contact' },
  { label: 'Sign In', href: '/signin' },
]

// Use relative URL in production (nginx proxy), localhost in development
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:5000')

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function fetchLogo() {
      try {
        // First try to get logo from Admin Uploads (same as DashboardLayout)
        // Try with token if available (for authenticated users)
        const token = localStorage.getItem('token')
        const logoUrl = API_BASE ? `${API_BASE}/api/admin/uploads/logo` : '/api/admin/uploads/logo'
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const response = await fetch(logoUrl, {
          signal: controller.signal,
          headers,
        })
        
        if (response.ok) {
          // If the API returns the image directly, create a blob URL
          const blob = await response.blob()
          const imageUrl = URL.createObjectURL(blob)
          if (active) {
            setLogoSrc(imageUrl)
          }
          return
        }

        // Fallback: Try landing/branding endpoint (doesn't require auth)
        const apiUrl = API_BASE ? `${API_BASE}/api/landing/branding` : '/api/landing/branding'
        const brandingResponse = await fetch(apiUrl, {
          signal: controller.signal,
        })
        if (!brandingResponse.ok) {
          if (active) {
            setLogoSrc(DEFAULT_LOGO)
          }
          return
        }
        const data = await brandingResponse.json()
        if (!active || !data?.success) {
          if (active) {
            setLogoSrc(DEFAULT_LOGO)
          }
          return
        }
        const candidate: string | undefined = data.logoUrl || data.logoPath
        if (candidate && active) {
          // If it's already a full URL, use it as-is
          if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
            setLogoSrc(candidate)
          } else {
            // If it's a relative path, check if it starts with /
            const normalizedPath = candidate.startsWith('/') ? candidate : `/${candidate}`
            // In production, API_BASE is empty, so use relative path
            // In development, prepend API_BASE
            const normalized = API_BASE 
              ? `${API_BASE}${normalizedPath}`
              : normalizedPath
            setLogoSrc(normalized)
          }
        } else if (active) {
          setLogoSrc(DEFAULT_LOGO)
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Unable to load branding logo', error)
        }
        // Ensure fallback to static logo on error
        if (active) {
          setLogoSrc(DEFAULT_LOGO)
        }
      }
    }

    fetchLogo()

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 text-slate-900">
      <TopBar />

      <div className={`border-b border-slate-200 bg-white/95 transition-all duration-300 ${isScrolled ? 'shadow-md' : ''}`}>
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Branding logoSrc={logoSrc} />
          <div className="hidden items-center gap-6 text-sm text-slate-600 lg:flex">
            <span className="text-base font-semibold text-[#005aa9]">Distribution Automation System</span>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 lg:hidden"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <svg
              className="h-5 w-5 text-slate-700"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {isMobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`border-b border-[#004178] bg-[#005aa9] text-white transition-all duration-300 ${
          isScrolled ? 'shadow-[0_6px_12px_rgba(0,0,0,0.12)]' : ''
        }`}
      >
        <div className="container mx-auto hidden h-12 items-center justify-end gap-1 px-4 sm:px-6 lg:flex lg:px-8">
          {navItems.map((item) => {
            // Use regular anchor for hash links, Link for routes
            const isHashLink = item.href?.startsWith('#');
            const handleClick = (e: React.MouseEvent) => {
              if (isHashLink && item.href) {
                e.preventDefault();
                const element = document.querySelector(item.href);
                if (element) {
                  const headerOffset = 200; // Account for fixed header
                  const elementPosition = element.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                  });
                }
              }
            };

            return isHashLink ? (
              <a
                key={item.label}
                href={item.href || '#'}
                onClick={handleClick}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.href || '#'}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex h-12 items-center justify-between px-4 text-sm font-semibold uppercase tracking-wide lg:hidden">
          <span className="text-white/80">Navigation</span>
          <span className="text-white/60">{isMobileOpen ? 'Close' : 'Menu'}</span>
        </div>
      </div>

      {isMobileOpen && (
        <div className="border-b border-[#003768] bg-[#003b73] text-white lg:hidden">
          <div className="container mx-auto space-y-2 px-4 py-4 sm:px-6">
            {navItems.map((item) => {
              // Use regular anchor for hash links, Link for routes
              const isHashLink = item.href?.startsWith('#');
              const handleClick = (e: React.MouseEvent) => {
                if (isHashLink && item.href) {
                  e.preventDefault();
                  setIsMobileOpen(false);
                  const element = document.querySelector(item.href);
                  if (element) {
                    const headerOffset = 200; // Account for fixed header
                    const elementPosition = element.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({
                      top: offsetPosition,
                      behavior: 'smooth'
                    });
                  }
                } else {
                  setIsMobileOpen(false);
                }
              };

              return isHashLink ? (
                <a
                  key={item.label}
                  href={item.href || '#'}
                  onClick={handleClick}
                  className="block rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.href || '#'}
                  onClick={handleClick}
                  className="block rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  )
}

function TopBar() {
  return (
    <div className="hidden border-b border-[#0b4f8a]/20 bg-[#0b4f8a]/70 text-[11px] text-white backdrop-blur lg:block">
      <div className="container mx-auto flex items-center justify-between px-4 py-1 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide">24x7</span>
            <span className="flex items-center gap-2">
              <span>Helpline:</span>
              <span>8277892572 (South & West Circles)</span>
              <span className="text-white/70">|</span>
              <span>9449841590 (North & East Circles)</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

function Branding({ logoSrc }: { logoSrc?: string | null }) {
  const resolvedLogo = logoSrc || DEFAULT_LOGO
  const [imgSrc, setImgSrc] = useState(resolvedLogo)
  const [imgError, setImgError] = useState(false)

  // Update imgSrc when logoSrc changes
  useEffect(() => {
    if (logoSrc) {
      setImgSrc(logoSrc)
      setImgError(false)
    } else {
      setImgSrc(DEFAULT_LOGO)
      setImgError(false)
    }
  }, [logoSrc])

  const handleImageError = () => {
    if (!imgError && imgSrc !== DEFAULT_LOGO) {
      // Try fallback to static logo
      setImgError(true)
      setImgSrc(DEFAULT_LOGO)
    }
  }

  return (
    <Link to="/" className="flex items-center gap-3">
      <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#005aa9]/10 ring-1 ring-[#005aa9]/30">
        <img 
          src={imgSrc} 
          alt="BESCOM logo" 
          className="h-full w-full object-contain p-1" 
          onError={handleImageError}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-base font-bold leading-tight text-slate-900">
          Bangalore Electricity Supply Company Limited
        </span>
        <span className="text-[0.75rem] italic text-slate-500">(Wholly Owned by Government of Karnataka Undertaking)</span>
      </span>
    </Link>
  )
}






