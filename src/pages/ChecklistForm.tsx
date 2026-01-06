import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiSave } from 'react-icons/fi';
import BackButton from '../components/BackButton';
import { API_BASE } from '../utils/api';

interface Parameter {
  _id?: string;
  label: string;
  key: string;
  inputType: 'ENUM' | 'BOOLEAN' | 'TEXT';
  options: string[];
  photoRequired: boolean;
  critical: boolean;
  active: boolean;
}

interface Checklist {
  _id?: string;
  checklistName: string;
  maintenanceType: 'ROUTINE' | 'BREAKDOWN';
  equipmentType: string;
  status: 'ACTIVE' | 'INACTIVE';
  parameters: Parameter[];
}

const ChecklistForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('view') === 'true';
  const isEditMode = !!id && !isViewMode;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<Checklist>({
    checklistName: '',
    maintenanceType: 'ROUTINE',
    equipmentType: 'RMU',
    status: 'ACTIVE',
    parameters: []
  });

  const [showParameterModal, setShowParameterModal] = useState(false);
  const [editingParameter, setEditingParameter] = useState<Parameter | null>(null);
  const [editingParameterIndex, setEditingParameterIndex] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      fetchChecklist();
    }
  }, [id]);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/admin/checklists/${id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setChecklist(data.data);
      } else {
        alert(data.error || 'Failed to fetch checklist');
        navigate('/dashboard/checklist-management');
      }
    } catch (error) {
      console.error('Error fetching checklist:', error);
      alert('Failed to fetch checklist');
      navigate('/dashboard/checklist-management');
    } finally {
      setLoading(false);
    }
  };

  const generateKey = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!checklist.checklistName.trim()) {
      alert('Please enter checklist name');
      return;
    }

    if (checklist.parameters.length === 0) {
      alert('Please add at least one parameter');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const url = isEditMode
        ? `${API_BASE}/api/admin/checklists/${id}`
        : `${API_BASE}/api/admin/checklists`;

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(checklist)
      });

      const data = await response.json();

      if (data.success) {
        alert(isEditMode ? 'Checklist updated successfully' : 'Checklist created successfully');
        navigate('/dashboard/checklist-management');
      } else {
        alert(data.error || 'Failed to save checklist');
      }
    } catch (error) {
      console.error('Error saving checklist:', error);
      alert('Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };

  const handleAddParameter = () => {
    setEditingParameter(null);
    setEditingParameterIndex(null);
    setShowParameterModal(true);
  };

  const handleEditParameter = (param: Parameter, index: number) => {
    setEditingParameter(param);
    setEditingParameterIndex(index);
    setShowParameterModal(true);
  };

  const handleDeleteParameter = async (index: number) => {
    if (!confirm('Are you sure you want to delete this parameter?')) return;

    const param = checklist.parameters[index];

    // If editing existing checklist with saved parameter
    if (isEditMode && param._id) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${API_BASE}/api/admin/checklists/${id}/parameters/${param._id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (data.success) {
          alert(data.message || 'Parameter deleted successfully');
          fetchChecklist();
        } else {
          alert(data.error || 'Failed to delete parameter');
        }
      } catch (error) {
        console.error('Error deleting parameter:', error);
        alert('Failed to delete parameter');
      }
    } else {
      // Remove from local state for new checklist
      const newParameters = [...checklist.parameters];
      newParameters.splice(index, 1);
      setChecklist({ ...checklist, parameters: newParameters });
    }
  };

  const handleSaveParameter = (parameter: Parameter) => {
    if (editingParameterIndex !== null) {
      // Update existing parameter
      const newParameters = [...checklist.parameters];
      newParameters[editingParameterIndex] = parameter;
      setChecklist({ ...checklist, parameters: newParameters });
    } else {
      // Add new parameter
      setChecklist({
        ...checklist,
        parameters: [...checklist.parameters, parameter]
      });
    }
    setShowParameterModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackButton />
          <div className="flex justify-between items-center mt-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {isViewMode ? 'View Checklist' : isEditMode ? 'Edit Checklist' : 'Add Checklist'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {isViewMode ? 'View checklist details' : 'Configure checklist and parameters'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Checklist Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Checklist Details
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Checklist Name *
                </label>
                <input
                  type="text"
                  value={checklist.checklistName}
                  onChange={(e) => setChecklist({ ...checklist, checklistName: e.target.value })}
                  disabled={isViewMode}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter checklist name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maintenance Type *
                </label>
                <select
                  value={checklist.maintenanceType}
                  onChange={(e) => setChecklist({ ...checklist, maintenanceType: e.target.value as 'ROUTINE' | 'BREAKDOWN' })}
                  disabled={isViewMode}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="ROUTINE">Routine</option>
                  <option value="BREAKDOWN">Breakdown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Equipment Type *
                </label>
                <select
                  value={checklist.equipmentType}
                  onChange={(e) => setChecklist({ ...checklist, equipmentType: e.target.value })}
                  disabled={isViewMode}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="RMU">RMU</option>
                  <option value="SPB">SPB</option>
                  <option value="LRC & LBS">LRC & LBS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status *
                </label>
                <select
                  value={checklist.status}
                  onChange={(e) => setChecklist({ ...checklist, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  disabled={isViewMode}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Parameters Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Parameters
              </h2>
              {!isViewMode && (
                <button
                  type="button"
                  onClick={handleAddParameter}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FiPlus />
                  Add Parameter
                </button>
              )}
            </div>

            {checklist.parameters.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No parameters added yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Label
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Key
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Input Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Options
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Photo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Critical
                      </th>
                      {!isViewMode && (
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {checklist.parameters.map((param, index) => (
                      <tr key={param._id || index} className={!param.active ? 'opacity-50' : ''}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {param.label}
                          {!param.active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {param.key}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            param.inputType === 'ENUM'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : param.inputType === 'BOOLEAN'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {param.inputType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {param.inputType === 'ENUM' ? param.options.join(', ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {param.photoRequired ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {param.critical ? (
                            <span className="text-red-600 dark:text-red-400">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        {!isViewMode && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditParameter(param, index)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                title="Edit"
                              >
                                <FiEdit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteParameter(index)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form Actions */}
          {!isViewMode && (
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard/checklist-management')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || checklist.parameters.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSave />
                {saving ? 'Saving...' : isEditMode ? 'Update Checklist' : 'Create Checklist'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Parameter Modal */}
      {showParameterModal && (
        <ParameterModal
          parameter={editingParameter}
          existingKeys={checklist.parameters
            .filter((_, idx) => idx !== editingParameterIndex)
            .map(p => p.key)}
          onSave={handleSaveParameter}
          onClose={() => setShowParameterModal(false)}
          generateKey={generateKey}
        />
      )}
    </div>
  );
};

// Parameter Modal Component
interface ParameterModalProps {
  parameter: Parameter | null;
  existingKeys: string[];
  onSave: (parameter: Parameter) => void;
  onClose: () => void;
  generateKey: (label: string) => string;
}

const ParameterModal = ({ parameter, existingKeys, onSave, onClose, generateKey }: ParameterModalProps) => {
  const [formData, setFormData] = useState<Parameter>(
    parameter || {
      label: '',
      key: '',
      inputType: 'TEXT',
      options: [],
      photoRequired: false,
      critical: false,
      active: true
    }
  );
  const [optionInput, setOptionInput] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);

  const handleLabelChange = (label: string) => {
    setFormData({ ...formData, label });
    if (!keyEdited && !parameter) {
      // Auto-generate key only for new parameters
      setFormData({ ...formData, label, key: generateKey(label) });
    }
  };

  const handleAddOption = () => {
    if (optionInput.trim()) {
      setFormData({
        ...formData,
        options: [...formData.options, optionInput.trim()]
      });
      setOptionInput('');
    }
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = [...formData.options];
    newOptions.splice(index, 1);
    setFormData({ ...formData, options: newOptions });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.label.trim()) {
      alert('Please enter parameter label');
      return;
    }

    if (!formData.key.trim()) {
      alert('Please enter parameter key');
      return;
    }

    if (existingKeys.includes(formData.key)) {
      alert('A parameter with this key already exists');
      return;
    }

    if (formData.inputType === 'ENUM' && formData.options.length < 2) {
      alert('ENUM type must have at least 2 options');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {parameter ? 'Edit Parameter' : 'Add Parameter'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parameter Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Panel external condition"
                required
              />
            </div>

            {/* Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parameter Key *
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => {
                  setFormData({ ...formData, key: e.target.value });
                  setKeyEdited(true);
                }}
                disabled={!!parameter}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                placeholder="e.g., panel_condition"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {parameter ? 'Key cannot be changed after creation' : 'Auto-generated from label, but editable'}
              </p>
            </div>

            {/* Input Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Input Type *
              </label>
              <select
                value={formData.inputType}
                onChange={(e) => setFormData({ ...formData, inputType: e.target.value as any, options: [] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="TEXT">Text</option>
                <option value="BOOLEAN">Boolean (Yes/No)</option>
                <option value="ENUM">Enum (Multiple Choice)</option>
              </select>
            </div>

            {/* Options (for ENUM) */}
            {formData.inputType === 'ENUM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Options * (minimum 2)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter option and press Enter"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.options.map((option, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                    >
                      <span>{option}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo Required */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="photoRequired"
                checked={formData.photoRequired}
                onChange={(e) => setFormData({ ...formData, photoRequired: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="photoRequired" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Photo Required
              </label>
            </div>

            {/* Critical */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="critical"
                checked={formData.critical}
                onChange={(e) => setFormData({ ...formData, critical: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="critical" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Critical Parameter
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {parameter ? 'Update' : 'Add'} Parameter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChecklistForm;

