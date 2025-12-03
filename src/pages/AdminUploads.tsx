import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';

// Image Preview Component with Authentication
function ImagePreview({ fieldId, fileName }: { fieldId: string; fileName: string }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/api/admin/uploads/files/${fieldId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        setImageSrc(url);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading image:', error);
        setLoading(false);
      });

    return () => {
      if (imageSrc) {
        window.URL.revokeObjectURL(imageSrc);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId]);

  if (loading) {
    return <div className="text-gray-500">Loading image...</div>;
  }

  if (!imageSrc) {
    return <div className="text-gray-500">Failed to load image</div>;
  }

  return (
    <img
      src={imageSrc}
      alt={fileName}
      className="max-w-xs max-h-48 rounded-lg border border-gray-300"
    />
  );
}

interface UploadField {
  _id: string;
  fieldName: string;
  fieldKey: string;
  uploadedFile: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    uploadedAt: string | null;
  };
  order: number;
  createdAt: string;
}

export default function AdminUploads() {
  const [fields, setFields] = useState<UploadField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fieldId: string; fileName: string; fileType: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/admin/uploads/fields', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFields(result.fields || []);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch fields');
      }
    } catch (error) {
      console.error('Error fetching fields:', error);
      setError('Failed to fetch upload fields');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateField = async () => {
    if (!newFieldName.trim()) {
      setError('Field name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      // Step 1: Create the field
      const createResponse = await fetch('http://localhost:5000/api/admin/uploads/fields', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fieldName: newFieldName.trim() })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ error: 'Server error' }));
        setError(errorData.error || 'Failed to create field');
        return;
      }

      const createResult = await createResponse.json();
      if (!createResult.success) {
        setError(createResult.error || 'Failed to create field');
        return;
      }

      const newField = createResult.field;

      // Step 2: Upload files if any are selected
      if (selectedFiles.length > 0) {
        let uploadedCount = 0;
        let lastUploadedField = newField;
        
        // Upload all files sequentially (last file will be the one shown)
        for (let i = 0; i < selectedFiles.length; i++) {
          const fileToUpload = selectedFiles[i];
          const formData = new FormData();
          formData.append('file', fileToUpload);

          try {
            const uploadResponse = await fetch(`http://localhost:5000/api/admin/uploads/fields/${newField._id}/upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();
              if (uploadResult.success) {
                lastUploadedField = uploadResult.field;
                uploadedCount++;
              }
            }
          } catch (uploadError) {
            console.error(`Error uploading file ${i + 1}:`, uploadError);
          }
        }

        if (uploadedCount > 0) {
          setFields([...fields, lastUploadedField]);
          if (uploadedCount < selectedFiles.length) {
            setError(`Field created. ${uploadedCount} of ${selectedFiles.length} file(s) uploaded successfully.`);
          }
        } else {
          // Field created but all file uploads failed
          setFields([...fields, newField]);
          setError('Field created but file upload failed. You can upload files later.');
        }
      } else {
        // No files to upload, just add the field
        setFields([...fields, newField]);
      }

      // Reset form
      setNewFieldName('');
      setSelectedFiles([]);
      setShowAddFieldModal(false);
      setError(null);
    } catch (error) {
      console.error('Error creating field:', error);
      setError('Failed to create field. Please check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      // Validate file types
      const allowedTypes = ['.xlsx', '.xls', '.csv', '.pdf', '.jpeg', '.jpg', '.png'];
      const validFiles = fileArray.filter(file => {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        return allowedTypes.includes(extension);
      });

      if (validFiles.length !== fileArray.length) {
        setError('Some files were skipped. Only .xlsx, .csv, .pdf, .jpeg, .jpg, .png files are allowed.');
      }

      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    try {
      setUploading(fieldId);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/admin/uploads/fields/${fieldId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update the field in the fields array
          setFields(fields.map(f => f._id === fieldId ? result.field : f));
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteFile = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/admin/uploads/fields/${fieldId}/file`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Refresh fields
          fetchFields();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setError('Failed to delete file');
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? This will also delete the associated file.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/admin/uploads/fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setFields(fields.filter(f => f._id !== fieldId));
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete field');
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      setError('Failed to delete field');
    }
  };

  const handleViewFile = (fieldId: string) => {
    const field = fields.find(f => f._id === fieldId);
    if (!field || !field.uploadedFile.fileName) return;

    setPreviewFile({
      fieldId,
      fileName: field.uploadedFile.fileName,
      fileType: field.uploadedFile.fileType
    });
    setPreviewLoading(true);
    setPreviewUrl(null);

    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/api/admin/uploads/files/${fieldId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewLoading(false);
      })
      .catch(error => {
        console.error('Error loading file for preview:', error);
        setError('Failed to load file for preview');
        setPreviewLoading(false);
      });
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  };

  const handleDownloadFile = (fieldId: string, fileName: string) => {
    const token = localStorage.getItem('token');
    const url = `http://localhost:5000/api/admin/uploads/files/${fieldId}`;
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      })
      .catch(error => {
        console.error('Error downloading file:', error);
        setError('Failed to download file');
      });
  };

  const isImageFile = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Admin Uploads</h1>
          <p className="text-gray-600 mt-1">Manage and upload files for admin use</p>
        </div>
        <button
          onClick={() => setShowAddFieldModal(true)}
          className="px-6 py-3 text-white rounded-lg transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl font-semibold text-base min-w-[180px] justify-center"
          style={{ 
            display: 'flex', 
            visibility: 'visible',
            backgroundColor: '#2563eb',
            border: '2px solid #1d4ed8'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-lg">Add New Field</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Upload Fields */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600 text-lg font-medium mb-2">No upload fields created yet.</p>
            <p className="text-gray-500 text-sm mb-4">Click "Add New Field" button above to create your first upload field.</p>
            <button
              onClick={() => setShowAddFieldModal(true)}
              className="px-8 py-4 text-white rounded-lg transition-colors inline-flex items-center space-x-3 shadow-xl hover:shadow-2xl font-bold text-lg"
              style={{ 
                display: 'inline-flex', 
                visibility: 'visible',
                backgroundColor: '#2563eb',
                border: '3px solid #1d4ed8'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Your First Field</span>
            </button>
          </div>
        ) : (
          fields.map((field) => (
            <div key={field._id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800">{field.fieldName}</h3>
                  {field.uploadedFile.fileName && (
                    <p className="text-sm text-gray-500 mt-1">
                      File: {field.uploadedFile.fileName} ({formatFileSize(field.uploadedFile.fileSize)})
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteField(field._id)}
                  className="text-red-600 hover:text-red-700 p-2"
                  title="Delete Field"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* File Upload Section */}
              <div className="space-y-4">
                {field.uploadedFile.fileName ? (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    {/* Preview for Images */}
                    {isImageFile(field.uploadedFile.fileType) ? (
                      <div className="mb-4">
                        <ImagePreview fieldId={field._id} fileName={field.uploadedFile.fileName} />
                      </div>
                    ) : (
                      <div className="mb-4 flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{field.uploadedFile.fileName}</p>
                          <p className="text-sm text-gray-500">{field.uploadedFile.fileType}</p>
                        </div>
                      </div>
                    )}

                    {/* File Actions */}
                    <div className="flex items-center space-x-3 flex-wrap gap-2">
                      <button
                        onClick={() => handleViewFile(field._id)}
                        className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors flex items-center space-x-2 shadow-md hover:shadow-lg"
                        style={{
                          backgroundColor: '#001f3f',
                          border: '2px solid #003d7a'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#003d7a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#001f3f'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Preview</span>
                      </button>
                      <button
                        onClick={() => handleDownloadFile(field._id, field.uploadedFile.fileName)}
                        className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center space-x-2"
                        style={{
                          backgroundColor: '#001f3f',
                          border: '2px solid #003d7a'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#003d7a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#001f3f'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => handleDeleteFile(field._id)}
                        className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center space-x-2"
                        style={{
                          backgroundColor: '#001f3f',
                          border: '2px solid #003d7a'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#003d7a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#001f3f'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Remove</span>
                      </button>
                      <label 
                        className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-md hover:shadow-lg cursor-pointer flex items-center space-x-2"
                        style={{
                          backgroundColor: '#001f3f',
                          border: '2px solid #003d7a'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#003d7a'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#001f3f'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Replace</span>
                        <input
                          type="file"
                          accept=".xlsx,.csv,.pdf,.jpeg,.jpg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(field._id, file);
                            }
                          }}
                          disabled={uploading === field._id}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block w-full">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <input
                          type="file"
                          accept=".xlsx,.csv,.pdf,.jpeg,.jpg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(field._id, file);
                            }
                          }}
                          disabled={uploading === field._id}
                        />
                        {uploading === field._id ? (
                          <div className="text-gray-600">Uploading...</div>
                        ) : (
                          <>
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-gray-600 font-medium">Click to upload file</p>
                            <p className="text-gray-500 text-sm mt-1">Supports: .xlsx, .csv, .pdf, .jpeg, .jpg, .png</p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => !creating && setShowAddFieldModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Add New Upload Field</h2>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Name
                </label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g., Geo Location, User Data"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateField();
                    } else if (e.key === 'Escape') {
                      setShowAddFieldModal(false);
                    }
                  }}
                />
              </div>

              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Files (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.csv,.pdf,.jpeg,.jpg,.png"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload-input"
                    disabled={creating}
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600 font-medium">Click to select files</p>
                    <p className="text-xs text-gray-500 mt-1">Supports: .xlsx, .csv, .pdf, .jpeg, .jpg, .png</p>
                    <p className="text-xs text-gray-400 mt-1">You can select multiple files</p>
                  </label>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected Files ({selectedFiles.length}):</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                            <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="ml-2 text-red-600 hover:text-red-700 flex-shrink-0"
                            disabled={creating}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    {selectedFiles.length > 1 && (
                      <p className="text-xs text-gray-500 mt-1">
                        All selected files will be uploaded to this field.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex space-x-3 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowAddFieldModal(false);
                    setNewFieldName('');
                    setSelectedFiles([]);
                    setError(null);
                  }}
                  className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  style={{ 
                    display: 'inline-flex', 
                    visibility: 'visible',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateField}
                  disabled={creating || !newFieldName.trim()}
                  className="px-6 py-2.5 text-white rounded-lg transition-colors font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    display: 'inline-flex', 
                    visibility: 'visible',
                    backgroundColor: creating ? '#64748b' : '#2563eb',
                    border: creating ? '2px solid #475569' : '2px solid #1d4ed8',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '120px'
                  }}
                  onMouseEnter={(e) => {
                    if (!creating && newFieldName.trim()) {
                      e.currentTarget.style.backgroundColor = '#1d4ed8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!creating) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  type="button"
                >
                  {creating ? 'Creating...' : 'Create Field'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={closePreview}>
          <div className="bg-white rounded-lg shadow-2xl w-[90%] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Preview Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">{previewFile.fileName}</h3>
                <p className="text-sm text-gray-500">{previewFile.fileType}</p>
              </div>
              <button
                onClick={closePreview}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-600">Loading preview...</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <>
                  {isImageFile(previewFile.fileType) ? (
                    <div className="flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt={previewFile.fileName}
                        className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  ) : previewFile.fileType === 'application/pdf' ? (
                    <div className="w-full h-[70vh] bg-white rounded-lg shadow-lg">
                      <iframe
                        src={previewUrl}
                        className="w-full h-full rounded-lg"
                        title={previewFile.fileName}
                      />
                    </div>
                  ) : previewFile.fileType.includes('excel') || previewFile.fileType.includes('spreadsheet') || previewFile.fileName.endsWith('.xlsx') || previewFile.fileName.endsWith('.xls') ? (
                    <div className="bg-white rounded-lg p-6 text-center">
                      <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-700 font-medium mb-2">Excel File Preview</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Excel files (.xlsx, .xls) cannot be previewed in the browser.
                      </p>
                      <button
                        onClick={() => {
                          const token = localStorage.getItem('token');
                          fetch(`http://localhost:5000/api/admin/uploads/files/${previewFile.fieldId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = previewFile.fileName;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download to View
                      </button>
                    </div>
                  ) : previewFile.fileType === 'text/csv' || previewFile.fileName.endsWith('.csv') ? (
                    <div className="bg-white rounded-lg p-6">
                      <p className="text-gray-700 font-medium mb-4">CSV File Preview</p>
                      <p className="text-sm text-gray-500 mb-4">
                        CSV files cannot be previewed directly. Please download to view.
                      </p>
                      <button
                        onClick={() => {
                          const token = localStorage.getItem('token');
                          fetch(`http://localhost:5000/api/admin/uploads/files/${previewFile.fieldId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = previewFile.fileName;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download to View
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-6 text-center">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-700 font-medium mb-2">File Preview Not Available</p>
                      <p className="text-sm text-gray-500 mb-4">
                        This file type cannot be previewed in the browser. Please download to view.
                      </p>
                      <button
                        onClick={() => {
                          const token = localStorage.getItem('token');
                          fetch(`http://localhost:5000/api/admin/uploads/files/${previewFile.fieldId}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                          })
                            .then(response => response.blob())
                            .then(blob => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = previewFile.fileName;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download File
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">Failed to load preview</p>
                </div>
              )}
            </div>

            {/* Preview Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={closePreview}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

