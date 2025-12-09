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
  isActive: boolean;
  downloadCount: number;
  order: number;
  createdAt: string;
}

const CATEGORIES = ['Manual', 'Guide', 'Documentation', 'Form', 'Policy', 'Procedure', 'Other'];

export default function ELibraryAdmin() {
  const [resources, setResources] = useState<ELibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<ELibraryResource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Other',
    tags: '',
    isActive: true,
    order: 0,
    link: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resourceType, setResourceType] = useState<'file' | 'link'>('file');

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/elibrary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setResources(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      setError('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.category) {
      setError('Title and category are required');
      return;
    }

    if (editingResource) {
      await updateResource();
    } else {
      if (resourceType === 'file' && !selectedFile) {
        setError('Please select a file to upload');
        return;
      }
      if (resourceType === 'link' && !formData.link.trim()) {
        setError('Please provide a link');
        return;
      }
      await createResource();
    }
  };

  const createResource = async () => {
    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      
      if (resourceType === 'file') {
        const formDataToSend = new FormData();
        formDataToSend.append('file', selectedFile!);
        formDataToSend.append('title', formData.title);
        formDataToSend.append('description', formData.description);
        formDataToSend.append('category', formData.category);
        formDataToSend.append('tags', formData.tags);

        const response = await fetch(`${API_BASE}/api/admin/elibrary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formDataToSend
        });

        if (response.ok) {
          await fetchResources();
          resetForm();
          setShowAddModal(false);
          setError(null);
        } else {
          let errorMessage = 'Failed to create resource';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (parseError) {
            // If response is not JSON, try to get text
            try {
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            } catch (textError) {
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
          }
          setError(errorMessage);
        }
      } else {
        // Link-based resource
        const response = await fetch(`${API_BASE}/api/admin/elibrary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            category: formData.category,
            tags: formData.tags,
            link: formData.link.trim()
          })
        });

        if (response.ok) {
          await fetchResources();
          resetForm();
          setShowAddModal(false);
          setError(null);
        } else {
          let errorMessage = 'Failed to create resource';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (parseError) {
            // If response is not JSON, try to get text
            try {
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            } catch (textError) {
              errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
          }
          setError(errorMessage);
        }
      }
    } catch (error: any) {
      console.error('Error creating resource:', error);
      setError(error.message || 'Failed to create resource. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const updateResource = async () => {
    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/elibrary/${editingResource!._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          isActive: formData.isActive,
          order: formData.order
        })
      });

      if (response.ok) {
        await fetchResources();
        resetForm();
        setEditingResource(null);
        setShowAddModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update resource');
      }
    } catch (error) {
      console.error('Error updating resource:', error);
      setError('Failed to update resource');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/admin/elibrary/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchResources();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete resource');
      }
    } catch (error) {
      console.error('Error deleting resource:', error);
      setError('Failed to delete resource');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Other',
      tags: '',
      isActive: true,
      order: 0,
      link: ''
    });
    setSelectedFile(null);
    setResourceType('file');
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">E-Library Management</h1>
            <p className="text-gray-600 mt-1">Manage resources and documents for the landing page</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingResource(null);
              setShowAddModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            <span>+</span> Add Resource
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading resources...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resources.map((resource) => (
                    <tr key={resource._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{resource.title}</div>
                        {resource.description && (
                          <div className="text-sm text-gray-500 mt-1">{resource.description}</div>
                        )}
                        {resource.tags && resource.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {resource.tags.map((tag, idx) => (
                              <span key={idx} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {resource.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(resource as any).resourceType === 'link' && (resource as any).link ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔗</span>
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900">Link Resource</div>
                              <a 
                                href={(resource as any).link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate block max-w-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(resource as any).link}
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getFileIcon(resource.file?.fileType || '')}</span>
                            <div>
                              <div className="text-sm text-gray-900">{resource.file?.fileName || 'No file'}</div>
                              {resource.file?.fileSize > 0 && (
                                <div className="text-xs text-gray-500">{formatFileSize(resource.file.fileSize)}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {resource.downloadCount || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          resource.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {resource.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingResource(resource);
                              setFormData({
                                title: resource.title,
                                description: resource.description,
                                category: resource.category,
                                tags: resource.tags.join(', '),
                                isActive: resource.isActive,
                                order: resource.order,
                                link: (resource as any).link || ''
                              });
                              setResourceType((resource as any).resourceType || 'file');
                              setShowAddModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(resource._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingResource ? 'Edit Resource' : 'Add New Resource'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                      setEditingResource(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category *
                      </label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Order
                      </label>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="e.g., manual, guide, procedure"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {!editingResource && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Resource Type *
                      </label>
                      <div className="flex gap-4 mb-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="resourceType"
                            value="file"
                            checked={resourceType === 'file'}
                            onChange={() => {
                              setResourceType('file');
                              setSelectedFile(null);
                              setFormData({ ...formData, link: '' });
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">Upload File</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="resourceType"
                            value="link"
                            checked={resourceType === 'link'}
                            onChange={() => {
                              setResourceType('link');
                              setSelectedFile(null);
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <span className="ml-2 text-sm text-gray-700">Provide Link</span>
                        </label>
                      </div>

                      {resourceType === 'file' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            File *
                          </label>
                          <input
                            type="file"
                            required={resourceType === 'file'}
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.ods,.odp,.jpg,.jpeg,.png,.gif,.bmp,.svg,.webp,.tiff,.ico,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v,.3gp,.mp3,.wav,.flac,.aac,.ogg,.wma,.m4a,.zip,.rar,.7z,.tar,.gz,.csv,.xml,.json,.html,.htm"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {selectedFile && (
                            <p className="mt-1 text-sm text-gray-600">
                              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Link * (supports video, image, and document links)
                          </label>
                          <input
                            type="url"
                            required={resourceType === 'link'}
                            value={formData.link}
                            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                            placeholder="https://example.com/video.mp4 or https://example.com/image.jpg"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Enter a valid URL for videos (YouTube, Vimeo, direct video links), images, or documents
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {editingResource && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link (optional - for video/image links)
                      </label>
                      <input
                        type="url"
                        value={formData.link}
                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                        placeholder="https://example.com/video.mp4 or https://example.com/image.jpg"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Update the link URL if this resource uses a link instead of a file
                      </p>
                    </div>
                  )}

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                      Active (visible on landing page)
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
                    >
                      {uploading ? 'Saving...' : (editingResource ? 'Update' : 'Create')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        resetForm();
                        setEditingResource(null);
                      }}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

