import { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';

interface ELibraryResource {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  file: {
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  link?: string;
  resourceType?: 'file' | 'link';
  downloadCount: number;
  createdAt: string;
}

export default function Resources() {
  const [resources, setResources] = useState<ELibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Login form state
  const [loginData, setLoginData] = useState({
    userId: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check authentication - use separate storage for Resources
    const token = localStorage.getItem('resourcesToken');
    if (token) {
      setIsAuthenticated(true);
      fetchResources();
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchResources();
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (!loginData.userId.trim() || !loginData.password) {
      setLoginError('Please enter User ID and Password');
      return;
    }

    setIsLoggingIn(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: loginData.userId,
          password: loginData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data - use separate storage for Resources
      if (data.token) {
        localStorage.setItem('resourcesToken', data.token);
        localStorage.setItem('resourcesUser', JSON.stringify(data.user));
      }

      // Set authenticated and fetch resources
      setIsAuthenticated(true);
      setLoginData({ userId: '', password: '' });
      fetchResources();
      fetchCategories();
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchResources = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('resourcesToken');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`${API_BASE}/api/elibrary?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('resourcesToken');
        localStorage.removeItem('resourcesUser');
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setResources(result.data || []);
      } else {
        console.error('Error fetching resources:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('resourcesToken');
      if (!token) {
        return;
      }

      const response = await fetch(`${API_BASE}/api/elibrary/filters`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('resourcesToken');
        localStorage.removeItem('resourcesUser');
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const result = await response.json();
        setCategories(result.data?.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleLogout = () => {
    // Clear Resources-specific storage
    localStorage.removeItem('resourcesToken');
    localStorage.removeItem('resourcesUser');
    setIsAuthenticated(false);
    setLoginData({ userId: '', password: '' });
    setResources([]);
    setCategories([]);
  };

  const handleDownload = async (resourceId: string, fileName: string, resource: ELibraryResource) => {
    try {
      const token = localStorage.getItem('resourcesToken');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      // If it's a link resource, open in new tab
      if (resource.resourceType === 'link' && resource.link) {
        // Increment view count for links
        try {
          await fetch(`${API_BASE}/api/elibrary/${resourceId}/download`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (error) {
          console.error('Error incrementing view count:', error);
        }
        window.open(resource.link, '_blank', 'noopener,noreferrer');
        fetchResources(); // Refresh to update view count
        return;
      }

      // Otherwise, download the file
      const response = await fetch(`${API_BASE}/api/elibrary/${resourceId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('resourcesToken');
        localStorage.removeItem('resourcesUser');
        setIsAuthenticated(false);
        return;
      }

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Refresh to update download count
        fetchResources();
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const isVideoLink = (url: string) => {
    if (!url) return false;
    const videoPatterns = [
      /youtube\.com/,
      /youtu\.be/,
      /vimeo\.com\//,
      /\.mp4$/i,
      /\.webm$/i,
      /\.avi$/i,
      /\.mov$/i,
      /\.wmv$/i,
      /\.flv$/i,
      /\.mkv$/i
    ];
    return videoPatterns.some(pattern => pattern.test(url));
  };

  const isImageLink = (url: string) => {
    if (!url) return false;
    const imagePatterns = [
      /\.jpg$/i,
      /\.jpeg$/i,
      /\.png$/i,
      /\.gif$/i,
      /\.bmp$/i,
      /\.svg$/i,
      /\.webp$/i,
      /\.tiff$/i,
      /imgur\.com/,
      /\.ico$/i
    ];
    return imagePatterns.some(pattern => pattern.test(url));
  };

  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // Handle various YouTube URL formats
    let videoId = null;
    
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([^#&?]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }
    
    // Short URL: https://youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([^#&?]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }
    
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/youtube\.com\/embed\/([^#&?]+)/);
    if (embedMatch) {
      videoId = embedMatch[1];
    }
    
    // V URL: https://www.youtube.com/v/VIDEO_ID
    const vMatch = url.match(/youtube\.com\/v\/([^#&?]+)/);
    if (vMatch) {
      videoId = vMatch[1];
    }
    
    // Extract video ID from URL parameters
    if (!videoId) {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v');
    }
    
    // Clean video ID (remove any extra parameters)
    if (videoId) {
      videoId = videoId.split('&')[0].split('#')[0].split('?')[0];
    }
    
    return videoId && videoId.length === 11 ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const getVimeoEmbedUrl = (url: string) => {
    const regExp = /vimeo\.com\/(\d+)/;
    const match = url.match(regExp);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet') || type.includes('csv')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎬';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '📦';
    if (type.includes('text') || type.includes('plain')) return '📃';
    return '📎';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Manual': 'bg-blue-100 text-blue-800 border-blue-200',
      'Guide': 'bg-green-100 text-green-800 border-green-200',
      'Documentation': 'bg-purple-100 text-purple-800 border-purple-200',
      'Form': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Policy': 'bg-red-100 text-red-800 border-red-200',
      'Procedure': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Other': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category] || colors['Other'];
  };

  const filteredResources = searchQuery
    ? resources.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : resources;

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  📚 Resources
                </h2>
                <p className="text-gray-600">
                  Please login to access resources
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {loginError}
                  </div>
                )}

                <div>
                  <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                    User ID
                  </label>
                  <input
                    type="text"
                    id="userId"
                    value={loginData.userId}
                    onChange={(e) => setLoginData({ ...loginData, userId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your User ID"
                    required
                    disabled={isLoggingIn}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                      placeholder="Enter your Password"
                      required
                      disabled={isLoggingIn}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      disabled={isLoggingIn}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L12 12m-5.71-5.71L12 12" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoggingIn ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging in...
                    </span>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-purple-50 relative">
      {/* Fixed Logout Button - Always visible */}
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg hover:shadow-xl z-50 text-sm sm:text-base"
        title="Logout from Resources"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span>Logout</span>
      </button>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            📚 Resources
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Access manuals, guides, documentation, forms, and other resources
          </p>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading resources...</p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl text-gray-600">No resources found</p>
            <p className="text-gray-500 mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredResources.map((resource) => (
              <div
                key={resource._id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-blue-300"
              >
                <div className="p-4">
                  {/* Category Badge */}
                  <div className="mb-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${getCategoryColor(resource.category)}`}>
                      {resource.category}
                    </span>
                  </div>

                  {/* File Icon or Media Preview */}
                  {resource.resourceType === 'link' && resource.link ? (
                    getYouTubeEmbedUrl(resource.link) ? (
                      <div className="mb-2 w-full rounded-lg bg-black overflow-hidden" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                        <iframe
                          src={`${getYouTubeEmbedUrl(resource.link)}?rel=0&modestbranding=1&controls=1&showinfo=0&playsinline=1`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="absolute top-0 left-0 w-full h-full"
                          style={{ border: 'none' }}
                          title={resource.title}
                        ></iframe>
                      </div>
                    ) : isVideoLink(resource.link) ? (
                      <div className="mb-2">
                        {(() => {
                          const vimeoUrl = getVimeoEmbedUrl(resource.link);
                          return vimeoUrl ? (
                            <div className="relative" style={{ paddingBottom: '56.25%' }}>
                              <iframe
                                width="100%"
                                height="100%"
                                src={vimeoUrl}
                                frameBorder="0"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                                className="absolute top-0 left-0 w-full h-full rounded-lg"
                                title={resource.title}
                              ></iframe>
                            </div>
                          ) : (
                            <video
                              src={resource.link}
                              controls
                              className="w-full rounded-lg max-h-32"
                            >
                              Your browser does not support the video tag.
                            </video>
                          );
                        })()}
                      </div>
                    ) : isImageLink(resource.link) ? (
                      <div className="mb-2">
                        <img
                          src={resource.link}
                          alt={resource.title}
                          className="w-full h-32 object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-3xl mb-2 text-center">🔗</div>
                    )
                  ) : (
                    <div className="text-3xl mb-2 text-center">
                      {getFileIcon(resource.file?.fileType || '')}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">
                    {resource.title}
                  </h3>

                  {/* Description */}
                  {resource.description && (
                    <p className="text-gray-600 text-xs mb-2 line-clamp-2">
                      {resource.description}
                    </p>
                  )}

                  {/* Tags */}
                  {resource.tags && resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {resource.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* File Info */}
                  {resource.resourceType === 'link' && resource.link ? (
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2 pb-2 border-b">
                      <span className="text-blue-600">🔗 Link</span>
                      <span>👁️ {resource.downloadCount || 0}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2 pb-2 border-b">
                      <span>{formatFileSize(resource.file.fileSize || 0)}</span>
                      <span>📥 {resource.downloadCount || 0}</span>
                    </div>
                  )}

                  {/* Download/View Button */}
                  <button
                    onClick={() => handleDownload(resource._id, resource.file.fileName || resource.title, resource)}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium text-sm py-2 px-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    {resource.resourceType === 'link' && resource.link ? '🔗 Open Link' : '📥 Download'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results Count */}
        {!loading && filteredResources.length > 0 && (
          <div className="mt-8 text-center text-gray-600">
            Showing {filteredResources.length} of {resources.length} resources
          </div>
        )}
      </div>
    </section>
  );
}

