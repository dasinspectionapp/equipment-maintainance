import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../utils/api';

interface FormData {
  agencyName: string;
  agencyCode: string;
  agencyType: string;
  status: string;
  contactPerson: string;
  mobileNumber: string;
  email: string;
  alternateContact: string;
  address: string;
  circles: string[];
  divisions: string[];
  equipmentTypes: string[];
  amcStartDate: string;
  amcEndDate: string;
  scopeOfWork: string;
}

const CIRCLES = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
const DIVISIONS = [
  'HSR', 'JAYANAGARA', 'KORAMANGALA', 'KENGERI', 'RAJAJINAGAR', 
  'RAJRAJESHWARANAGARA', 'INDIRANAGAR', 'PEENYA', 'JALHALLI', 
  'MALLESHWARAM', 'VIDHANASOUDHA', 'WHITEFIELD', 'SHIVAJINAGAR', 'HEBBAL'
];
const EQUIPMENT_TYPES = ['RMU', 'SPB', 'LRC & LBS'];

export default function AgencyMasterForm() {
  const navigate = useNavigate();
  const { id, mode } = useParams<{ id?: string; mode?: string }>();
  const isEditMode = !!id && mode === 'edit';
  const isViewMode = !!id && mode === 'view';
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>({
    agencyName: '',
    agencyCode: '',
    agencyType: 'AMC',
    status: 'Active',
    contactPerson: '',
    mobileNumber: '',
    email: '',
    alternateContact: '',
    address: '',
    circles: [],
    divisions: [],
    equipmentTypes: [],
    amcStartDate: '',
    amcEndDate: '',
    scopeOfWork: 'Both'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchAgency();
    }
  }, [id]);

  const fetchAgency = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/masters/agencies/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        const agency = data.data;
        setFormData({
          agencyName: agency.agencyName,
          agencyCode: agency.agencyCode,
          agencyType: agency.agencyType,
          status: agency.status,
          contactPerson: agency.contactPerson,
          mobileNumber: agency.mobileNumber,
          email: agency.email,
          alternateContact: agency.alternateContact || '',
          address: agency.address || '',
          circles: agency.circles || [],
          divisions: agency.divisions || [],
          equipmentTypes: agency.equipmentTypes || [],
          amcStartDate: agency.amcStartDate ? agency.amcStartDate.split('T')[0] : '',
          amcEndDate: agency.amcEndDate ? agency.amcEndDate.split('T')[0] : '',
          scopeOfWork: agency.scopeOfWork
        });
      } else {
        setError(data.error || 'Failed to fetch agency');
      }
    } catch (err) {
      console.error('Error fetching agency:', err);
      setError('Failed to fetch agency');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.agencyName.trim()) {
      newErrors.agencyName = 'Agency Name is required';
    }

    if (!formData.agencyCode.trim()) {
      newErrors.agencyCode = 'Agency Code is required';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact Person is required';
    }

    if (!formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile Number is required';
    } else if (!/^\d{10}$/.test(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Mobile Number must be exactly 10 digits';
    }

    if (formData.alternateContact && !/^\d{10}$/.test(formData.alternateContact)) {
      newErrors.alternateContact = 'Alternate Contact must be exactly 10 digits';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.amcStartDate) {
      newErrors.amcStartDate = 'AMC Start Date is required';
    }

    if (!formData.amcEndDate) {
      newErrors.amcEndDate = 'AMC End Date is required';
    }

    if (formData.amcStartDate && formData.amcEndDate) {
      if (new Date(formData.amcEndDate) <= new Date(formData.amcStartDate)) {
        newErrors.amcEndDate = 'AMC End Date must be after Start Date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fix the validation errors');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const token = localStorage.getItem('token');
      const url = isEditMode
        ? `${API_BASE}/api/masters/agencies/${id}`
        : `${API_BASE}/api/masters/agencies`;

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        navigate('/dashboard/agency-master');
      } else {
        setError(data.error || 'Failed to save agency');
        if (data.conflicts) {
          setError(`${data.error}\n${JSON.stringify(data.conflicts, null, 2)}`);
        }
      }
    } catch (err) {
      console.error('Error saving agency:', err);
      setError('Failed to save agency');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckboxChange = (field: keyof FormData, value: string) => {
    setFormData(prev => {
      const currentValues = prev[field] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isViewMode ? 'View Agency' : isEditMode ? 'Edit Agency' : 'Create New Agency'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isViewMode ? 'Agency details' : 'Fill in the agency information below'}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/agency-master')}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to List
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agency Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Agency Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agency Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.agencyName}
                  onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.agencyName ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter agency name"
                />
                {errors.agencyName && <p className="mt-1 text-sm text-red-600">{errors.agencyName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agency Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.agencyCode}
                  onChange={(e) => setFormData({ ...formData, agencyCode: e.target.value.toUpperCase() })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase ${
                    errors.agencyCode ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter agency code"
                />
                {errors.agencyCode && <p className="mt-1 text-sm text-red-600">{errors.agencyCode}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agency Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.agencyType}
                  onChange={(e) => setFormData({ ...formData, agencyType: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isViewMode ? 'bg-gray-100' : ''
                  }`}
                >
                  <option value="AMC">AMC</option>
                  <option value="Vendor">Vendor</option>
                  <option value="OEM">OEM</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isViewMode ? 'bg-gray-100' : ''
                  }`}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.contactPerson ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter contact person name"
                />
                {errors.contactPerson && <p className="mt-1 text-sm text-red-600">{errors.contactPerson}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '') })}
                  disabled={isViewMode}
                  maxLength={10}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.mobileNumber ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter 10-digit mobile number"
                />
                {errors.mobileNumber && <p className="mt-1 text-sm text-red-600">{errors.mobileNumber}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter email address"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alternate Contact
                </label>
                <input
                  type="tel"
                  value={formData.alternateContact}
                  onChange={(e) => setFormData({ ...formData, alternateContact: e.target.value.replace(/\D/g, '') })}
                  disabled={isViewMode}
                  maxLength={10}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.alternateContact ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter 10-digit alternate contact (optional)"
                />
                {errors.alternateContact && <p className="mt-1 text-sm text-red-600">{errors.alternateContact}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={isViewMode}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                  placeholder="Enter complete address"
                />
                {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
              </div>
            </div>
          </div>

          {/* Area Mapping */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Area Mapping</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Circles</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {CIRCLES.map((circle) => (
                    <label key={circle} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.circles.includes(circle)}
                        onChange={() => handleCheckboxChange('circles', circle)}
                        disabled={isViewMode}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{circle}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Divisions</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DIVISIONS.map((division) => (
                    <label key={division} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.divisions.includes(division)}
                        onChange={() => handleCheckboxChange('divisions', division)}
                        disabled={isViewMode}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{division}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Types</label>
                <div className="flex gap-3">
                  {EQUIPMENT_TYPES.map((type) => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.equipmentTypes.includes(type)}
                        onChange={() => handleCheckboxChange('equipmentTypes', type)}
                        disabled={isViewMode}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contract Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contract Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AMC Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.amcStartDate}
                  onChange={(e) => setFormData({ ...formData, amcStartDate: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.amcStartDate ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                />
                {errors.amcStartDate && <p className="mt-1 text-sm text-red-600">{errors.amcStartDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AMC End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.amcEndDate}
                  onChange={(e) => setFormData({ ...formData, amcEndDate: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.amcEndDate ? 'border-red-500' : 'border-gray-300'
                  } ${isViewMode ? 'bg-gray-100' : ''}`}
                />
                {errors.amcEndDate && <p className="mt-1 text-sm text-red-600">{errors.amcEndDate}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scope of Work <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.scopeOfWork}
                  onChange={(e) => setFormData({ ...formData, scopeOfWork: e.target.value })}
                  disabled={isViewMode}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isViewMode ? 'bg-gray-100' : ''
                  }`}
                >
                  <option value="Routine">Routine</option>
                  <option value="Breakdown">Breakdown</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          {!isViewMode && (
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard/agency-master')}
                disabled={submitting}
                className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : isEditMode ? 'Update Agency' : 'Create Agency'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

