import { useEffect, useMemo, useState } from 'react';
import { logActivity } from '../utils/activityLogger';
import { API_BASE } from '../utils/api';

interface ApprovalRecord {
  _id: string;
  actionId?: string | { _id: string; status?: string; remarks?: string };
  siteCode: string;
  rtuTrackerSiteId?: string | { _id?: string; siteCode?: string; siteObservations?: string; dateOfInspection?: string };
  approvalType: string;
  status: 'Pending' | 'Approved' | 'Kept for Monitoring' | 'Recheck Requested';
  submittedByUserId?: string;
  submittedByRole?: string;
  assignedToUserId?: string;
  assignedToRole?: string;
  approvedByUserId?: string;
  approvedByRole?: string;
  approvedAt?: string;
  approvalRemarks?: string;
  submissionRemarks?: string;
  photos?: string[];
  supportDocuments?: SupportDocument[];
  fileId?: string;
  rowKey?: string;
  originalRowData?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

interface SupportDocument {
  name?: string;
  data?: string;
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export default function RTUTrackerApprovals() {
  const [actions, setActions] = useState<ApprovalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ApprovalRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recheckNote, setRecheckNote] = useState('');
  const [photoViewer, setPhotoViewer] = useState<{ src: string; name: string } | null>(null);
  const [typeOfIssue, setTypeOfIssue] = useState<string>('');
  const [specifyOtherIssue, setSpecifyOtherIssue] = useState<string>('');
  const [ccrStatus, setCcrStatus] = useState<string>('');

  const user = getCurrentUser();
  const userRole = user?.role || '';

