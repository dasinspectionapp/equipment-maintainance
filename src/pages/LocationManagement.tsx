import { useState, useRef } from 'react';
import BackButton from '../components/BackButton';

interface UploadResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    processed: number;
    inserted: number;
    updated: number;
    errors?: string[];
    kmlFilePath: string;
    locations: number;
  };
}

export default function LocationManagement() {
  const [uploadType, setUploadType] = useState<'excel' | 'kml'>('excel');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type based on upload type
      const fileExtension = selectedFile.name.toLowerCase().split('.').pop();
      
      if (uploadType === 'excel') {
        if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
          setMessage({ type: 'error', text: 'Please select a valid Excel file (.xlsx or .xls)' });
          setFile(null);
          setPreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      } else if (uploadType === 'kml') {
        if (fileExtension !== 'kml') {
          setMessage({ type: 'error', text: 'Please select a valid KML file (.kml)' });
          setFile(null);
          setPreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      }

      setFile(selectedFile);
      setPreview(selectedFile.name);
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file to upload' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('file', file);

      const endpoint = uploadType === 'excel' 
        ? 'http://localhost:5000/api/admin/upload-excel'
        : 'http://localhost:5000/api/admin/upload-kml';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data: UploadResponse = await response.json();

      if (response.ok && data.success) {
        const { processed, inserted, updated, errors, kmlFilePath } = data.data || {};
        let successMessage = `Successfully processed ${processed} location(s). `;
        successMessage += `Inserted: ${inserted}, Updated: ${updated}.`;
        
        if (kmlFilePath) {
          successMessage += ` KML file generated: ${kmlFilePath}`;
        }

        if (errors && errors.length > 0) {
          successMessage += `\n\nErrors encountered: ${errors.length} row(s) had issues.`;
        }

        setMessage({ type: 'success', text: successMessage });
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to upload file' });
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to upload file. Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadTypeChange = (type: 'excel' | 'kml') => {
    setUploadType(type);
    setFile(null);
    setPreview(null);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-8">
      <BackButton />
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Location Management</h2>
        <p className="text-gray-600">Upload Excel or KML file with location data</p>
      </div>

      {/* Upload Type Tabs */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-1 inline-flex">
        <button
          type="button"
          onClick={() => handleUploadTypeChange('excel')}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            uploadType === 'excel'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          Upload Excel
        </button>
        <button
          type="button"
          onClick={() => handleUploadTypeChange('kml')}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            uploadType === 'kml'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          Upload KML
        </button>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {message.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium whitespace-pre-line">{message.text}</p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Input */}
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
              {uploadType === 'excel' ? 'Excel File (.xlsx or .xls)' : 'KML File (.kml)'}
            </label>
            <div className="mt-1 flex items-center space-x-4">
              <input
                ref={fileInputRef}
                id="file"
                name="file"
                type="file"
                accept={uploadType === 'excel' ? '.xlsx,.xls' : '.kml'}
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                disabled={uploading}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {uploadType === 'excel' ? (
                <>
                  Required columns: <strong>Latitude</strong>, <strong>Longitude</strong>, <strong>Name/Site Code</strong>, <strong>HRN/Description</strong> (optional)
                </>
              ) : (
                <>
                  KML file should contain <strong>Placemark</strong> elements with <strong>name</strong> (Site Code), <strong>description</strong> (HRN), and <strong>coordinates</strong> (longitude,latitude)
                </>
              )}
            </p>
          </div>

          {/* File Preview */}
          {preview && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{preview}</p>
                    <p className="text-xs text-gray-500">
                      {file ? `${(file.size / 1024).toFixed(2)} KB` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-gray-400 hover:text-gray-500"
                  disabled={uploading}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={!file || uploading}
              className={`px-6 py-2.5 rounded-lg font-semibold text-white transition-colors ${
                !file || uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              {uploading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Upload & Process'
              )}
            </button>
            {file && (
              <button
                type="button"
                onClick={handleReset}
                disabled={uploading}
                className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Instructions</h3>
        {uploadType === 'excel' ? (
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Excel file must contain columns: <strong>Latitude</strong>, <strong>Longitude</strong>, <strong>Name/Site Code</strong>, and optionally <strong>HRN/Description</strong></span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Column names are case-insensitive. "Name" or "Site Code" can be used for the name column. "Description" or "HRN" can be used for the description column.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Latitude must be between -90 and 90</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Longitude must be between -180 and 180</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>If a location with the same Name already exists, it will be updated</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>A KML file will be automatically generated and saved on the server</span>
            </li>
          </ul>
        ) : (
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>KML file must be in valid XML format with <strong>Placemark</strong> elements</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Each Placemark should contain: <strong>&lt;name&gt;</strong> (Site Code), <strong>&lt;description&gt;</strong> (HRN, optional), and <strong>&lt;coordinates&gt;</strong> (longitude,latitude,altitude)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Coordinates format: <strong>longitude,latitude,altitude</strong> (e.g., "77.6208384,12.9204224,0")</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Latitude must be between -90 and 90, Longitude must be between -180 and 180</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>If a location with the same Name (Site Code) already exists, it will be updated</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>A standardized KML file will be automatically generated and saved on the server</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

