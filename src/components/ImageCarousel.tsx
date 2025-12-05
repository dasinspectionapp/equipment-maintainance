'use client'

import { useEffect, useMemo, useState } from 'react'

interface Slide {
  id?: string
  src: string
  alt: string
  eyebrow: string
  title: string
  description: string
  backgroundSrc?: string
}

interface ApiSlide {
  _id?: string
  title?: string
  subtitle?: string
  eyebrow?: string
  description?: string
  imageData?: string
  imageUrl?: string
  backgroundImageData?: string
  ctaLabel?: string
  ctaUrl?: string
  order?: number
  isActive?: boolean
}

const FALLBACK_SLIDES: Slide[] = [
  {
    src: '/carousel/rmu-service-bay.jpg',
    alt: 'Technicians servicing a Ring Main Unit cabinet',
    eyebrow: 'RMU Maintenance',
    title: 'Efficient upkeep of ring main units across the city',
    description:
      'Specialised teams perform scheduled inspections, lubrication, and diagnostic tests to keep RMU networks running optimally in every distribution zone.',
  },
  {
    src: '/carousel/rmu-control-room.jpg',
    alt: 'Engineers monitoring RMU performance from a control room',
    eyebrow: 'Remote Monitoring',
    title: 'Live visibility into RMU performance from the control centre',
    description:
      'Centralised dashboards track switchgear status, load patterns, and fault histories, enabling rapid isolation and restoration during outages.',
  },
  {
    src: '/carousel/rmu-installation.jpg',
    alt: 'Field crew installing a new ring main unit at a distribution point',
    eyebrow: 'Grid Expansion',
    title: 'Deploying modern RMU infrastructure for future-ready grids',
    description:
      'New installations feature compact switchgear, SCADA integration, and enhanced safety features to support Bengaluru’s growing power demand.',
  },
]

const AUTO_PLAY_INTERVAL = 6000
// Use relative URL in production (nginx proxy), localhost in development
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:5000')

export default function ImageCarousel() {
  const [slides, setSlides] = useState<Slide[]>(FALLBACK_SLIDES)
  const [activeIndex, setActiveIndex] = useState(0)

  const actualSlides = useMemo(() => slides.filter(Boolean), [slides])
  const slideCount = actualSlides.length

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    async function fetchSlides() {
      try {
        const response = await fetch(`${API_BASE}/api/landing/slides`, {
          signal: controller.signal,
        })
        if (!response.ok) return

        const data = await response.json()
        if (!data?.success || !Array.isArray(data.slides)) return

        const mapped: Slide[] = (data.slides as ApiSlide[])
          .filter((slide) => slide && (slide.imageData || slide.imageUrl) && slide.isActive !== false)
          .map((slide) => ({
            id: slide._id || String(slide.order ?? Math.random()),
            src: slide.imageData || slide.imageUrl || '',
            alt: slide.subtitle || slide.title || 'Landing slide',
            eyebrow: slide.eyebrow || slide.subtitle || 'BESCOM',
            title: slide.title || '',
            description: slide.description || '',
            backgroundSrc: slide.backgroundImageData,
          }))
          .filter((slide) => slide.src)

        if (isMounted && mapped.length > 0) {
          setSlides(mapped)
          setActiveIndex(0)
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Unable to load landing page slides', error)
        }
      }
    }

    fetchSlides()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (slideCount <= 1) return

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount)
    }, AUTO_PLAY_INTERVAL)

    return () => clearInterval(timer)
  }, [slideCount])

  if (slideCount === 0) {
    return null
  }

  const goTo = (index: number) => {
    if (slideCount === 0) return
    const next = (index + slideCount) % slideCount
    setActiveIndex(next)
  }

  return (
    <section className="relative mb-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl shadow-lg ring-1 ring-slate-200/60">
        <div className="relative h-[22rem] sm:h-[26rem] lg:h-[30rem]">
          {actualSlides.map((slide, index) => {
            const isActive = index === activeIndex
            return (
              <div
                key={slide.id || `${slide.src}-${index}`}
                className={`absolute inset-0 overflow-hidden rounded-3xl transition-all duration-700 ease-in-out ${
                  isActive ? 'opacity-100 translate-x-0 z-10' : 'pointer-events-none -translate-x-6 opacity-0'
                }`}
                aria-hidden={!isActive}
              >
                {slide.backgroundSrc && (
                  <img
                    src={slide.backgroundSrc}
                    alt={`${slide.title}-background`}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className="h-full w-full object-contain"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </div>
                <div className="pointer-events-none absolute bottom-6 left-6 right-6 text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)] sm:left-10 sm:right-10 lg:left-14 lg:right-14">
                  <span className="inline-flex w-fit items-center rounded-full bg-black/55 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em]">
                    {slide.eyebrow}
                  </span>
                  <h2 className="mt-4 text-2xl font-bold leading-snug sm:text-3xl lg:text-4xl">{slide.title}</h2>
                  <p className="mt-3 text-sm sm:text-base">{slide.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/30 p-3 text-white backdrop-blur transition hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Previous slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 19-7-7 7-7" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/30 p-3 text-white backdrop-blur transition hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Next slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 5 7 7-7 7" />
          </svg>
        </button>

        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {actualSlides.map((slide, index) => {
            const isActive = index === activeIndex
            return (
              <button
                key={slide.id || `${slide.src}-${index}`}
                type="button"
                onClick={() => goTo(index)}
                className={`h-2.5 rounded-full transition-all ${isActive ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                aria-label={`Go to slide ${index + 1}`}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