  const loadApprovals = async () => {
    if (userRole !== 'CCR') {
      setActions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Fetch RTU Tracker Resolution Approvals only
      const response = await fetch(`${API_BASE}/api/approvals?approvalType=RTU Tracker Resolution Approval`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Failed to load approvals (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      console.log('RTUTrackerApprovals - Raw approvals from API:', {
        totalCount: data.data?.length || 0,
        approvals: data.data?.map((a: ApprovalRecord) => ({
          _id: a._id,
          approvalType: a.approvalType,
          status: a.status,
          siteCode: a.siteCode,
          assignedToUserId: a.assignedToUserId
        })) || []
      });

      const approvals: ApprovalRecord[] = Array.isArray(data.data) ? data.data : [];

      console.log('RTUTrackerApprovals - Loaded approvals:', {
        count: approvals.length,
        approvals: approvals.map(a => ({
          _id: a._id,
          approvalType: a.approvalType,
          status: a.status,
          siteCode: a.siteCode
        }))
      });

      setActions(approvals);
    } catch (fetchError: any) {
      console.error('Error fetching RTU Tracker approvals:', fetchError);
      setError(fetchError?.message || 'Unable to load approvals at the moment.');
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  const pendingApprovals = useMemo(() => actions.filter(approval => approval.status === 'Pending'), [actions]);
  const completedApprovals = useMemo(() => actions.filter(approval => approval.status === 'Approved'), [actions]);

  const supportDocuments = (approval: ApprovalRecord): SupportDocument[] => {
    return Array.isArray(approval.supportDocuments) ? approval.supportDocuments as SupportDocument[] : [];
  };

  const photos = (approval: ApprovalRecord): string[] => {
    return Array.isArray(approval.photos) ? approval.photos : [];
  };

  const handleApprove = async (approval: ApprovalRecord) => {
    if (!approval?._id) return;

    // Validate Type of Issue
    if (!typeOfIssue || typeOfIssue.trim() === '') {
      alert('Please select Type of Issue');
      return;
    }

    if (typeOfIssue === 'OTHERS' && (!specifyOtherIssue || specifyOtherIssue.trim() === '')) {
      alert('Please specify the issue type');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required. Please sign in again.');

      // Determine final type of issue value
      const finalTypeOfIssue = typeOfIssue === 'OTHERS' ? specifyOtherIssue : typeOfIssue;

      const approvalRemarks = 'Verified and approved by CCR';

      // Update approval status via approval API (include metadata with typeOfIssue and ccrStatus)
      const response = await fetch(`${API_BASE}/api/approvals/${approval._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'Completed',
          remarks: approvalRemarks,
          metadata: {
            ...approval.metadata,
            typeOfIssue: finalTypeOfIssue,
            ccrStatus: ccrStatus || ''
          }
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to approve resolution.');
      }

      // Update RTU Tracker Site typeOfIssue and ccrStatus if rtuTrackerSiteId exists
      if (approval.rtuTrackerSiteId) {
        const rtuTrackerSiteId = typeof approval.rtuTrackerSiteId === 'string' ? approval.rtuTrackerSiteId : approval.rtuTrackerSiteId._id;
        try {
          // Update RTU Tracker Site with typeOfIssue and ccrStatus
          const updateResponse = await fetch(`${API_BASE}/api/rtu-tracker-sites/${rtuTrackerSiteId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              typeOfIssue: finalTypeOfIssue,
              ccrStatus: ccrStatus || ''
            })
          });
          
          if (!updateResponse.ok) {
            console.warn('Failed to update RTU Tracker Site');
          } else {
            console.log('Updated RTU Tracker Site:', { typeOfIssue: finalTypeOfIssue, ccrStatus: ccrStatus });
          }
        } catch (rtuError) {
          console.error('Error updating RTU Tracker Site:', rtuError);
          // Don't fail if RTU Tracker Site update fails
        }
      }

      // Save to RTU Tracker Approval collection
      try {
        const rtuTrackerSiteId = approval.rtuTrackerSiteId 
          ? (typeof approval.rtuTrackerSiteId === 'string' ? approval.rtuTrackerSiteId : approval.rtuTrackerSiteId._id)
          : null;
        
        const row = approval.originalRowData || {};
        const fieldTeamAction = approval.submissionRemarks || approval.approvalRemarks || '';
        
        const approvalData = {
          approvalId: approval._id,
          rtuTrackerSiteId: rtuTrackerSiteId,
          siteCode: approval.siteCode || row['Site Code'] || row['SITE CODE'] || '',
          fileId: approval.fileId || '',
          rowKey: approval.rowKey || '',
          status: 'Approved',
          submittedByUserId: approval.submittedByUserId || '',
          submittedByRole: approval.submittedByRole || '',
          assignedToUserId: approval.assignedToUserId || '',
          assignedToRole: approval.assignedToRole || 'CCR',
          typeOfIssue: finalTypeOfIssue,
          ccrStatus: ccrStatus || '',
          ccrRemarks: recheckNote || approvalRemarks,
          fieldTeamAction: fieldTeamAction,
          dateOfInspection: approval.metadata?.dateOfInspection || '',
          submissionRemarks: approval.submissionRemarks || '',
          approvalRemarks: approvalRemarks,
          photos: approval.photos || [],
          supportDocuments: approval.supportDocuments || [],
          originalRowData: approval.originalRowData || {},
          metadata: {
            ...approval.metadata,
            typeOfIssue: finalTypeOfIssue,
            ccrStatus: ccrStatus || ''
          }
        };

        const saveResponse = await fetch(`${API_BASE}/api/rtu-tracker-approvals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(approvalData)
        });

        if (!saveResponse.ok) {
          console.warn('Failed to save RTU Tracker Approval');
        } else {
          console.log('Saved RTU Tracker Approval to collection');
        }
      } catch (saveError) {
        console.error('Error saving RTU Tracker Approval:', saveError);
        // Don't fail if save fails
      }

      // Log approval action
      const row = approval.originalRowData || {};
      const siteCode = approval.siteCode || row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '';
      const siteName = row['Site Name'] || row['SITE NAME'] || row['HRN'] || row['Hrn'] || row['Location'] || '';
      const approvalPhotos = photos(approval);
      
      logActivity({
        action: 'RTU Tracker Resolution Approved',
        typeOfIssue: approval.approvalType || 'RTU Tracker Resolution Approval',
        routingTeam: 'CCR Team',
        remarks: approvalRemarks,
        siteName: String(siteName),
        siteCode: String(siteCode),
        photosCount: approvalPhotos.length,
        photos: approvalPhotos.length > 0 ? approvalPhotos : undefined,
        status: 'Approved',
        priority: 'Medium',
        assignedToRole: 'CCR'
      });

      await loadApprovals();
      setSelectedAction(null);
      setTypeOfIssue('');
      setSpecifyOtherIssue('');
      setCcrStatus('');
    } catch (error: any) {
      console.error('Error approving RTU Tracker resolution:', error);
      alert(error?.message || 'Failed to approve the resolution. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Removed handleRecheck and handleKeptForMonitoring - no longer used after removing Recheck and Kept for Monitoring buttons

  if (userRole !== 'CCR') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">RTU Tracker Approvals</h1>
        <div className="text-red-500 text-center py-8">Access denied. This page is only available for CCR role.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">RTU Tracker Approvals</h1>
          <p className="text-gray-600">Review RTU Tracker resolutions, verify, and finalize closures.</p>
        </div>
        <button
          type="button"
          onClick={loadApprovals}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending approvals</p>
          <p className="text-3xl font-bold text-blue-600">{pendingApprovals.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-3xl font-bold text-green-600">{completedApprovals.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total submissions</p>
          <p className="text-3xl font-bold text-indigo-600">{actions.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-700">Approval Queue</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Site Code</th>
                <th className="px-4 py-3 text-left">Site Name</th>
                <th className="px-4 py-3 text-left">Date of Inspection</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Remarks</th>
                <th className="px-4 py-3 text-left">Photos</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading approvals…</span>
                    </div>
                  </td>
                </tr>
              ) : actions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {error ? error : 'No RTU Tracker approvals are pending at the moment.'}
                  </td>
                </tr>
              ) : (
                actions.map(approval => {
                  const row = approval.originalRowData || {};
                  const siteCode = approval.siteCode || row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '-';
                  const hrn = row['HRN'] || row['Hrn'] || row['hrn'] || row['SITE NAME'] || row['Site Name'] || row['Location'] || '-';
                  const dateOfInspection = approval.metadata?.dateOfInspection || 
                                          (typeof approval.rtuTrackerSiteId === 'object' && approval.rtuTrackerSiteId?.dateOfInspection) ||
                                          '-';
                  const approvalStatus = approval.status || 'Pending';
                  const remarks = String(approval.approvalRemarks || approval.submissionRemarks || '').trim();
                  const photoCount = photos(approval).length;

                  // Determine status badge based on approval status
                  let statusBadgeClass = 'bg-gray-100 text-gray-600';
                  let statusText = 'Pending';
                  
                  if (approvalStatus === 'Approved') {
                    statusBadgeClass = 'bg-green-100 text-green-700';
                    statusText = 'Approved';
                  } else if (approvalStatus === 'Kept for Monitoring') {
                    statusBadgeClass = 'bg-blue-100 text-blue-700';
                    statusText = 'Kept for Monitoring';
                  } else if (approvalStatus === 'Recheck Requested') {
                    statusBadgeClass = 'bg-yellow-100 text-yellow-700';
                    statusText = 'Recheck Requested';
                  }

                  return (
                    <tr key={approval._id} className="hover:bg-blue-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-800">{siteCode}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-800">{hrn}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{dateOfInspection}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(approval.createdAt || approval.updatedAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}`}>{statusText}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={remarks}>{remarks || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''}` : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => {
                            setSelectedAction(approval);
                            setRecheckNote('');
                            // Initialize type of issue from metadata or existing value
                            const existingTypeOfIssue = approval.metadata?.typeOfIssue || '';
                            setTypeOfIssue(existingTypeOfIssue);
                            setSpecifyOtherIssue('');
                            // Initialize CCR Status from metadata or existing value
                            const existingCcrStatus = approval.metadata?.ccrStatus || '';
                            setCcrStatus(existingCcrStatus);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAction && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => {
            if (!isSubmitting) {
              setSelectedAction(null);
              setRecheckNote('');
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">RTU Tracker Approval Details</h3>
                <p className="text-sm text-gray-500">Submitted on {formatDate(selectedAction.createdAt || selectedAction.updatedAt)}</p>
                {selectedAction.status === 'Approved' && (
                  <p className="text-sm text-green-600 font-semibold mt-1">✓ Already Approved</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setSelectedAction(null);
                    setRecheckNote('');
                    setTypeOfIssue('');
                    setSpecifyOtherIssue('');
                    setCcrStatus('');
                  }
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Site Code</p>
                  <p className="text-base font-semibold text-blue-900">
                    {selectedAction.siteCode || selectedAction.originalRowData?.['Site Code'] || selectedAction.originalRowData?.['SITE CODE'] || '-'}
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">HRN</p>
                  <p className="text-base font-semibold text-indigo-900">
                    {selectedAction.originalRowData?.['HRN'] || selectedAction.originalRowData?.['Hrn'] || selectedAction.originalRowData?.['hrn'] || selectedAction.originalRowData?.['Site Name'] || selectedAction.originalRowData?.['SITE NAME'] || selectedAction.originalRowData?.['Location'] || '-'}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Date of Inspection</p>
                  <p className="text-base font-semibold text-purple-900">
                    {selectedAction.metadata?.dateOfInspection || 
                     (typeof selectedAction.rtuTrackerSiteId === 'object' && selectedAction.rtuTrackerSiteId?.dateOfInspection) ||
                     '-'}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <label className="text-xs font-semibold text-green-600 uppercase tracking-wide block mb-2">Type of Issue *</label>
                  <select
                    value={typeOfIssue}
                    onChange={(e) => {
                      setTypeOfIssue(e.target.value);
                      if (e.target.value !== 'OTHERS') {
                        setSpecifyOtherIssue('');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                    disabled={isSubmitting || selectedAction.status === 'Approved'}
                  >
                    <option value="">Select Type of Issue</option>
                    <option value="CS Cleared - Equipment Issue">CS Cleared - Equipment Issue</option>
                    <option value="CS Issue">CS Issue</option>
                    <option value="Equipment Cleared - RTU Issue">Equipment Cleared - RTU Issue</option>
                    <option value="Equipment Issue">Equipment Issue</option>
                    <option value="Equipment -RTU Issue">Equipment -RTU Issue</option>
                    <option value="RTU Cleared -Equipment Issue">RTU Cleared -Equipment Issue</option>
                    <option value="RTU Issue">RTU Issue</option>
                    <option value="OTHERS">OTHERS</option>
                  </select>
                  {typeOfIssue === 'OTHERS' && (
                    <input
                      type="text"
                      placeholder="Please specify"
                      value={specifyOtherIssue}
                      onChange={(e) => setSpecifyOtherIssue(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      disabled={isSubmitting || selectedAction.status === 'Approved'}
                    />
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Field Team Action taken/Observation</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {selectedAction.submissionRemarks || selectedAction.approvalRemarks || 'No remarks provided.'}
                </p>
              </div>

              {supportDocuments(selectedAction).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Support Documents</h4>
                  <ul className="space-y-2 text-sm">
                    {supportDocuments(selectedAction).map((doc, index) => (
                      <li key={`${selectedAction._id}-doc-${index}`} className="flex items-center justify-between">
                        <span className="text-gray-700">{doc?.name || `Document ${index + 1}`}</span>
                        {doc?.data ? (
                          <a
                            href={doc.data}
                            download={doc?.name || `document-${index + 1}.pdf`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">Unavailable</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {photos(selectedAction).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Captured Photos</h4>
                  <div className="flex flex-wrap gap-3">
                    {photos(selectedAction).map((photoSrc, index) => (
                      <button
                        key={`${selectedAction._id}-photo-${index}`}
                        type="button"
                        className="w-24 h-24 border border-gray-200 rounded-md overflow-hidden shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => setPhotoViewer({ src: photoSrc, name: `Captured evidence ${index + 1}` })}
                      >
                        <img
                          src={photoSrc}
                          alt={`Captured evidence ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="ccr-remarks" className="text-sm font-semibold text-gray-700">CCR Remarks</label>
                <textarea
                  id="ccr-remarks"
                  value={recheckNote}
                  onChange={e => setRecheckNote(e.target.value)}
                  placeholder="Provide guidance if you are requesting a recheck."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="ccr-status" className="text-sm font-semibold text-gray-700">CCR Status</label>
                <select
                  id="ccr-status"
                  value={ccrStatus}
                  onChange={(e) => setCcrStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  disabled={isSubmitting || selectedAction.status === 'Approved'}
                >
                  <option value="">Select CCR Status</option>
                  <option value="Attended & Cleared">Attended & Cleared</option>
                  <option value="Attended & Not Cleared">Attended & Not Cleared</option>
                  <option value="Unattended">Unattended</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700"
                onClick={() => {
                  setSelectedAction(null);
                  setRecheckNote('');
                  setTypeOfIssue('');
                  setSpecifyOtherIssue('');
                  setCcrStatus('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-md shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                onClick={() => handleApprove(selectedAction)}
                disabled={isSubmitting || selectedAction.status === 'Approved'}
              >
                {isSubmitting ? 'Approving…' : 'Verify & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {photoViewer && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center px-4"
          onClick={() => setPhotoViewer(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">{photoViewer.name}</h3>
              <div className="flex items-center gap-3">
                <a
                  href={photoViewer.src}
                  download
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setPhotoViewer(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center">
              <img
                src={photoViewer.src}
                alt={photoViewer.name}
                className="max-w-full max-h-[85vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
