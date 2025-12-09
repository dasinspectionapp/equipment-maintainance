'use client'

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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

// Use relative URL in production (nginx proxy), localhost in development
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:5000')

export default function AnnouncementsList() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/landing/announcements?activeOnly=true`)
        if (!res.ok) {
          throw new Error('Failed to load announcements')
        }
        const data = await res.json()
        if (data.success && Array.isArray(data.announcements)) {
          // Sort by order, then by date (newest first)
          const sorted = [...data.announcements].sort((a, b) => {
            const orderA = a.order ?? 0
            const orderB = b.order ?? 0
            if (orderA !== orderB) return orderA - orderB
            const dateA = a.date ? new Date(a.date).getTime() : 0
            const dateB = b.date ? new Date(b.date).getTime() : 0
            return dateB - dateA
          })
          setAnnouncements(sorted)
        } else {
          setAnnouncements([])
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load announcements')
      } finally {
        setLoading(false)
      }
    }

    fetchAnnouncements()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f1f5fb] pt-[8rem] lg:pt-[10.5rem]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005aa9]"></div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f1f5fb] pt-[8rem] lg:pt-[10.5rem]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f1f5fb] pt-[8rem] lg:pt-[10.5rem]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-[#005aa9] hover:text-[#004178] mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">News and Events</h1>
          <p className="text-slate-600 mt-2">All announcements and updates from BESCOM</p>
        </div>

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-slate-600">No announcements available at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement._id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {announcement.category && (
                      <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#005aa9] bg-[#005aa9]/10 rounded-full mb-2">
                        {announcement.category}
                      </span>
                    )}
                    <h2 className="text-xl font-semibold text-slate-900 mt-2 mb-2">
                      {announcement.title}
                    </h2>
                    {announcement.description && (
                      <p className="text-slate-600 mb-4">{announcement.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      {announcement.date && (
                        <span>
                          Date: {new Date(announcement.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      )}
                      {announcement.closingDate && (
                        <span>
                          Closing: {new Date(announcement.closingDate).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                    {announcement.linkUrl && (
                      <div className="mt-4">
                        <a
                          href={announcement.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-[#005aa9] hover:text-[#004178] font-semibold transition-colors"
                        >
                          {announcement.linkText || 'Read More'}
                          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

