import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../utils/api';
import { compressImage } from '../utils/imageCompression';

interface Ticket {
  _id: string;
  ticketNumber: string;
  application: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  attachments: Array<{
    _id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
  }>;
  comments: Array<{
    _id: string;
    userId: string;
    userName: string;
    userRole: string;
    comment: string;
    isInternal: boolean;
    attachments: Array<any>;
    createdAt: string;
  }>;
  assignedTo?: {
    userId: string;
    userName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function RaiseTicket() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [application, setApplication] = useState('');
  const [applicationOther, setApplicationOther] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  
  // View ticket state
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      
      // Check if user is admin (should not see raise ticket)
      if (userData.role === 'Admin') {
        navigate('/dashboard/tickets');
        return;
      }
    } else {
      navigate('/signin');
      return;
    }

    // If viewing existing ticket
    if (id) {
      fetchTicket();
    }
  }, [id, navigate]);

  const fetchTicket = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/signin');
        return;
      }

      const response = await fetch(`${API_BASE}/api/tickets/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setTicket(result.data);
      } else {
        setError('Failed to load ticket');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      newAttachments.push(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string);
            setAttachmentPreviews([...attachmentPreviews, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      }
    }

    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    const newPreviews = attachmentPreviews.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    setAttachmentPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!application || !category || !subject || !description) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate "Other" fields
    if (application === 'Other' && !applicationOther.trim()) {
      setError('Please specify the application/module');
      return;
    }

    if (category === 'Other' && !categoryOther.trim()) {
      setError('Please specify the issue category');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/signin');
        return;
      }

      // Process attachments
      const attachmentData = [];
      for (const file of attachments) {
        let processedFile = file;
        
        // Compress images
        if (file.type.startsWith('image/')) {
          try {
            processedFile = await compressImage(file, 0.8);
          } catch (err) {
            console.warn('Failed to compress image, using original:', err);
          }
        }

        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(processedFile);
        });

        attachmentData.push({
          fileName: processedFile.name,
          fileType: processedFile.type,
          data: base64
        });
      }

      const response = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          application: application === 'Other' ? applicationOther.trim() : application,
          category: category === 'Other' ? categoryOther.trim() : category,
          subject,
          description,
          priority,
          attachments: attachmentData
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create ticket' }));
        console.error('Ticket creation error:', errorData);
        setError(errorData.error || errorData.message || 'Failed to create ticket');
        return;
      }

      const result = await response.json();

      if (result.success) {
        setSuccess(`Ticket created successfully! Ticket Number: ${result.data.ticketNumber}`);
        // Reset form
        setApplication('');
        setApplicationOther('');
        setCategory('');
        setCategoryOther('');
        setSubject('');
        setDescription('');
        setPriority('Medium');
        setAttachments([]);
        setAttachmentPreviews([]);
        
        // Redirect to view ticket after 2 seconds
        setTimeout(() => {
          navigate(`/dashboard/raise-ticket/${result.data._id}`);
        }, 2000);
      } else {
        setError(result.error || 'Failed to create ticket');
      }
    } catch (err: any) {
      console.error('Ticket creation exception:', err);
      setError(err.message || 'Failed to create ticket. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;

    setIsSubmittingComment(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/signin');
        return;
      }

      const response = await fetch(`${API_BASE}/api/tickets/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          comment: newComment.trim()
        })
      });

      const result = await response.json();

      if (response.ok) {
        setNewComment('');
        fetchTicket(); // Refresh ticket
        setSuccess('Comment added successfully');
      } else {
        setError(result.error || 'Failed to add comment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const downloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/tickets/${id}/attachments/${attachmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Error downloading attachment:', err);
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

  // If viewing existing ticket
  if (id && ticket) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard/raise-ticket')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            ← Back to Raise Ticket
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Ticket Details</h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Ticket Number</label>
              <p className="text-lg font-bold text-gray-800">{ticket.ticketNumber}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Application</label>
              <p className="text-gray-800">{ticket.application}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Category</label>
              <p className="text-gray-800">{ticket.category}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Priority</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(ticket.priority)}`}>
                {ticket.priority}
              </span>
            </div>
            {ticket.assignedTo && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Assigned To</label>
                <p className="text-gray-800">{ticket.assignedTo.userName}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Created At</label>
              <p className="text-gray-800">{new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Last Updated</label>
              <p className="text-gray-800">{new Date(ticket.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Subject</label>
            <p className="text-gray-800 text-lg">{ticket.subject}</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Description</label>
            <p className="text-gray-800 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Attachments</label>
              <div className="space-y-2">
                {ticket.attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">{att.fileName}</span>
                    <button
                      onClick={() => downloadAttachment(att._id, att.fileName)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Comments</h2>
          
          {ticket.comments && ticket.comments.length > 0 ? (
            <div className="space-y-4 mb-6">
              {ticket.comments
                .filter(c => !c.isInternal) // Users can't see internal comments
                .map((comment) => (
                  <div key={comment._id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{comment.userName}</p>
                        <p className="text-sm text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                      </div>
                      {comment.userRole === 'Admin' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Admin</span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 mb-6">No comments yet.</p>
          )}

          <div className="border-t pt-4">
            <label className="block text-sm font-semibold text-gray-600 mb-2">Add Comment</label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type your comment here..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isSubmittingComment}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmittingComment ? 'Submitting...' : 'Add Comment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Raise new ticket form
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Raise a Support Ticket</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Name <span className="text-gray-500">(Auto-filled)</span>
            </label>
            <input
              type="text"
              value={user?.fullName || user?.name || ''}
              disabled
              className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email / Mobile <span className="text-gray-500">(Auto-filled)</span>
            </label>
            <input
              type="text"
              value={user?.email || user?.mobile || ''}
              disabled
              className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Application / Module <span className="text-red-500">*</span>
            </label>
            <select
              value={application}
              onChange={(e) => {
                setApplication(e.target.value);
                if (e.target.value !== 'Other') {
                  setApplicationOther('');
                }
              }}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Application</option>
              <option value="Equipment Maintenance">Equipment Maintenance</option>
              <option value="Equipment Survey">Equipment Survey</option>
              <option value="RTU Tracker">RTU Tracker</option>
              <option value="User Management">User Management</option>
              <option value="Dashboard">Dashboard</option>
              <option value="Other">Other</option>
            </select>
            {application === 'Other' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={applicationOther}
                  onChange={(e) => setApplicationOther(e.target.value)}
                  placeholder="Please specify the application/module"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Issue Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value !== 'Other') {
                  setCategoryOther('');
                }
              }}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Category</option>
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
            {category === 'Other' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value)}
                  placeholder="Please specify the issue category"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={200}
              placeholder="Brief description of the issue"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Provide detailed information about the issue..."
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Attachment (Screenshot / Logs)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              accept="image/*,.pdf,.txt,.log"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum file size: 10MB per file</p>
          </div>

          {attachments.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Selected Files</label>
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:text-red-800 text-sm font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}

