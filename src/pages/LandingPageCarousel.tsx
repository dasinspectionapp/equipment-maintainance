'use client'

import { useEffect, useMemo, useState } from 'react'

interface Slide {
  _id: string
  title: string
  subtitle?: string
  eyebrow?: string
  description?: string
  ctaLabel?: string
  ctaUrl?: string
  imageData?: string
  imageUrl?: string
  backgroundImageData?: string
  order?: number
  createdAt?: string
  isActive?: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

const initialFormState = {
  title: '',
  subtitle: '',
  eyebrow: '',
  description: '',
  ctaLabel: '',
  ctaUrl: '',
  order: '',
}

export default function LandingPageCarousel() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formValues, setFormValues] = useState(initialFormState)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const sortedSlides = useMemo(() => {
    return [...slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [slides])

  const fetchSlides = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/landing/slides`)
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to load slides (status ${res.status})`)
      }
      const data = await res.json()
      if (data.success && Array.isArray(data.slides)) {
        setSlides(data.slides)
      } else {
        setSlides([])
      }
    } catch (err: any) {
      setError(err.message || 'Unable to load landing page slides')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlides()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (event.target.name === 'backgroundImage') {
      setBackgroundFile(file)
    } else {
      setImageFile(file)
    }
  }

  const resetForm = () => {
    setFormValues(initialFormState)
    setImageFile(null)
    setBackgroundFile(null)
    setEditingSlideId(null)
  }

  const handleEdit = (slide: Slide) => {
    console.log('Editing slide:', slide);
    
    setFormValues({
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      eyebrow: slide.eyebrow || '',
      description: slide.description || '',
      ctaLabel: slide.ctaLabel || '',
      ctaUrl: slide.ctaUrl || '',
      order: slide.order?.toString() || '',
    })
    setImageFile(null)
    setBackgroundFile(null)
    setEditingSlideId(slide._id)
    setError(null)
    
    // Scroll to form
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
    
    // For new slides, image is required. For editing, image is optional (only update if new image provided)
    if (!editingSlideId && !imageFile) {
      setError('Please choose an image to upload')
      return
    }

    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append('title', formValues.title)
    if (formValues.subtitle) formData.append('subtitle', formValues.subtitle)
    if (formValues.eyebrow) formData.append('eyebrow', formValues.eyebrow)
    if (formValues.description) formData.append('description', formValues.description)
    if (formValues.ctaLabel) formData.append('ctaLabel', formValues.ctaLabel)
    if (formValues.ctaUrl) formData.append('ctaUrl', formValues.ctaUrl)
    if (formValues.order) formData.append('order', formValues.order)
    
    // Only append image if provided (for edit, it's optional)
    if (imageFile) {
      formData.append('image', imageFile)
    }
    if (backgroundFile) {
      formData.append('backgroundImage', backgroundFile)
    }

    try {
      const url = editingSlideId 
        ? `${API_BASE}/api/landing/slides/${editingSlideId}`
        : `${API_BASE}/api/landing/slides`
      
      const res = await fetch(url, {
        method: editingSlideId ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to ${editingSlideId ? 'update' : 'create'} slide (status ${res.status})`)
      }

      await fetchSlides()
      resetForm()
    } catch (err: any) {
      setError(err.message || `Unable to ${editingSlideId ? 'update' : 'save'} slide`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) {
      setError('Authentication token missing. Please sign in again.')
      return
    }
    const confirmed = window.confirm('Are you sure you want to delete this carousel slide?')
    if (!confirmed) return

    try {
      const res = await fetch(`${API_BASE}/api/landing/slides/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error || payload?.message || `Failed to delete slide (status ${res.status})`)
      }
      await fetchSlides()
    } catch (err: any) {
      setError(err.message || 'Unable to delete slide')
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Landing Page &mdash; Carousel</h1>
        {editingSlideId && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm text-blue-800 font-semibold">Editing slide: {slides.find(s => s._id === editingSlideId)?.title || editingSlideId}</p>
          </div>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Upload carousel slides that will appear on the public landing page. Images are stored within the <code>LandingPage</code> collection in
          MongoDB along with their accompanying content.
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
                placeholder="Primary headline"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="subtitle">
                Subtitle / Eyebrow
              </label>
              <input
                id="subtitle"
                name="subtitle"
                type="text"
                value={formValues.subtitle}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                placeholder="Optional supporting text"
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
                placeholder="Short narrative supporting the slide"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="ctaLabel">
                  CTA Label
                </label>
                <input
                  id="ctaLabel"
                  name="ctaLabel"
                  type="text"
                  value={formValues.ctaLabel}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                  placeholder="e.g. Learn More"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="ctaUrl">
                  CTA URL
                </label>
                <input
                  id="ctaUrl"
                  name="ctaUrl"
                  type="url"
                  value={formValues.ctaUrl}
                  onChange={handleInputChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#005aa9] focus:outline-none focus:ring-2 focus:ring-[#005aa9]/30"
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="image">
                  Carousel Image {!editingSlideId && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="image"
                  name="image"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-[#005aa9]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#005aa9] hover:file:bg-[#005aa9]/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {editingSlideId 
                    ? 'Foreground image (main illustration). Leave blank to keep existing image. Recommended: 1600x600px, max 5MB.'
                    : 'Foreground image (main illustration). Recommended: 1600x600px, max 5MB.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="backgroundImage">
                  Background Image
                </label>
                <input
                  id="backgroundImage"
                  name="backgroundImage"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-[#005aa9]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#005aa9] hover:file:bg-[#005aa9]/20"
                />
                <p className="mt-1 text-xs text-slate-500">Optional light texture (1600x600px max 5MB). Leave blank for default gradient.</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-full bg-[#005aa9] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#004178] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (editingSlideId ? 'Updating...' : 'Saving...') : (editingSlideId ? 'Update Slide' : 'Save Slide')}
              </button>
              {editingSlideId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel Edit
                </button>
              )}
              {!editingSlideId && (
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
                <li>Use high-quality landscape images; 16:9 aspect ratio works best.</li>
                <li>Keep the description concise (1&ndash;2 sentences).</li>
                <li>CTA fields are optional; leave blank if not needed.</li>
                <li>Optional background image becomes the slide backdrop (1600x600px recommended, light colours).</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800">Current selection</h3>
              <p className="mt-2 text-xs text-slate-500">
                Slides are displayed on the public landing page in ascending order. You can adjust the order value to
                reposition new slides.
              </p>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Existing Slides</h2>
          <button
            type="button"
            onClick={fetchSlides}
            className="text-sm font-semibold text-[#005aa9] hover:text-[#004178]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading slides...</p>
        ) : sortedSlides.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No slides have been created yet.</p>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {sortedSlides.map((slide) => (
              <div key={slide._id} className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                {slide.imageData || slide.imageUrl ? (
                  <img
                    src={slide.imageData || slide.imageUrl}
                    alt={slide.title}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-slate-100 text-slate-400">
                    No image
                  </div>
                )}
                <div className="space-y-3 p-5 text-sm">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span>Order: {slide.order ?? '-'}</span>
                    <span>{slide.isActive === false ? 'Hidden' : 'Active'}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{slide.title}</h3>
                    {slide.subtitle && <p className="text-xs uppercase tracking-wide text-slate-500">{slide.subtitle}</p>}
                    {slide.description && <p className="mt-2 text-slate-600">{slide.description}</p>}
                  </div>
                  {(slide.ctaLabel || slide.ctaUrl) && (
                    <div className="rounded-lg bg-slate-100/80 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold">CTA:</span> {slide.ctaLabel || '—'}{' '}
                      {slide.ctaUrl && (
                        <a href={slide.ctaUrl} className="ml-1 text-[#005aa9] hover:underline" target="_blank" rel="noreferrer">
                          {slide.ctaUrl}
                        </a>
                      )}
                    </div>
                  )}
                  {slide.backgroundImageData && (
                    <div className="rounded-lg bg-slate-100/80 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold">Background image supplied</span>
                    </div>
                  )}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Edit button clicked for slide:', slide._id);
                        handleEdit(slide);
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
                        handleDelete(slide._id);
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
