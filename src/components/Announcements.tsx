'use client'

import { useEffect, useState, useRef } from 'react'

interface Announcement {
  _id: string
  title: string
  description?: string
  category?: string
  date?: string
  closingDate?: string
  linkText?: string
  linkUrl?: string
  order?: number
  isActive?: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/landing/announcements?activeOnly=true`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.announcements)) {
            setAnnouncements(data.announcements)
          }
        }
      } catch (error) {
        console.error('Failed to fetch announcements:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  // Sort announcements by order, then by date (newest first)
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    const orderA = a.order ?? 0
    const orderB = b.order ?? 0
    if (orderA !== orderB) return orderA - orderB
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    return dateB - dateA
  })

  // Auto-scroll through announcements
  useEffect(() => {
    if (sortedAnnouncements.length <= 1 || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sortedAnnouncements.length)
    }, 5000) // Change announcement every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [sortedAnnouncements.length, isPaused])

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + sortedAnnouncements.length) % sortedAnnouncements.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sortedAnnouncements.length)
  }

  const togglePause = () => {
    setIsPaused((prev) => !prev)
  }

  if (loading) {
    return null
  }

  if (sortedAnnouncements.length === 0) {
    return null
  }

  const currentAnnouncement = sortedAnnouncements[currentIndex]

  return (
    <>
      <style>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .announcement-scroll-wrapper {
          display: flex;
          width: 200%;
          animation: scroll-left 40s linear infinite;
        }
        .announcement-scroll-wrapper:hover {
          animation-play-state: paused;
        }
        .announcement-scroll-item {
          flex: 0 0 50%;
          white-space: nowrap;
        }
        .announcement-container {
          overflow: hidden;
          white-space: nowrap;
        }
      `}</style>
      <section id="updates" className="bg-white border-b border-slate-200">
        <div className="flex items-center bg-white">
        {/* Red Banner with "News and Events" */}
        <div className="bg-red-600 px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <span className="text-white font-bold text-sm whitespace-nowrap">News and Events</span>
        </div>

        {/* White area with scrolling announcement text */}
        <div className="flex-1 bg-white px-6 py-4 min-h-[60px] flex items-center overflow-hidden relative announcement-container">
          {currentAnnouncement.linkUrl ? (
            <a
              href={currentAnnouncement.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full cursor-pointer hover:text-[#005aa9] transition-colors"
              onClick={() => {
                if (currentAnnouncement.linkUrl) {
                  window.open(currentAnnouncement.linkUrl, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              <div className="announcement-scroll-wrapper">
                <span className="announcement-scroll-item text-slate-900 font-medium text-sm md:text-base px-4">
                  {currentAnnouncement.title}
                </span>
                <span className="announcement-scroll-item text-slate-900 font-medium text-sm md:text-base px-4">
                  {currentAnnouncement.title}
                </span>
              </div>
            </a>
          ) : (
            <div className="announcement-scroll-wrapper">
              <span className="announcement-scroll-item text-slate-900 font-medium text-sm md:text-base px-4">
                {currentAnnouncement.title}
              </span>
              <span className="announcement-scroll-item text-slate-900 font-medium text-sm md:text-base px-4">
                {currentAnnouncement.title}
              </span>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 bg-slate-100 px-4 py-4 flex-shrink-0">
          {currentAnnouncement.linkUrl && (
            <a
              href={currentAnnouncement.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-[#005aa9] text-white px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 hover:bg-[#004178] transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              {currentAnnouncement.linkText || 'Read All'}
            </a>
          )}
          <div className="flex items-center gap-1 bg-slate-200 rounded px-2">
            <button
              onClick={handlePrevious}
              className="p-2 hover:bg-slate-300 rounded transition-colors"
              aria-label="Previous announcement"
            >
              <svg
                className="w-4 h-4 text-slate-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={togglePause}
              className="p-2 hover:bg-slate-300 rounded transition-colors"
              aria-label={isPaused ? 'Play' : 'Pause'}
            >
              {isPaused ? (
                <svg
                  className="w-4 h-4 text-slate-700"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-slate-700"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleNext}
              className="p-2 hover:bg-slate-300 rounded transition-colors"
              aria-label="Next announcement"
            >
              <svg
                className="w-4 h-4 text-slate-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
