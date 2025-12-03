import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date | string;
}

const API_BASE = 'http://localhost:5000';

export default function Upload() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/uploads`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        const json = await res.json();
        if (json?.success) {
          const files = (json.files || []).map((f: any) => ({
            id: f.fileId,
            name: f.name,
            size: f.size || 0,
            type: f.type || '',
            uploadedAt: f.uploadedAt || f.createdAt,
          }));
          setUploadedFiles(files);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        const fileObj: UploadedFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date(),
        };
        newFiles.push(fileObj);

        let fileRows: any[] = [];
        let headers: string[] = [];
        if (file.name.endsWith('.csv')) {
          const text = await file.text();
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            headers = lines[0].split(',');
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',');
              const row: any = { id: `${fileObj.id}-${i}` };
              headers.forEach((header, index) => {
                row[header.trim()] = values[index]?.trim() || '';
              });
              fileRows.push(row);
            }
          }
        } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (jsonData.length > 0) {
            const rawHeaders = jsonData[0] as string[];
            // CRITICAL: Handle duplicate column names by making them unique
            // This preserves all date columns (e.g., "DATE 15-11-2025", "DATE 16-11-2025")
            const headerCounts = new Map<string, number>();
            headers = rawHeaders.map((header, index) => {
              const headerStr = header ? String(header).trim() : `Column_${index + 1}`;
              const count = headerCounts.get(headerStr) || 0;
              headerCounts.set(headerStr, count + 1);
              // If duplicate, append index to make it unique
              return count === 0 ? headerStr : `${headerStr}_${count}`;
            });
            
            for (let i = 1; i < jsonData.length; i++) {
              const values = jsonData[i] as any[];
              const row: any = { id: `${fileObj.id}-${i}` };
              headers.forEach((header, index) => {
                row[header] = values[index] !== undefined && values[index] !== null ? values[index] : '';
              });
              fileRows.push(row);
            }
          }
        }
        // Persist this file to backend
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE}/api/uploads`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            fileId: fileObj.id,
            name: fileObj.name,
            size: fileObj.size,
            type: fileObj.type,
            headers,
            rows: fileRows,
          })
        });
      }

      // Refresh list from backend
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/uploads`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const json = await res.json();
      if (json?.success) {
        const files = (json.files || []).map((f: any) => ({
          id: f.fileId,
          name: f.name,
          size: f.size || 0,
          type: f.type || '',
          uploadedAt: f.uploadedAt || f.createdAt,
        }));
        setUploadedFiles(files);
      }

      alert(`Successfully uploaded ${newFiles.length} file(s)`);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files');
    } finally {
      setIsUploading(false);
    }
    event.target.value = '';
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/uploads/${fileId}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const res = await fetch(`${API_BASE}/api/uploads`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const json = await res.json();
      if (json?.success) {
        const files = (json.files || []).map((f: any) => ({
          id: f.fileId,
          name: f.name,
          size: f.size || 0,
          type: f.type || '',
          uploadedAt: f.uploadedAt || f.createdAt,
        }));
        setUploadedFiles(files);
      }
    } catch (e) {
      // ignore
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Device status Upload</h2>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
          <div className="mb-4">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          </div>
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-lg font-medium text-blue-600 hover:text-blue-700">
              Click to upload
            </span>
            <span className="block mt-2 text-sm text-gray-600">
              or drag and drop XLS, XLSX or CSV files here
            </span>
          </label>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="hidden"
            multiple
            accept=".xls,.xlsx,.csv"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <p className="mt-2 text-xs text-gray-500">
            Supports XLS, XLSX, and CSV files. Excel files will be read from the first sheet.
          </p>
        </div>
        {isUploading && (
          <div className="mt-4 text-center text-blue-600">
            <div className="inline-flex items-center">
              <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              Uploading files...
            </div>
          </div>
        )}
      </div>
      {uploadedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Uploaded Files</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                    Uploaded At
                  </th>
                  <th className="px-6 py-3" style={{ position: 'sticky', top: 0, background: '#f9fafb' }}></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uploadedFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {file.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {file.type || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {typeof file.uploadedAt === 'string' ? new Date(file.uploadedAt).toLocaleString() : file.uploadedAt.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-red-600 hover:text-red-800 font-bold border border-red-200 px-3 py-1 rounded transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

