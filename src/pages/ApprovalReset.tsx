import { useState, useEffect, useRef, useCallback } from 'react';
import BackButton from '../components/BackButton';

export default function ApprovalReset() {
  const [approvedDate, setApprovedDate] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ count: number; approvals: any[] } | null>(null);
  
  // Role selection dialog states
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [approvalCheckResult, setApprovalCheckResult] = useState<{
    hasMultipleRoles: boolean;
    roles: string[];
    approvalsByRole: { Equipment: any[]; CCR: any[] };
    totalCount: number;
  } | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  
  // Autocomplete states
  const [siteCodeSuggestions, setSiteCodeSuggestions] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const siteCodeInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch sitecode suggestions
  const fetchSiteCodeSuggestions = useCallback(async (searchTerm: string = '') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      setIsLoadingSuggestions(true);
      
      const url = searchTerm
        ? `http://localhost:5000/api/approvals/sitecodes?search=${encodeURIComponent(searchTerm)}`
        : 'http://localhost:5000/api/approvals/sitecodes';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sitecodes');
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        setSiteCodeSuggestions(data.data);
      } else {
        setSiteCodeSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching sitecode suggestions:', error);
      setSiteCodeSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Load initial suggestions on mount
  useEffect(() => {
    fetchSiteCodeSuggestions();
  }, [fetchSiteCodeSuggestions]);

  // Filter suggestions based on input with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (siteCode.trim().length > 0) {
      debounceRef.current = setTimeout(() => {
        const filtered = siteCodeSuggestions.filter((sc: string) =>
          sc.toLowerCase().includes(siteCode.toLowerCase())
        );
        setFilteredSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        
        // If no local matches, try fetching from server
        if (filtered.length === 0 && siteCode.trim().length >= 2) {
          fetchSiteCodeSuggestions(siteCode);
        }
      }, 300);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [siteCode, siteCodeSuggestions, fetchSiteCodeSuggestions]);

  // Handle sitecode input change
  const handleSiteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setSiteCode(value);
    setSelectedIndex(-1);
    
    if (value.trim().length > 0) {
      const filtered = siteCodeSuggestions.filter((sc: string) =>
        sc.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: string) => {
    setSiteCode(suggestion.toUpperCase());
    setShowSuggestions(false);
    setSelectedIndex(-1);
    siteCodeInputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleSiteCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          handleSelectSuggestion(filteredSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        siteCodeInputRef.current?.blur();
        break;
    }
  };

  // Handle input blur
  const handleSiteCodeBlur = () => {
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 200);
  };

  // Check approvals before resetting
  const checkApprovals = async () => {
    if (!approvedDate || !siteCode) {
      setMessage({ type: 'error', text: 'Please fill in both Date of Approved and Sitecode fields.' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Format date to YYYY-MM-DD for backend
      const dateObj = new Date(approvedDate);
      const formattedDate = dateObj.toISOString().split('T')[0];

      const response = await fetch('http://localhost:5000/api/approvals/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          approvedDate: formattedDate,
          siteCode: siteCode.trim().toUpperCase()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check approvals.');
      }

      // If multiple roles found, show selection dialog
      if (data.hasMultipleRoles) {
        setApprovalCheckResult(data);
        setShowRoleSelection(true);
        // Pre-select both roles
        setSelectedRoles(['Equipment', 'CCR']);
      } else {
        // Single role or no role info, proceed with reset
        await performReset([]);
      }
    } catch (error: any) {
      console.error('Error checking approvals:', error);
      setMessage({ type: 'error', text: error.message || 'An error occurred while checking approvals.' });
    }
  };

  // Perform the actual reset
  const performReset = async (roles: string[] = []) => {
    setIsSubmitting(true);
    setMessage(null);
    setResetResult(null);
    setShowRoleSelection(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Format date to YYYY-MM-DD for backend
      const dateObj = new Date(approvedDate);
      const formattedDate = dateObj.toISOString().split('T')[0];

      const response = await fetch('http://localhost:5000/api/approvals/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          approvedDate: formattedDate,
          siteCode: siteCode.trim().toUpperCase(),
          roles: roles.length > 0 ? roles : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset approvals.');
      }

      setMessage({ type: 'success', text: data.message || 'Approvals reset successfully!' });
      setResetResult({
        count: data.count || 0,
        approvals: data.data || []
      });

      // Clear form after successful reset
      setApprovedDate('');
      setSiteCode('');
      setApprovalCheckResult(null);
    } catch (error: any) {
      console.error('Error resetting approvals:', error);
      setMessage({ type: 'error', text: error.message || 'An error occurred while resetting approvals.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await checkApprovals();
  };

  // Handle role selection
  const handleRoleToggle = (role: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  // Handle confirm role selection
  const handleConfirmRoleSelection = () => {
    if (selectedRoles.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one role to reset.' });
      return;
    }
    performReset(selectedRoles);
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Approval Reset</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-600 mb-6">
          Reset approvals that were mistakenly verified and approved by Equipment or CCR role users. 
          Enter the Date of Approved and Sitecode to reset matching approvals.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date of Approved Field */}
            <div>
              <label htmlFor="approvedDate" className="block text-sm font-medium text-gray-700 mb-2">
                Date of Approved <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="approvedDate"
                value={approvedDate}
                onChange={(e) => setApprovedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Select the date when the approval was made
              </p>
            </div>

            {/* Sitecode Field with Autocomplete */}
            <div className="relative">
              <label htmlFor="siteCode" className="block text-sm font-medium text-gray-700 mb-2">
                Sitecode <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={siteCodeInputRef}
                  type="text"
                  id="siteCode"
                  value={siteCode}
                  onChange={handleSiteCodeChange}
                  onKeyDown={handleSiteCodeKeyDown}
                  onFocus={() => {
                    if (filteredSuggestions.length > 0 && siteCode.trim().length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={handleSiteCodeBlur}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                  placeholder="Type to search sitecode..."
                  required
                  autoComplete="off"
                />
                {isLoadingSuggestions && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                {/* Suggestions Dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                          index === selectedIndex ? 'bg-blue-100' : ''
                        } ${index === 0 ? 'rounded-t-lg' : ''} ${
                          index === filteredSuggestions.length - 1 ? 'rounded-b-lg' : ''
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Type to search and select sitecode from approvals
              </p>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Reset Result */}
          {resetResult && resetResult.count > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium mb-2">
                Successfully reset {resetResult.count} approval(s):
              </p>
              <div className="space-y-2">
                {resetResult.approvals.map((approval, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-sm">
                      <span className="font-medium">Approval ID:</span> {approval._id}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Type:</span> {approval.approvalType}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Status:</span> {approval.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? 'Checking...' : 'Reset Approval'}
            </button>
          </div>
        </form>
      </div>

      {/* Role Selection Dialog */}
      {showRoleSelection && approvalCheckResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Multiple Roles Detected
            </h3>
            <p className="text-gray-600 mb-4">
              Both Equipment and CCR role users have approved on this date for sitecode <strong>{siteCode}</strong>. 
              Please select which role(s) to reset:
            </p>

            {/* Role Selection */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes('Equipment')}
                  onChange={() => handleRoleToggle('Equipment')}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-700">Equipment</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({approvalCheckResult.approvalsByRole.Equipment.length} approval(s))
                  </span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes('CCR')}
                  onChange={() => handleRoleToggle('CCR')}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-700">CCR</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({approvalCheckResult.approvalsByRole.CCR.length} approval(s))
                  </span>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowRoleSelection(false);
                  setApprovalCheckResult(null);
                  setSelectedRoles([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleSelection}
                disabled={selectedRoles.length === 0 || isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {isSubmitting ? 'Resetting...' : 'Reset Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

