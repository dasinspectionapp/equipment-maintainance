import { useState } from 'react';
import { API_BASE } from '../utils/api';

interface ParsedData {
  circle: string;
  division: string;
  subDivision?: string;
  siteCode: string;
  hrn: string;
  rmuMake?: string;
  equipmentType: string;
  installationDate?: string;
  commissioningDate?: string;
  maintenanceFrequency?: string;
  maintenanceStartingDate?: string;
  latitude?: number;
  longitude?: number;
  agencyCode?: string;
}

interface InvalidRow {
  row: number;
  data: ParsedData;
  errors: string[];
}

interface UploadResponse {
  success: boolean;
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRowsCount: number;
  validData: ParsedData[];
  invalidRows: InvalidRow[];
  message: string;
}

export default function RMUUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/masters/rmu/template`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'RMU_MASTER_IMPORT_TEMPLATE.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading template:', err);
      setError('Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx)$/)) {
        setError('Only .xlsx files are allowed');
        return;
      }
      setFile(selectedFile);
      setError('');
      setUploadResponse(null);
      setSuccessMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setParsing(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/masters/rmu/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setUploadResponse(data);
        if (data.invalidRowsCount === 0) {
          setSuccessMessage(`All ${data.validRows} rows are valid and ready to import!`);
        } else {
          setError(`Found ${data.invalidRowsCount} invalid rows. Please fix errors before importing.`);
        }
      } else {
        setError(data.error || 'Failed to parse Excel file');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!uploadResponse || !uploadResponse.validData || uploadResponse.validData.length === 0) {
      setError('No valid data to save');
      return;
    }

    try {
      setConfirming(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/masters/rmu/upload/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validData: uploadResponse.validData,
          batchId: uploadResponse.batchId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        setError(`❌ ${errorData.error || 'Failed to import RMU records. Server returned an error.'}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const data = await response.json();
      console.log('Import success response:', data);

      if (data.success) {
        setSuccessMessage(`Successfully imported ${data.count} RMU records!`);
        setUploadResponse(null);
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        console.error('Import failed:', data);
        setError(`❌ ${data.error || 'Failed to import RMU records. Please try again.'}`);
        // Scroll to top to show error message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error('Error confirming upload:', err);
      setError(`❌ Failed to import RMU records. ${err.message || 'Please check your connection and try again.'}`);
      // Scroll to top to show error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResponse(null);
    setError('');
    setSuccessMessage('');
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">RMU Master Upload</h1>
          <p className="text-gray-600 mt-1">Import RMU data using Excel template</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-6 bg-green-50 border-2 border-green-500 rounded-lg shadow-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-500 text-white text-2xl">
                    ✓
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900">Import Successful!</h3>
                  <p className="text-green-700 font-medium">{successMessage}</p>
                </div>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-green-700 hover:text-green-900 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-6 bg-red-50 border-2 border-red-500 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-500 text-white text-2xl">
                    ✕
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-900">Import Failed!</h3>
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-700 hover:text-red-900 text-2xl font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Download Template</h2>
          <p className="text-gray-600 mb-4">
            Download the Excel template, fill in your RMU data, and upload it back.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md flex items-center gap-2"
          >
            <span>📥</span>
            Download Excel Template
          </button>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Upload Filled Excel</h2>
          
          <div className="mb-4">
            <label
              htmlFor="file-upload"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Excel File (.xlsx only)
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none p-2"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleUpload}
              disabled={!file || parsing}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {parsing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Parsing...
                </>
              ) : (
                <>
                  <span>📤</span>
                  Parse & Validate
                </>
              )}
            </button>
            
            {(file || uploadResponse) && (
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-md"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Preview & Validation Results */}
        {uploadResponse && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold text-blue-600">{uploadResponse.totalRows}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Valid Rows</p>
                  <p className="text-2xl font-bold text-green-600">{uploadResponse.validRows}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Invalid Rows</p>
                  <p className="text-2xl font-bold text-red-600">{uploadResponse.invalidRowsCount}</p>
                </div>
              </div>
            </div>

            {/* Invalid Rows Table */}
            {uploadResponse.invalidRows && uploadResponse.invalidRows.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-red-600 mb-4">
                  ❌ Invalid Rows ({uploadResponse.invalidRows.length})
                </h2>
                <p className="text-gray-600 mb-4">
                  The following rows contain errors. Please fix them in your Excel file and re-upload.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Row #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Site Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">HRN</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadResponse.invalidRows.map((invalidRow, index) => (
                        <tr key={index} className="hover:bg-red-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {invalidRow.row}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {invalidRow.data.siteCode || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {invalidRow.data.hrn || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600">
                            <ul className="list-disc list-inside">
                              {invalidRow.errors.map((err, errIndex) => (
                                <li key={errIndex}>{err}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valid Data Preview */}
            {uploadResponse.validData && uploadResponse.validData.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-green-600 mb-4">
                  ✅ Valid Rows Preview ({uploadResponse.validRows})
                </h2>
                <p className="text-gray-600 mb-4">
                  Showing first 10 valid rows that will be imported.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Site Code</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">HRN</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Circle</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Division</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Equipment Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Maintenance Freq.</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadResponse.validData.slice(0, 10).map((row, index) => (
                        <tr key={index} className="hover:bg-green-50">
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{row.siteCode}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.hrn}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.circle}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.division}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {row.equipmentType}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.maintenanceFrequency || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadResponse.validData.length > 10 && (
                    <p className="mt-2 text-sm text-gray-600 text-center">
                      ... and {uploadResponse.validData.length - 10} more rows
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Confirm Button */}
            {uploadResponse.validRows > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 3: Confirm Import</h2>
                <p className="text-gray-600 mb-4">
                  {uploadResponse.invalidRowsCount > 0 ? (
                    <span className="text-red-600">
                      ⚠️ You have {uploadResponse.invalidRowsCount} invalid rows. Please fix them before importing.
                    </span>
                  ) : (
                    <span className="text-green-600">
                      ✅ All rows are valid. Click the button below to import {uploadResponse.validRows} records.
                    </span>
                  )}
                </p>
                <button
                  onClick={handleConfirm}
                  disabled={uploadResponse.invalidRowsCount > 0 || confirming}
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                >
                  {confirming ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <span>✅</span>
                      Confirm & Import {uploadResponse.validRows} Records
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

