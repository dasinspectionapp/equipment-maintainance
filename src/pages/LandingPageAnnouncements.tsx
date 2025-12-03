'use client'

import { useEffect, useMemo, useState } from 'react'

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
  createdAt?: string
  isActive?: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

const initialFormState = {
  title: '',
  description: '',
  category: '',
  date: '',
  closingDate: '',
  linkText: '',
  linkUrl: '',
  order: '',
}

export default function LandingPageAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formValues, setFormValues] = useState(initialFormState)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [announcements])

  const fetchAnnouncements = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/landing/announcements?activeOnly=false`)
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to load announcements (status ${res.status})`)
      }
      const data = await res.json()
      if (data.success && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements)
      } else {
        setAnnouncements([])
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load announcements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setFormValues(initialFormState)
    setEditingAnnouncementId(null)
  }

  const handleEdit = (announcement: Announcement) => {
    setFormValues({
      title: announcement.title || '',
      description: announcement.description || '',
      category: announcement.category || '',
      date: announcement.date ? new Date(announcement.date).toISOString().split('T')[0] : '',
      closingDate: announcement.closingDate ? new Date(announcement.closingDate).toISOString().split('T')[0] : '',
      linkText: announcement.linkText || '',
      linkUrl: announcement.linkUrl || '',
      order: announcement.order?.toString() || '',
    })
    setEditingAnnouncementId(announcement._id)
    setError(null)
    
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) {
      setError('Authentication token missing. Please sign in again.')
      return
    }
    
    setSubmitting(true)
    setError(null)

    const payload: any = {
      title: formValues.title,
    }
    
    if (formValues.description) payload.description = formValues.description
    if (formValues.category) payload.category = formValues.category
    if (formValues.date) payload.date = formValues.date
    if (formValues.closingDate) payload.closingDate = formValues.closingDate
    if (formValues.linkText) payload.linkText = formValues.linkText
    if (formValues.linkUrl) payload.linkUrl = formValues.linkUrl
    if (formValues.order) payload.order = formValues.order

    try {
      const url = editingAnnouncementId 
        ? `${API_BASE}/api/landing/announcements/${editingAnnouncementId}`
        : `${API_BASE}/api/landing/announcements`
      
      const res = await fetch(url, {
        method: editingAnnouncementId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to ${editingAnnouncementId ? 'update' : 'create'} announcement (status ${res.status})`)
      }

      await fetchAnnouncements()
      resetForm()
    } catch (err: any) {
      setError(err.message || `Unable to ${editingAnnouncementId ? 'update' : 'save'} announcement`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) {
      setError('Authentication token missing. Please sign in again.')
      return
    }
    const confirmed = window.confirm('Are you sure you want to delete this announcement?')
    if (!confirmed) return

    try {
      const res = await fetch(`${API_BASE}/api/landing/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to delete announcement (status ${res.status})`)
      }
      await fetchAnnouncements()
    } catch (err: any) {
      setError(err.message || 'Unable to delete announcement')
    }
  }

  const handleToggleActive = async (announcement: Announcement) => {
    if (!token) {
      setError('Authentication token missing. Please sign in again.')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/landing/announcements/${announcement._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !announcement.isActive }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to update announcement (status ${res.status})`)
      }
      await fetchAnnouncements()
    } catch (err: any) {
      setError(err.message || 'Unable to update announcement')
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Landing Page &mdash; Announcements</h1>
        {editingAnnouncementId && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-800 font-semibold">Editing announcement: {announcements.find(a => a._id === editingAnnouncementId)?.title || editingAnnouncementId}</p>
          </div>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Manage announcements that will appear on the public landing page below the carousel.
        </p>

        <form className="mt-8 grid gap-6 md:grid-cols-[2fr_1fr]" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={formValues.title}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                placeholder="Announcement title"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formValues.description}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                rows={4}
                placeholder="Announcement description"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="category">
                  Category
                </label>
                <input
                  id="category"
                  name="category"
                  type="text"
                  value={formValues.category}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                  placeholder="e.g. Service Advisory"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="order">
                  Display Order
                </label>
                <input
                  id="order"
                  name="order"
                  type="number"
                  min={0}
                  value={formValues.order}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                  placeholder="Auto"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  value={formValues.date}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="closingDate">
                  Closing Date (for tenders)
                </label>
                <input
                  id="closingDate"
                  name="closingDate"
                  type="date"
                  value={formValues.closingDate}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="linkText">
                  Link Text
                </label>
                <input
                  id="linkText"
                  name="linkText"
                  type="text"
                  value={formValues.linkText}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                  placeholder="e.g. Read details"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="linkUrl">
                  Link URL
                </label>
                <input
                  id="linkUrl"
                  name="linkUrl"
                  type="url"
                  value={formValues.linkUrl}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                  placeholder="https://"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-full bg-[#005aa9] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#004178] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (editingAnnouncementId ? 'Updating...' : 'Saving...') : (editingAnnouncementId ? 'Update Announcement' : 'Save Announcement')}
              </button>
              {editingAnnouncementId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel Edit
                </button>
              )}
              {!editingAnnouncementId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-sm text-slate-600">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Guidelines</h2>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>Keep announcements concise and clear.</li>
                <li>Use categories to organize announcements (e.g., Service Advisory, Tender, etc.).</li>
                <li>Closing date is useful for tenders or time-sensitive announcements.</li>
                <li>Link text and URL are optional but recommended for detailed information.</li>
                <li>Announcements are displayed in ascending order.</li>
              </ul>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Existing Announcements</h2>
          <button
            type="button"
            onClick={fetchAnnouncements}
            className="text-sm font-semibold text-[#005aa9] hover:text-[#004178]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading announcements...</p>
        ) : sortedAnnouncements.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No announcements have been created yet.</p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {sortedAnnouncements.map((announcement) => (
              <div key={announcement._id} className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                <div className="space-y-3 p-5 text-sm">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span>Order: {announcement.order ?? '-'}</span>
                    <div className="flex items-center gap-2">
                      <span className={announcement.isActive === false ? 'text-red-600' : 'text-green-600'}>
                        {announcement.isActive === false ? 'Hidden' : 'Active'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(announcement)}
                        className="text-xs font-semibold text-[#005aa9] hover:text-[#004178]"
                      >
                        {announcement.isActive === false ? 'Activate' : 'Deactivate'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{announcement.title}</h3>
                    {announcement.category && (
                      <p className="text-xs uppercase tracking-wide text-[#005aa9] mt-1">{announcement.category}</p>
                    )}
                    {announcement.description && (
                      <p className="mt-2 text-slate-600">{announcement.description}</p>
                    )}
                    {announcement.date && (
                      <p className="mt-2 text-xs text-slate-500">
                        Date: {new Date(announcement.date).toLocaleDateString()}
                      </p>
                    )}
                    {announcement.closingDate && (
                      <p className="mt-1 text-xs text-slate-500">
                        Closing: {new Date(announcement.closingDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {(announcement.linkText || announcement.linkUrl) && (
                    <div className="rounded-lg bg-slate-100/80 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold">Link:</span> {announcement.linkText || '—'}{' '}
                      {announcement.linkUrl && (
                        <a href={announcement.linkUrl} className="ml-1 text-[#005aa9] hover:underline" target="_blank" rel="noreferrer">
                          {announcement.linkUrl}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(announcement);
                      }}
                      className="text-sm font-semibold text-[#005aa9] hover:text-[#004178] cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(announcement._id);
                      }}
                      className="text-sm font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}


