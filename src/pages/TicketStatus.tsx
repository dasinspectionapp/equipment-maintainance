import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';

interface Ticket {
  _id: string;
  ticketNumber: string;
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
  updatedAt: string;
  resolvedAt?: string;
  comments: Array<{
    _id: string;
    userName: string;
    comment: string;
    createdAt: string;
    isInternal?: boolean;
    userRole?: string;
  }>;
}

export default function TicketStatus() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
    } else {
      navigate('/signin');
      return;
    }

    fetchTickets();
  }, [navigate, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [searchQuery]);

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
            ticket.category.toLowerCase().includes(query)
          );
        }
        
        // Sort by created date (newest first)
        filteredTickets.sort((a: Ticket, b: Ticket) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
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
        setShowDetailsModal(true);
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Open': 'bg-gray-100 text-gray-800 border-gray-300',
      'Assigned': 'bg-blue-100 text-blue-800 border-blue-300',
      'In Progress': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Waiting for User': 'bg-orange-100 text-orange-800 border-orange-300',
      'Resolved': 'bg-green-100 text-green-800 border-green-300',
      'Closed': 'bg-gray-200 text-gray-700 border-gray-400'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'Low': 'bg-green-100 text-green-800 border-green-300',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'High': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      'Open': '🔵',
      'Assigned': '📋',
      'In Progress': '⚙️',
      'Waiting for User': '⏳',
      'Resolved': '✅',
      'Closed': '🔒'
    };
    return icons[status] || '🔵';
  };

  if (isLoading && tickets.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Ticket Status</h1>
        <p className="text-gray-600">View the status of all your submitted support tickets</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <label className="block text-sm font-semibold text-gray-600 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ticket #, Subject, Category..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🎫</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Tickets Found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || statusFilter || priorityFilter
              ? 'No tickets match your filters. Try adjusting your search criteria.'
              : "You haven't submitted any tickets yet."}
          </p>
          {!searchQuery && !statusFilter && !priorityFilter && (
            <button
              onClick={() => navigate('/dashboard/raise-ticket')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Raise a New Ticket
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((ticket) => (
            <div
              key={ticket._id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4"
              style={{
                borderLeftColor: 
                  ticket.status === 'Resolved' ? '#10b981' :
                  ticket.status === 'Closed' ? '#6b7280' :
                  ticket.status === 'In Progress' ? '#f59e0b' :
                  ticket.status === 'Waiting for User' ? '#f97316' :
                  '#3b82f6'
              }}
              onClick={() => fetchTicketDetails(ticket._id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{ticket.ticketNumber}</h3>
                  <p className="text-sm text-gray-500">{ticket.subject}</p>
                </div>
                <span className="text-2xl">{getStatusIcon(ticket.status)}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Priority:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Category:</span>
                  <span className="text-sm font-medium text-gray-800">{ticket.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Application:</span>
                  <span className="text-sm font-medium text-gray-800">{ticket.application}</span>
                </div>
              </div>

              {ticket.assignedTo && (
                <div className="mb-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                  <p className="text-sm font-medium text-gray-800">{ticket.assignedTo.userName}</p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  {ticket.comments && ticket.comments.length > 0 && (
                    <span className="flex items-center">
                      💬 {ticket.comments.length} {ticket.comments.length === 1 ? 'comment' : 'comments'}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchTicketDetails(ticket._id);
                }}
                className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Details Modal */}
      {showDetailsModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Ticket Details</h2>
                  <p className="text-gray-600 mt-1">{selectedTicket.ticketNumber}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTicket(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Ticket Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(selectedTicket.status)}`}>
                    {getStatusIcon(selectedTicket.status)} {selectedTicket.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Priority</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Category</label>
                  <p className="text-gray-800">{selectedTicket.category}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Application</label>
                  <p className="text-gray-800">{selectedTicket.application}</p>
                </div>
                {selectedTicket.assignedTo && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Assigned To</label>
                    <p className="text-gray-800">{selectedTicket.assignedTo.userName}</p>
                  </div>
                )}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Created</label>
                  <p className="text-gray-800">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                </div>
                {selectedTicket.resolvedAt && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Resolved</label>
                    <p className="text-gray-800">{new Date(selectedTicket.resolvedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Subject</label>
                <p className="text-gray-800 text-lg">{selectedTicket.subject}</p>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
                <p className="text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{selectedTicket.description}</p>
              </div>

              {/* Comments */}
              {selectedTicket.comments && selectedTicket.comments.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Comments</label>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedTicket.comments
                      .filter(c => !c.isInternal) // Users can't see internal comments
                      .map((comment: any) => (
                        <div key={comment._id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r-lg">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="font-semibold text-gray-800">{comment.userName}</p>
                              <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                            </div>
                            {comment.userRole === 'Admin' && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Admin</span>
                            )}
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
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
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTicket(null);
                    navigate(`/dashboard/raise-ticket/${selectedTicket._id}`);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

