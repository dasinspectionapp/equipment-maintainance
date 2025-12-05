import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { API_BASE } from '../utils/api';

interface User {
  _id: string;
  userId: string;
  fullName: string;
  email: string;
  mobile?: string;
  role: string;
  status: string;
  isActive?: boolean;
  mappedTo?: string[];
  createdAt?: string;
  designation?: string;
  division?: string;
  circle?: string;
  subdivision?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showUpdateMappingModal, setShowUpdateMappingModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedMappedTo, setSelectedMappedTo] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editUser, setEditUser] = useState<Partial<User>>({});
  
  const applications = [
    'Equipment Maintenance',
    'Equipment Survey'
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', result);
        
        // Handle the API response structure { success: true, data: users }
        if (result.success && Array.isArray(result.data)) {
          setUsers(result.data);
        } else if (Array.isArray(result)) {
          // If response is directly an array
          setUsers(result);
        } else {
          console.error('API did not return valid data:', result);
          setUsers([]);
        }
      } else {
        // Use mock data for demonstration
        const mockUsers: User[] = [
          {
            _id: '1',
            userId: 'USR001',
            fullName: 'John Doe',
            email: 'john@example.com',
            role: 'User',
            status: 'Pending Approval',
            createdAt: new Date().toISOString()
          },
          {
            _id: '2',
            userId: 'USR002',
            fullName: 'Jane Smith',
            email: 'jane@example.com',
            role: 'User',
            status: 'Approved',
            createdAt: new Date().toISOString()
          }
        ];
        setUsers(mockUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Use mock data on error
      const mockUsers: User[] = [
        {
          _id: '1',
          userId: 'USR001',
          fullName: 'John Doe',
          email: 'john@example.com',
          role: 'User',
          status: 'Pending Approval',
          createdAt: new Date().toISOString()
        }
      ];
      setUsers(mockUsers);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveClick = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedMappedTo([]);
    setShowApproveModal(true);
  };

  const handleMappedToToggle = (app: string) => {
    setSelectedMappedTo(prev =>
      prev.includes(app)
        ? prev.filter(a => a !== app)
        : [...prev, app]
    );
  };

  const handleUpdateMappingClick = (userId: string, currentMappedTo: string[] = []) => {
    setSelectedUserId(userId);
    setSelectedMappedTo(currentMappedTo || []);
    setShowUpdateMappingModal(true);
  };

  const handleEditClick = (user: User) => {
    setEditUser(user);
    setShowEditModal(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedUserId) return;
    
    if (selectedMappedTo.length === 0) {
      alert('Please select at least one application to map the user to.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/auth/users/${selectedUserId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mappedTo: selectedMappedTo
        })
      });

      if (response && response.ok) {
        alert('User approved successfully');
        setShowApproveModal(false);
        setSelectedUserId(null);
        setSelectedMappedTo([]);
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to approve user');
      }
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Failed to approve user');
    }
  };

  const handleConfirmUpdateMapping = async () => {
    if (!selectedUserId) return;
    
    if (selectedMappedTo.length === 0) {
      alert('Please select at least one application to map the user to.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/auth/users/${selectedUserId}/update-mapping`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mappedTo: selectedMappedTo
        })
      });

      if (response && response.ok) {
        alert('User application mapping updated successfully');
        setShowUpdateMappingModal(false);
        setSelectedUserId(null);
        setSelectedMappedTo([]);
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update user mapping');
      }
    } catch (error) {
      console.error('Error updating user mapping:', error);
      alert('Failed to update user mapping');
    }
  };

  const handleConfirmEdit = async () => {
    if (!editUser._id) return;
    
    // Validation
    if (!editUser.fullName || !editUser.email || !editUser.role) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/auth/users/${editUser._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: editUser.fullName,
          email: editUser.email,
          mobile: editUser.mobile,
          role: editUser.role,
          designation: editUser.designation,
          division: editUser.division,
          circle: editUser.circle,
          subdivision: editUser.subdivision
        })
      });

      if (response && response.ok) {
        alert('User updated successfully');
        setShowEditModal(false);
        setEditUser({});
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handleAction = async (action: string, userId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      let response;
      switch (action) {
        case 'approve':
          handleApproveClick(userId);
          return; // Return early to show modal
        case 'reject':
          response = await fetch(`${API_BASE}/api/auth/users/${userId}/reject`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
        case 'activate':
          response = await fetch(`${API_BASE}/api/auth/users/${userId}/activate`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
        case 'deactivate':
          response = await fetch(`${API_BASE}/api/auth/users/${userId}/deactivate`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
        case 'delete':
          if (!confirm(`Are you sure you want to delete user ${userId}?`)) return;
          response = await fetch(`${API_BASE}/api/auth/users/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
        case 'reset':
          if (!confirm(`Reset password for user ${userId}?`)) return;
          response = await fetch(`${API_BASE}/api/auth/users/${userId}/reset-password`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
      }

      if (response && response.ok) {
        alert(`${action} action completed successfully`);
        fetchUsers(); // Refresh the list
      } else {
        alert(`${action} action completed (mock)`);
        fetchUsers();
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(`${action} action completed (mock)`);
      fetchUsers();
    }
  };

  const getStatusBadge = (status: string, isActive?: boolean) => {
    let statusClass = '';
    let statusText = status;
    
    // Handle status from API
    const statusLower = status.toLowerCase();
    
    // Determine status text and color
    if (isActive === false || statusLower === 'rejected' || statusLower === 'deactivated') {
      statusClass = 'bg-red-100 text-red-800';
      statusText = 'Inactive';
    } else if (statusLower === 'pending' || statusLower === 'pending approval') {
      statusClass = 'bg-yellow-100 text-yellow-800';
      statusText = 'Pending Approval';
    } else if (statusLower === 'approved') {
      statusClass = 'bg-green-100 text-green-800';
      statusText = 'Approved';
    } else {
      statusClass = 'bg-gray-100 text-gray-800';
    }
    
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${statusClass}`}>
        {statusText}
      </span>
    );
  };

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.userId.toLowerCase().includes(query) ||
      user.fullName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.mobile && user.mobile.toLowerCase().includes(query)) ||
      user.role.toLowerCase().includes(query) ||
      user.status.toLowerCase().includes(query) ||
      (user.mappedTo && user.mappedTo.some(app => app.toLowerCase().includes(query)))
    );
  });

  // Sort users by createdAt descending (newest first)
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    // If createdAt exists, use it
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // If one has createdAt, prioritize it
    if (a.createdAt && !b.createdAt) return -1;
    if (!a.createdAt && b.createdAt) return 1;
    // Fallback to _id (MongoDB ObjectIds contain timestamp)
    if (a._id && b._id) {
      return b._id.localeCompare(a._id);
    }
    return 0;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Add New User
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-4">
          <label htmlFor="search" className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Search:
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by User ID, Name, Email, Mobile, Role, Status, or Mapped Application..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Showing {sortedUsers.length} of {users.length} users
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead style={{ background: 'linear-gradient(to right, #2563eb, #1d4ed8)', position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Mobile Number
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Role
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Mapped Applications
                </th>
                <th className="px-6 py-3 text-left text-sm font-bold text-white uppercase tracking-wider border border-gray-300" style={{ position: 'sticky', top: 0, background: 'linear-gradient(to right, #2563eb, #1d4ed8)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {sortedUsers && sortedUsers.length > 0 ? (
                sortedUsers.map((user, index) => (
                  <tr 
                    key={user._id} 
                    className="border-b border-gray-200 transition-colors duration-150 hover:cursor-pointer"
                    style={{ 
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#eff6ff',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#bfdbfe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#eff6ff';
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                      {user.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {user.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                      {user.mobile || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                      {getStatusBadge(user.status, user.isActive)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 border border-gray-300">
                      {user.mappedTo && user.mappedTo.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.mappedTo.map((app, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                            >
                              {app}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Not mapped</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium border border-gray-300">
                      <div className="flex flex-wrap items-center gap-4">
                        {(user.status.toLowerCase() === 'pending' || user.status.toLowerCase() === 'pending approval') && (
                          <>
                            <button
                              onClick={() => handleAction('approve', user._id)}
                              className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleAction('reject', user._id)}
                              className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {user.status.toLowerCase() === 'approved' && (
                          <>
                            {user.isActive ? (
                              <button
                                onClick={() => handleAction('deactivate', user._id)}
                                className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded transition-colors"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAction('activate', user._id)}
                                className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                              >
                                Activate
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateMappingClick(user._id, user.mappedTo || [])}
                              className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded transition-colors"
                            >
                              Update Mapping
                            </button>
                          </>
                        )}
                        {user.status.toLowerCase() === 'rejected' && !user.isActive && (
                          <button
                            onClick={() => handleAction('activate', user._id)}
                            className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClick(user)}
                          className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleAction('reset', user._id)}
                          className="px-3 py-1 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded transition-colors"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleAction('delete', user._id)}
                          className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500 border border-gray-300">
                    {searchQuery ? 'No users match your search criteria' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Mapping Modal */}
      {showUpdateMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Update Application Mapping
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select which applications this user should be mapped to:
            </p>
            
            <div className="space-y-3 mb-6">
              {applications.map(app => (
                <label
                  key={app}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMappedTo.includes(app)}
                    onChange={() => handleMappedToToggle(app)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{app}</span>
                </label>
              ))}
            </div>

            {selectedMappedTo.length === 0 && (
              <p className="text-sm text-red-600 mb-4">
                Please select at least one application
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUpdateMappingModal(false);
                  setSelectedUserId(null);
                  setSelectedMappedTo([]);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpdateMapping}
                disabled={selectedMappedTo.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Update Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Approve User - Select Applications
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please select which applications this user should be mapped to:
            </p>
            
            <div className="space-y-3 mb-6">
              {applications.map(app => (
                <label
                  key={app}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMappedTo.includes(app)}
                    onChange={() => handleMappedToToggle(app)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{app}</span>
                </label>
              ))}
            </div>

            {selectedMappedTo.length === 0 && (
              <p className="text-sm text-red-600 mb-4">
                Please select at least one application
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedUserId(null);
                  setSelectedMappedTo([]);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={selectedMappedTo.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Approve User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">Edit User Details</h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={editUser.fullName || ''}
                    onChange={(e) => setEditUser({ ...editUser, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={editUser.email || ''}
                    onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={editUser.mobile || ''}
                    onChange={(e) => setEditUser({ ...editUser, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={editUser.role || ''}
                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="">Select Role</option>
                    <option value="Admin">Admin</option>
                    <option value="CCR">CCR</option>
                    <option value="Equipment">Equipment</option>
                    <option value="RTU/Communication">RTU/Communication</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editUser.designation || ''}
                    onChange={(e) => setEditUser({ ...editUser, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Division
                    </label>
                    <input
                      type="text"
                      value={editUser.division || ''}
                      onChange={(e) => setEditUser({ ...editUser, division: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Circle
                    </label>
                    <input
                      type="text"
                      value={editUser.circle || ''}
                      onChange={(e) => setEditUser({ ...editUser, circle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subdivision
                  </label>
                  <input
                    type="text"
                    value={editUser.subdivision || ''}
                    onChange={(e) => setEditUser({ ...editUser, subdivision: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditUser({});
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmEdit}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#ffffff',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                >
                  Update User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
