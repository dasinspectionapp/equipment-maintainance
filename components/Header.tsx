'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavItem = {
  label: string;
  href?: string;
};

const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About DAS', href: '#about' },
  { label: 'Projects', href: '#updates' },
  { label: 'Downloads', href: '#downloads' },
  { label: 'Contact', href: '#contact' },
  { label: 'Sign In', href: '/signin' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string>('/bescom-logo.svg');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function fetchLogo() {
      try {
        const response = await fetch(`${API_BASE}/api/landing/branding`, {
          signal: controller.signal,
        });

        if (!response.ok) return;
        const data = await response.json();
        if (!isActive || !data?.success) return;

        const candidate: string | undefined = data.logoUrl || data.logoPath;
        if (candidate) {
          const normalized = candidate.startsWith('http')
            ? candidate
            : `${API_BASE}/${candidate.replace(/^\/+/, '')}`;
          setLogoSrc(normalized);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Unable to load branding logo', error);
        }
      }
    }

    fetchLogo();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

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
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href || '#'}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex h-12 items-center justify-between px-4 text-sm font-semibold uppercase tracking-wide lg:hidden">
          <span className="text-white/80">Navigation</span>
          <span className="text-white/60">{isMobileOpen ? 'Close' : 'Menu'}</span>
        </div>
      </div>

      {isMobileOpen && (
        <div className="border-b border-[#003768] bg-[#003b73] text-white lg:hidden">
          <div className="container mx-auto space-y-2 px-4 py-4 sm:px-6">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href || '#'}
                className="block rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function TopBar() {
  return (
    <div className="hidden border-b border-[#0b4f8a]/20 bg-[#0b4f8a]/70 text-[11px] text-white backdrop-blur lg:block">
      <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-1">
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
  );
}

function Branding({ logoSrc }: { logoSrc?: string | null }) {
  const resolvedLogo = logoSrc || '/bescom-logo.svg';

  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#005aa9]/10 ring-1 ring-[#005aa9]/30">
        <Image
          src={resolvedLogo}
          alt="BESCOM logo"
          width={44}
          height={44}
          priority
          className="h-full w-full object-contain p-1"
          unoptimized={!resolvedLogo.startsWith('/')}
        />
      </span>
      <span className="flex flex-col">
        <span className="text-base font-bold leading-tight text-slate-900">
          Bangalore Electricity Supply Company Limited
        </span>
        <span className="text-[0.75rem] italic text-slate-500">Wholly Owned by Government of Karnataka Undertaking</span>
      </span>
    </Link>
  );
}
