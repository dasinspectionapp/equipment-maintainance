import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';
import { compressImage } from '../utils/imageCompression';

interface ChecklistParameter {
  _id: string;
  label: string;
  key: string;
  inputType: 'ENUM' | 'BOOLEAN' | 'TEXT';
  options?: string[];
  photoRequired: boolean;
  critical: boolean;
}

interface TaskDetail {
  task: {
    _id: string;
    siteCode: string;
    equipmentType: string;
    maintenanceType: string;
    dueDate: string;
    status?: string;
    submittedAt?: string;
    submittedBy?: string;
  };
  checklist: {
    _id: string;
    checklistName: string;
    parameters: ChecklistParameter[];
  };
  execution?: {
    responses: any[];
    submittedAt: string;
    submittedBy: string;
  };
  isReadOnly?: boolean;
}

interface ParameterResponse {
  parameterKey: string;
  value: any;
  photo?: string;
  remarks?: string;
}

export default function AMCTaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [responses, setResponses] = useState<{ [key: string]: ParameterResponse }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [isReadOnly, setIsReadOnly] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'AMC') {
      navigate('/dashboard');
      return;
    }

    fetch(`${API_BASE}/api/amc/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTask(data.data);
          setIsReadOnly(data.data.isReadOnly || false);
          
          // Initialize responses
          const initialResponses: { [key: string]: ParameterResponse } = {};
          
          if (data.data.execution && data.data.execution.responses) {
            // Task is submitted - populate with submitted responses
            data.data.execution.responses.forEach((resp: any) => {
              initialResponses[resp.parameterKey] = {
                parameterKey: resp.parameterKey,
                value: resp.value,
                photo: resp.photo,
                remarks: resp.remarks || '',
              };
            });
          } else {
            // New task - initialize with empty values
            data.data.checklist.parameters.forEach((param: ChecklistParameter) => {
              initialResponses[param.key] = {
                parameterKey: param.key,
                value: param.inputType === 'BOOLEAN' ? false : '',
                photo: undefined,
                remarks: '',
              };
            });
          }
          setResponses(initialResponses);
        } else {
          setError(data.error || 'Failed to load task');
        }
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load task details');
        setLoading(false);
      });
  }, [taskId, navigate]);

  const handleInputChange = (key: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
    // Clear validation error for this field
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  };

  const handlePhotoChange = async (key: string, file: File | null) => {
    if (!file) {
      setResponses((prev) => ({
        ...prev,
        [key]: { ...prev[key], photo: undefined },
      }));
      return;
    }

    try {
      // Compress image: maxSizeBytes = 1MB (1000000), maxWidth = 1920, maxHeight = 1920
      const compressedDataUrl = await compressImage(file, 1000000, 1920, 1920);
      
      setResponses((prev) => ({
        ...prev,
        [key]: { ...prev[key], photo: compressedDataUrl },
      }));
      
      // Clear validation error
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${key}_photo`];
        return newErrors;
      });
    } catch (err) {
      console.error('Image compression failed:', err);
      alert('Failed to process image. Please try a smaller image or different format (JPEG/PNG recommended).');
    }
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!task) return false;

    task.checklist.parameters.forEach((param) => {
      const response = responses[param.key];
      
      // Check if value is provided
      if (response.value === '' || response.value === null || response.value === undefined) {
        errors[param.key] = 'This field is required';
      }

      // Check if photo is required and provided
      if (param.photoRequired && !response.photo) {
        errors[`${param.key}_photo`] = 'Photo is required for this parameter';
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert('Please fill in all required fields and upload mandatory photos.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const responsesArray = Object.values(responses);
      const res = await fetch(`${API_BASE}/api/amc/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ responses: responsesArray }),
      });

      const data = await res.json();

      if (data.success) {
        alert('Checklist submitted successfully!');
        navigate('/dashboard/amc/tasks');
      } else {
        setError(data.error || 'Failed to submit checklist');
        alert(data.error || 'Failed to submit checklist');
      }
    } catch (err) {
      setError('Failed to submit checklist');
      alert('Failed to submit checklist. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Task not found'}</p>
            <button
              onClick={() => navigate('/dashboard/amc/tasks')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard/amc/tasks')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Back to Tasks
          </button>
          <div className={`rounded-lg shadow p-6 ${isReadOnly ? 'bg-green-50 border-2 border-green-400' : 'bg-white'}`}>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {isReadOnly ? '📄 View Submitted Checklist' : 'Fill Maintenance Checklist'}
            </h1>
            {isReadOnly && task.task.submittedAt && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">✓ Submitted:</span> {new Date(task.task.submittedAt).toLocaleString('en-IN')}
                  {task.task.submittedBy && ` by ${task.task.submittedBy}`}
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  <span className="font-semibold">Status:</span> Waiting for approval
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Site Code</p>
                <p className="font-semibold">{task.task.siteCode}</p>
              </div>
              <div>
                <p className="text-gray-600">Equipment Type</p>
                <p className="font-semibold">{task.task.equipmentType}</p>
              </div>
              <div>
                <p className="text-gray-600">Maintenance Type</p>
                <p className="font-semibold">{task.task.maintenanceType}</p>
              </div>
              <div>
                <p className="text-gray-600">Due Date</p>
                <p className="font-semibold text-red-600">
                  {new Date(task.task.dueDate).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-gray-600">Checklist</p>
              <p className="font-semibold text-lg">{task.checklist.checklistName}</p>
            </div>
          </div>
        </div>

        {/* Checklist Parameters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-6">Checklist Parameters</h2>
          <div className="space-y-6">
            {task.checklist.parameters.map((param, index) => (
              <div
                key={param._id}
                className={`p-4 border rounded-lg ${
                  param.critical ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <label className="block font-semibold text-gray-900">
                      {index + 1}. {param.label}
                      {param.critical && (
                        <span className="ml-2 text-xs px-2 py-1 bg-red-600 text-white rounded">
                          CRITICAL
                        </span>
                      )}
                    </label>
                  </div>
                </div>

                {/* Input based on type */}
                {param.inputType === 'BOOLEAN' && (
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={param.key}
                        checked={responses[param.key]?.value === true}
                        onChange={() => !isReadOnly && handleInputChange(param.key, true)}
                        disabled={isReadOnly}
                        className="w-4 h-4"
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={param.key}
                        checked={responses[param.key]?.value === false}
                        onChange={() => !isReadOnly && handleInputChange(param.key, false)}
                        disabled={isReadOnly}
                        className="w-4 h-4"
                      />
                      <span>No</span>
                    </label>
                  </div>
                )}

                {param.inputType === 'ENUM' && (
                  <select
                    value={responses[param.key]?.value || ''}
                    onChange={(e) => handleInputChange(param.key, e.target.value)}
                    disabled={isReadOnly}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isReadOnly ? 'bg-gray-100 cursor-not-allowed' :
                      validationErrors[param.key] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select an option</option>
                    {param.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {param.inputType === 'TEXT' && (
                  <textarea
                    value={responses[param.key]?.value || ''}
                    onChange={(e) => handleInputChange(param.key, e.target.value)}
                    disabled={isReadOnly}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isReadOnly ? 'bg-gray-100 cursor-not-allowed' :
                      validationErrors[param.key] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder={isReadOnly ? '' : "Enter your response"}
                  />
                )}

                {validationErrors[param.key] && (
                  <p className="text-red-600 text-sm mt-1">{validationErrors[param.key]}</p>
                )}

                {/* Photo Upload */}
                {param.photoRequired && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photo {param.photoRequired && <span className="text-red-600">*</span>}
                    </label>
                    {!isReadOnly && (
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={(el) => (fileInputRefs.current[param.key] = el)}
                        onChange={(e) => handlePhotoChange(param.key, e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    )}
                    {responses[param.key]?.photo && (
                      <div className="mt-2">
                        <img
                          src={responses[param.key].photo}
                          alt="Preview"
                          className="max-w-xs rounded-lg border"
                        />
                      </div>
                    )}
                    {validationErrors[`${param.key}_photo`] && (
                      <p className="text-red-600 text-sm mt-1">
                        {validationErrors[`${param.key}_photo`]}
                      </p>
                    )}
                  </div>
                )}

                {/* Remarks */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={responses[param.key]?.remarks || ''}
                    onChange={(e) =>
                      setResponses((prev) => ({
                        ...prev,
                        [param.key]: { ...prev[param.key], remarks: e.target.value },
                      }))
                    }
                    disabled={isReadOnly}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                      isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder={isReadOnly ? '' : "Add any additional notes"}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          {!isReadOnly ? (
            <div className="mt-8 flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
              >
                {submitting ? 'Submitting...' : 'Submit Checklist'}
              </button>
              <button
                onClick={() => navigate('/dashboard/amc/tasks')}
                disabled={submitting}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-8">
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm">
                  <span className="font-semibold">⏳ Status:</span> This checklist has been submitted and is waiting for admin approval. You cannot make changes at this time.
                </p>
              </div>
              <button
                onClick={() => navigate('/dashboard/amc/tasks')}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Back to Tasks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

