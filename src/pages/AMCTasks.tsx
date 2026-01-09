import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';

interface Task { 
  _id: string; 
  siteCode: string; 
  equipmentType: string; 
  maintenanceType: string; 
  checklistName: string; 
  dueDate: string; 
  status: string; 
  isOverdue: boolean;
  isSubmitted?: boolean;
  submittedAt?: string;
  submittedBy?: string;
}

export default function AMCTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'AMC') return navigate('/dashboard');
    fetch(`${API_BASE}/api/amc/tasks`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json()).then(data => { 
        if (data.success) {
          setTasks(data.data);
          setFilteredTasks(data.data);
        }
        setLoading(false); 
      }).catch(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTasks(tasks);
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      const query = searchQuery.toLowerCase();
      
      // Filter tasks
      const filtered = tasks.filter(task => 
        task.siteCode.toLowerCase().includes(query) ||
        task.equipmentType.toLowerCase().includes(query) ||
        task.maintenanceType.toLowerCase().includes(query) ||
        task.checklistName.toLowerCase().includes(query) ||
        task.status.toLowerCase().includes(query)
      );
      setFilteredTasks(filtered);

      // Generate autocomplete suggestions
      const suggestionSet = new Set<string>();
      
      tasks.forEach(task => {
        // Add matching site codes
        if (task.siteCode.toLowerCase().includes(query)) {
          suggestionSet.add(task.siteCode);
        }
        // Add matching equipment types
        if (task.equipmentType.toLowerCase().includes(query)) {
          suggestionSet.add(task.equipmentType);
        }
        // Add matching maintenance types
        if (task.maintenanceType.toLowerCase().includes(query)) {
          suggestionSet.add(task.maintenanceType);
        }
        // Add matching checklist names
        if (task.checklistName.toLowerCase().includes(query)) {
          suggestionSet.add(task.checklistName);
        }
        // Add matching statuses
        if (task.status.toLowerCase().includes(query)) {
          suggestionSet.add(task.status);
        }
      });

      const suggestionArray = Array.from(suggestionSet).slice(0, 8); // Limit to 8 suggestions
      setSuggestions(suggestionArray);
      setShowSuggestions(suggestionArray.length > 0);
    }
  }, [searchQuery, tasks]);

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Routine Maintenance Tasks</h1>
          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{tasks.length}</span> tasks
            {searchQuery && ` | Showing: ${filteredTasks.length}`}
          </div>
        </div>

        {/* Search Bar with Autocomplete */}
        <div className="mb-6 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search by Site Code, Equipment Type, Status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
            <svg
              className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="py-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span className="text-sm text-gray-700">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center"><p className="text-gray-600">No pending tasks</p></div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No tasks found matching "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map(task => (
              <div key={task._id} className={`rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden ${
                task.isSubmitted ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400' : 
                task.isOverdue ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-400' : 'bg-white border border-gray-200'
              }`}>
                {/* Card Header with Status Badge */}
                <div className={`px-6 py-4 ${
                  task.isSubmitted ? 'bg-green-600' : 
                  task.isOverdue ? 'bg-red-600' : 'bg-blue-600'
                }`}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-white">{task.siteCode}</h3>
                    {task.isSubmitted && (
                      <span className="px-3 py-1 bg-white text-green-700 text-xs font-bold rounded-full">
                        ✓ SUBMITTED
                      </span>
                    )}
                    {task.isOverdue && !task.isSubmitted && (
                      <span className="px-3 py-1 bg-white text-red-700 text-xs font-bold rounded-full animate-pulse">
                        ⚠ URGENT
                      </span>
                    )}
                    {!task.isOverdue && !task.isSubmitted && (
                      <span className="px-3 py-1 bg-white text-blue-700 text-xs font-bold rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  {/* Equipment Info */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <span className="font-semibold text-gray-700">{task.equipmentType}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">{task.maintenanceType}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{task.checklistName}</span>
                    </div>
                  </div>

                  {/* Due Date or Submission Info */}
                  <div className={`py-3 px-4 rounded-lg mb-4 ${
                    task.isSubmitted ? 'bg-green-100 border border-green-300' :
                    task.isOverdue ? 'bg-red-100 border border-red-300' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    {!task.isSubmitted ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Due Date:</span>
                        <div className="text-right">
                          <span className="text-red-600 font-bold">
                            {new Date(task.dueDate).toLocaleDateString('en-IN')}
                          </span>
                          {task.isOverdue && (
                            <span className="block text-xs text-red-800 font-semibold mt-1">
                              Overdue!
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-green-700">Submitted:</span>
                          <span className="text-green-800 font-semibold">
                            {task.submittedAt && new Date(task.submittedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-green-300">
                          <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            ⏳ WAITING FOR APPROVAL
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  {!task.isSubmitted && (
                    <button 
                      onClick={() => navigate(`/dashboard/amc/tasks/${task._id}`)}
                      className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 ${
                        task.isOverdue ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-300 animate-pulse' : 
                        'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-300'
                      }`}
                    >
                      📝 Fill Checklist
                    </button>
                  )}
                  {task.isSubmitted && (
                    <button 
                      onClick={() => navigate(`/dashboard/amc/tasks/${task._id}`)}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg shadow-green-300"
                    >
                      📄 View Submission
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

