import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';

interface Ticket {
  _id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  email: string;
  application: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedTo?: {
    userId: string;
    userName: string;
  };
  createdAt: string;
  comments: Array<any>;
  internalNotes: Array<any>;
}

interface User {
  userId: string;
  fullName: string;
  role: string;
}

export default function TicketManagement() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected ticket for details
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Update form state
  const [updateStatus, setUpdateStatus] = useState('');
  const [updatePriority, setUpdatePriority] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newInternalNote, setNewInternalNote] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      
      if (userData.role !== 'Admin') {
        navigate('/dashboard');
        return;
      }
    } else {
      navigate('/signin');
      return;
    }

    fetchTickets();
    fetchUsers();
  }, [navigate, statusFilter, priorityFilter, categoryFilter]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/signin');
        return;
      }

      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await fetch(`${API_BASE}/api/tickets?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        let filteredTickets = result.data || [];
        
        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredTickets = filteredTickets.filter((ticket: Ticket) =>
            ticket.ticketNumber.toLowerCase().includes(query) ||
            ticket.subject.toLowerCase().includes(query) ||
            ticket.userName.toLowerCase().includes(query) ||
            ticket.userId.toLowerCase().includes(query)
          );
        }
        
        setTickets(filteredTickets);
      } else {
        setError('Failed to fetch tickets');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // Filter to show only Admin users for assignment
        const adminUsers = (result.data || []).filter((u: User) => 
          u.role === 'Admin' && u.userId
        );
        setUsers(adminUsers);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSelectedTicket(result.data);
        setUpdateStatus(result.data.status);
        setUpdatePriority(result.data.priority);
        setAssignTo(result.data.assignedTo?.userId || '');
        setShowDetailsModal(true);
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    }
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    setIsUpdating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const updateData: any = {};
      if (updateStatus && updateStatus !== selectedTicket.status) {
        updateData.status = updateStatus;
      }
      if (updatePriority && updatePriority !== selectedTicket.priority) {
        updateData.priority = updatePriority;
      }
      if (assignTo && assignTo !== selectedTicket.assignedTo?.userId) {
        updateData.assignedTo = assignTo;
      }
      if (resolutionNote) {
        updateData.resolutionNote = resolutionNote;
      }

      const response = await fetch(`${API_BASE}/api/tickets/${selectedTicket._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        fetchTickets();
        fetchTicketDetails(selectedTicket._id);
        setResolutionNote('');
        setError(null);
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to update ticket');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newComment.trim()) return;

    setIsUpdating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/tickets/${selectedTicket._id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comment: newComment.trim(),
          isInternal: isInternalComment
        })
      });

      if (response.ok) {
        setNewComment('');
        setIsInternalComment(false);
        fetchTicketDetails(selectedTicket._id);
        fetchTickets();
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to add comment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!selectedTicket || !newInternalNote.trim()) return;

    setIsUpdating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/tickets/${selectedTicket._id}/internal-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note: newInternalNote.trim()
        })
      });

      if (response.ok) {
        setNewInternalNote('');
        fetchTicketDetails(selectedTicket._id);
      } else {
        const result = await response.json();
        setError(result.error || 'Failed to add internal note');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add internal note');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Open': 'bg-gray-100 text-gray-800',
      'Assigned': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      'Waiting for User': 'bg-orange-100 text-orange-800',
      'Resolved': 'bg-green-100 text-green-800',
      'Closed': 'bg-gray-200 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'Low': 'bg-green-100 text-green-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'High': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    fetchTickets();
  }, [searchQuery]);

  if (isLoading && tickets.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Ticket Management</h1>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="Open">Open</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Waiting for User">Waiting for User</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              <option value="Login Issue">Login Issue</option>
              <option value="Forgot Password">Forgot Password</option>
              <option value="OTP / Email Not Received">OTP / Email Not Received</option>
              <option value="Application Not Loading">Application Not Loading</option>
              <option value="Feature Not Working">Feature Not Working</option>
              <option value="Data Mismatch">Data Mismatch</option>
              <option value="Performance Issue">Performance Issue</option>
              <option value="Access / Permission Issue">Access / Permission Issue</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ticket #, Subject, User..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{ticket.userName}</div>
                      <div className="text-xs text-gray-400">{ticket.userId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {ticket.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.assignedTo?.userName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => fetchTicketDetails(ticket._id)}
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {showDetailsModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Ticket Details</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTicket(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Ticket Number</label>
                  <p className="text-gray-800">{selectedTicket.ticketNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Open">Open</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Waiting for User">Waiting for User</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">User</label>
                  <p className="text-gray-800">{selectedTicket.userName} ({selectedTicket.userId})</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Priority</label>
                  <select
                    value={updatePriority}
                    onChange={(e) => setUpdatePriority(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Application</label>
                  <p className="text-gray-800">{selectedTicket.application}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Assign To</label>
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Category</label>
                  <p className="text-gray-800">{selectedTicket.category}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
                  <p className="text-gray-800">{selectedTicket.email}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Subject</label>
                <p className="text-gray-800">{selectedTicket.subject}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
                <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Comments */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Comments</label>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                    selectedTicket.comments.map((comment: any) => (
                      <div key={comment._id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="font-semibold text-gray-800">{comment.userName}</p>
                            <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                          </div>
                          {comment.isInternal && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Internal</span>
                          )}
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No comments yet.</p>
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              {selectedTicket.internalNotes && selectedTicket.internalNotes.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Internal Notes</label>
                  <div className="space-y-3 max-h-32 overflow-y-auto">
                    {selectedTicket.internalNotes.map((note: any) => (
                      <div key={note._id} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50">
                        <p className="text-xs text-gray-500 mb-1">{note.userName} - {new Date(note.createdAt).toLocaleString()}</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Comment */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Add Comment</label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment here..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-2"
                  rows={3}
                />
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="internal-comment"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="internal-comment" className="text-sm text-gray-600">Internal (not visible to user)</label>
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isUpdating}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Add Comment
                </button>
              </div>

              {/* Add Internal Note */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Add Internal Note</label>
                <textarea
                  value={newInternalNote}
                  onChange={(e) => setNewInternalNote(e.target.value)}
                  placeholder="Internal note (admin only)..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-2"
                  rows={2}
                />
                <button
                  onClick={handleAddInternalNote}
                  disabled={!newInternalNote.trim() || isUpdating}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                >
                  Add Internal Note
                </button>
              </div>

              {/* Resolution Note */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-2">Resolution Note</label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Add resolution note..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTicket(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={handleUpdateTicket}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isUpdating ? 'Updating...' : 'Update Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

