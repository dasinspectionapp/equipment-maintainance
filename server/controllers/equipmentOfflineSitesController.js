import EquipmentOfflineSites from '../models/EquipmentOfflineSites.js';
import Upload from '../models/Upload.js';
import Action from '../models/Action.js';
import User from '../models/User.js';
import Approval from '../models/Approval.js';
import Notification from '../models/Notification.js';

// @desc    Save or update equipment offline site data
// @route   POST /api/equipment-offline-sites
// @access  Private
export const saveEquipmentOfflineSite = async (req, res) => {
  try {
    const {
      fileId,
      rowKey,
      siteCode,
      originalRowData,
      headers,
      siteObservations,
      taskStatus,
      typeOfIssue,
      viewPhotos,
      photoMetadata,
      remarks,
      supportDocuments,
      deviceStatus,
      noOfDaysOffline,
      savedFrom
    } = req.body;
    
    const userId = req.user.userId;

    if (!fileId || !rowKey || !siteCode || !originalRowData) {
      return res.status(400).json({
        success: false,
        error: 'File ID, Row Key, Site Code, and Original Row Data are required'
      });
    }

    // Extract location information from originalRowData if available
    const circle = originalRowData['CIRCLE'] || originalRowData['Circle'] || originalRowData['circle'] || '';
    const division = originalRowData['DIVISION'] || originalRowData['Division'] || originalRowData['division'] || '';
    const subDivision = originalRowData['SUB DIVISION'] || originalRowData['Sub Division'] || originalRowData['subDivision'] || originalRowData['sub_division'] || '';

    // Find existing record or create new one
    // CRITICAL: Explicitly set typeOfIssue and remarks even if empty strings
    // This ensures they are saved to database (not just undefined/null)
    // IMPORTANT: Using fileId, rowKey, and userId ensures only ONE specific record is updated
    console.log('[saveEquipmentOfflineSite] Updating record:', { fileId, rowKey, userId, siteCode: siteCode.trim().toUpperCase() });
    
    // CRITICAL: For Reports compatibility, Resolved = empty string, Pending = non-empty string
    // If siteObservations is 'Resolved' (string), convert to empty string
    // If siteObservations is 'Pending' (string), keep as 'Pending'
    // If siteObservations is empty string, keep as empty string
    let finalSiteObservations = '';
    if (siteObservations !== undefined && siteObservations !== null) {
      const siteObsStr = String(siteObservations).trim();
      if (siteObsStr === 'Resolved') {
        finalSiteObservations = ''; // Resolved = empty string for Reports
        console.log('[saveEquipmentOfflineSite] Converting "Resolved" to empty string for Reports compatibility');
      } else if (siteObsStr === 'Pending' || siteObsStr.length > 0) {
        finalSiteObservations = siteObsStr; // Pending = non-empty string
      } else {
        finalSiteObservations = ''; // Empty = Resolved
      }
    }
    
    // Determine CCR Status: If Resolved, set to Pending; otherwise keep existing or empty
    let ccrStatus = '';
    if (siteObservations !== undefined && siteObservations !== null) {
      const siteObsStr = String(siteObservations).trim();
      if (siteObsStr === 'Resolved') {
        ccrStatus = 'Pending'; // When Resolved is submitted, CCR status should be Pending
        console.log('[saveEquipmentOfflineSite] Setting CCR status to Pending for Resolved observation');
      }
    }
    
    // Also check if finalSiteObservations is empty (which means Resolved) and ccrStatus wasn't set
    // This handles edge cases where Resolved might be passed as empty string
    if (ccrStatus === '' && finalSiteObservations === '') {
      // Check if this is actually a Resolved status (not just an empty initial value)
      // Only set to Pending if we have other data indicating this is a Resolved submission
      const hasResolvedData = taskStatus === 'Resolved' || 
                             (taskStatus !== undefined && String(taskStatus).toLowerCase().includes('resolved')) ||
                             (remarks && String(remarks).trim() !== '') ||
                             (viewPhotos && Array.isArray(viewPhotos) && viewPhotos.length > 0);
      
      if (hasResolvedData) {
        ccrStatus = 'Pending';
        console.log('[saveEquipmentOfflineSite] Setting CCR status to Pending based on Resolved data indicators');
      }
    }
    
    console.log('[saveEquipmentOfflineSite] Final siteObservations value:', finalSiteObservations);
    console.log('[saveEquipmentOfflineSite] CCR Status value:', ccrStatus);
    console.log('[saveEquipmentOfflineSite] Remarks received:', { 
      remarks, 
      type: typeof remarks, 
      isUndefined: remarks === undefined, 
      isNull: remarks === null,
      isEmpty: remarks === '',
      stringValue: remarks !== undefined && remarks !== null ? String(remarks) : 'N/A'
    });
    
    // Ensure remarks is always saved as a string (even if empty)
    const finalRemarks = remarks !== undefined && remarks !== null ? String(remarks) : '';
    console.log('[saveEquipmentOfflineSite] Final remarks value:', finalRemarks);
    
    // CRITICAL: Prevent updating routed documents
    // Routed documents have "-routed-" in their rowKey and should NEVER be updated by saveEquipmentOfflineSite
    if (rowKey && rowKey.includes('-routed-')) {
      console.log('[saveEquipmentOfflineSite] ⚠️ BLOCKED: Attempt to update routed document:', {
        rowKey: rowKey,
        userId: userId,
        siteCode: siteCode.trim().toUpperCase()
      });
      return res.status(400).json({
        success: false,
        error: 'Cannot update routed documents. Routed documents are read-only.'
      });
    }
    
    // Check if there's an existing record with Pending status
    // IMPORTANT: After ownership transfer during routing, the document's userId changes
    // So we first try to find by fileId+rowKey without userId filter to handle ownership transfer cases
    let existingRecord = await EquipmentOfflineSites.findOne({ fileId, rowKey });
    
    // If found but userId doesn't match, check if ownership was transferred
    if (existingRecord && existingRecord.userId !== userId) {
      console.log('[saveEquipmentOfflineSite] ⚠️ Document found but userId mismatch - checking for ownership transfer:', {
        foundUserId: existingRecord.userId,
        requestedUserId: userId,
        rowKey: rowKey,
        savedFrom: existingRecord.savedFrom
      });
      
      // If the document shows ownership transfer, update it using the found document (new owner)
      if (existingRecord.savedFrom && existingRecord.savedFrom.includes('Ownership transferred')) {
        console.log('[saveEquipmentOfflineSite] ✓ Document has transferred ownership - will update using new owner userId');
        // Use the existing record (with new userId after transfer)
        // The document's userId is now the new owner, so we'll update it with that userId
        // Note: We keep the existing record and will use its userId in the update
      } else {
        // Document exists but ownership wasn't transferred - this might be an error case
        // Try to find with original userId as fallback
        const recordWithOriginalUserId = await EquipmentOfflineSites.findOne({ fileId, rowKey, userId });
        if (recordWithOriginalUserId) {
          existingRecord = recordWithOriginalUserId;
          console.log('[saveEquipmentOfflineSite] Found record with original userId');
        } else {
          console.log('[saveEquipmentOfflineSite] ⚠️ Document exists with different userId and no ownership transfer - will update with current document');
          // Use the found document
        }
      }
    } else if (!existingRecord) {
      // If not found by fileId+rowKey, try with userId filter as fallback
      existingRecord = await EquipmentOfflineSites.findOne({ fileId, rowKey, userId });
    }
    
    // If not found by fileId/rowKey, check for any Pending record with the same siteCode
    // This handles cases where status is changed from different sources (Dashboard vs MY OFFLINE SITES)
    if (!existingRecord && finalSiteObservations === '') {
      // New status is Resolved, so check if there's any Pending record for this siteCode
      // Search for records that are NOT Resolved (i.e., Pending)
      const allSiteRecords = await EquipmentOfflineSites.find({ 
        siteCode: siteCode.trim().toUpperCase(), 
        userId 
      })
      .sort({ createdAt: -1 }) // Get the most recent ones first
      .lean();
      
      console.log('[saveEquipmentOfflineSite] Found', allSiteRecords.length, 'records for siteCode:', siteCode.trim().toUpperCase());
      
      // Find the most recent Pending record (not Resolved)
      for (const candidate of allSiteRecords) {
        const candidateSiteObs = candidate.siteObservations ? String(candidate.siteObservations).trim() : '';
        const candidateTaskStatus = candidate.taskStatus ? String(candidate.taskStatus).trim() : '';
        const candidateTypeOfIssue = candidate.typeOfIssue ? String(candidate.typeOfIssue).trim() : '';
        
        // Check if this candidate is Pending (not Resolved)
        const isCandidatePending = candidateSiteObs !== '' || 
          (candidateTaskStatus !== '' && !/^resolved$/i.test(candidateTaskStatus)) || 
          candidateTypeOfIssue !== '';
        
        // Also check it's not already Resolved
        const isCandidateResolved = candidateSiteObs === '' && 
          (candidateTaskStatus === '' || /^resolved$/i.test(candidateTaskStatus)) && 
          candidateTypeOfIssue === '';
        
        if (isCandidatePending && !isCandidateResolved) {
          existingRecord = candidate;
          console.log('[saveEquipmentOfflineSite] Found Pending record by siteCode:', {
            siteCode: existingRecord.siteCode,
            fileId: existingRecord.fileId,
            rowKey: existingRecord.rowKey,
            _id: existingRecord._id,
            siteObservations: candidateSiteObs,
            taskStatus: candidateTaskStatus,
            typeOfIssue: candidateTypeOfIssue
          });
          break; // Use the most recent Pending record
        }
      }
    }
    
    // Log existing record details for debugging
    if (existingRecord) {
      console.log('[saveEquipmentOfflineSite] Existing record found:', {
        siteCode: existingRecord.siteCode,
        fileId: existingRecord.fileId,
        rowKey: existingRecord.rowKey,
        siteObservations: existingRecord.siteObservations,
        taskStatus: existingRecord.taskStatus,
        typeOfIssue: existingRecord.typeOfIssue,
        remarks: existingRecord.remarks
      });
    } else {
      console.log('[saveEquipmentOfflineSite] No existing record found for siteCode:', siteCode.trim().toUpperCase());
    }
    
    // Determine if we're changing from Pending to Resolved
    // A record is considered Pending if:
    // 1. siteObservations is non-empty (e.g., "Pending", "Faulty", etc.), OR
    // 2. taskStatus is non-empty and not "Resolved" (e.g., "Pending at O&M Team", etc.), OR
    // 3. typeOfIssue is non-empty (indicates an issue was reported, so it's Pending)
    const existingSiteObs = existingRecord?.siteObservations ? String(existingRecord.siteObservations).trim() : '';
    const existingTaskStatus = existingRecord?.taskStatus ? String(existingRecord.taskStatus).trim() : '';
    const existingTypeOfIssue = existingRecord?.typeOfIssue ? String(existingRecord.typeOfIssue).trim() : '';
    
    const existingIsPending = existingRecord && (
      existingSiteObs !== '' || // siteObservations is non-empty (Pending)
      (existingTaskStatus !== '' && !/^resolved$/i.test(existingTaskStatus)) || // taskStatus is not empty and not "Resolved"
      existingTypeOfIssue !== '' // typeOfIssue is non-empty (indicates Pending issue)
    );
    
    // New status is Resolved if siteObservations is empty string
    const newIsResolved = finalSiteObservations === '';
    
    // We're changing from Pending to Resolved if:
    // - There's an existing record that is Pending, AND
    // - The new status is Resolved
    const isChangingToResolved = existingIsPending && newIsResolved;
    
    console.log('[saveEquipmentOfflineSite] Status change detection:', {
      hasExistingRecord: !!existingRecord,
      existingSiteObservations: existingSiteObs,
      existingTaskStatus: existingTaskStatus,
      existingTypeOfIssue: existingTypeOfIssue,
      existingIsPending,
      finalSiteObservations,
      newIsResolved,
      isChangingToResolved,
      willCreateNewDocument: isChangingToResolved
    });
    
    let offlineSite;
    
    if (isChangingToResolved) {
      // Create a NEW document when changing from Pending to Resolved
      console.log('[saveEquipmentOfflineSite] ===== CREATING NEW DOCUMENT =====');
      console.log('[saveEquipmentOfflineSite] Changing from Pending to Resolved for siteCode:', siteCode.trim().toUpperCase());
      console.log('[saveEquipmentOfflineSite] Existing record ID (will be preserved):', existingRecord._id);
      
      // Modify rowKey to make it unique (append "-resolved" and timestamp to avoid duplicate key error)
      // The unique index on fileId + rowKey prevents creating a new document with the same values
      const timestamp = Date.now();
      const uniqueRowKey = `${rowKey}-resolved-${timestamp}`;
      console.log('[saveEquipmentOfflineSite] Original rowKey:', rowKey);
      console.log('[saveEquipmentOfflineSite] New unique rowKey:', uniqueRowKey);
      
      // Create new document - MongoDB will assign a new _id automatically
      offlineSite = new EquipmentOfflineSites({
        fileId,
        rowKey: uniqueRowKey, // Use unique rowKey to avoid duplicate key error
        siteCode: siteCode.trim().toUpperCase(),
        userId,
        originalRowData,
        headers: headers || [],
        siteObservations: finalSiteObservations, // Empty string for Resolved
        ccrStatus: ccrStatus, // Set CCR status (Pending when Resolved)
        taskStatus: taskStatus !== undefined ? taskStatus : 'Resolved',
        typeOfIssue: typeOfIssue !== undefined ? String(typeOfIssue) : '',
        viewPhotos: viewPhotos || [],
        photoMetadata: photoMetadata || [],
        remarks: finalRemarks,
        supportDocuments: supportDocuments || [],
        deviceStatus: deviceStatus || '',
        noOfDaysOffline: noOfDaysOffline || null,
        circle: circle.trim(),
        division: division.trim(),
        subDivision: subDivision.trim(),
        savedFrom: savedFrom || 'MY OFFLINE SITES',
        lastSyncedAt: new Date(),
        createdAt: new Date(), // Explicitly set createdAt for new document
      });
      
      await offlineSite.save();
      console.log('[saveEquipmentOfflineSite] ===== NEW DOCUMENT CREATED SUCCESSFULLY =====');
      console.log('[saveEquipmentOfflineSite] New record ID:', offlineSite._id);
      console.log('[saveEquipmentOfflineSite] New record createdAt:', offlineSite.createdAt);
      console.log('[saveEquipmentOfflineSite] New record siteObservations:', offlineSite.siteObservations);
      console.log('[saveEquipmentOfflineSite] New record taskStatus:', offlineSite.taskStatus);
      console.log('[saveEquipmentOfflineSite] New record remarks:', offlineSite.remarks);
      console.log('[saveEquipmentOfflineSite] Old record ID (still exists):', existingRecord._id);
    } else {
      // Update existing record or create if doesn't exist (normal behavior)
      // Determine if we should set ccrStatus to Pending
      // Set to Pending if: Resolved is being submitted AND (no existing record OR existing record doesn't have Approved/Monitoring status)
      const shouldSetCCRStatusPending = ccrStatus === 'Pending';
      const existingCCRStatus = existingRecord?.ccrStatus ? String(existingRecord.ccrStatus).trim() : '';
      const shouldUpdateCCRStatus = shouldSetCCRStatusPending && existingCCRStatus !== 'Approved' && existingCCRStatus !== 'Kept for Monitoring';
      
      // Use the existing record's userId if ownership was transferred (don't override with old userId)
      const updateUserId = existingRecord && existingRecord.userId ? existingRecord.userId : userId;
      
      const updateData = {
        fileId,
        rowKey,
        siteCode: siteCode.trim().toUpperCase(),
        userId: updateUserId, // Use existing record's userId if ownership was transferred
        originalRowData,
        headers: headers || [],
        siteObservations: finalSiteObservations,
        taskStatus: taskStatus !== undefined ? taskStatus : '',
        typeOfIssue: typeOfIssue !== undefined ? String(typeOfIssue) : '', // Explicitly convert to string
        viewPhotos: viewPhotos || [],
        photoMetadata: photoMetadata || [],
        remarks: finalRemarks, // Use the processed remarks value
        supportDocuments: supportDocuments || [],
        deviceStatus: deviceStatus || '',
        noOfDaysOffline: noOfDaysOffline || null,
        circle: circle.trim(),
        division: division.trim(),
        subDivision: subDivision.trim(),
        savedFrom: savedFrom || 'MY OFFLINE SITES',
        lastSyncedAt: new Date(),
      };
      
      // CRITICAL: Preserve existing ccrStatus if it's already 'Approved' or 'Kept for Monitoring'
      // Only update to 'Pending' if it's not already in a final approval state
      if (existingCCRStatus === 'Approved' || existingCCRStatus === 'Kept for Monitoring') {
        // Preserve the existing approved/monitoring status - DO NOT overwrite it
        updateData.ccrStatus = existingCCRStatus;
        console.log('[saveEquipmentOfflineSite] Preserving existing ccrStatus (Approved/Monitoring):', {
          existingCCRStatus: existingCCRStatus,
          preserved: true
        });
      } else if (shouldUpdateCCRStatus) {
        // Set ccrStatus to Pending if Resolved is being submitted (unless already Approved/Monitoring)
        updateData.ccrStatus = 'Pending';
        console.log('[saveEquipmentOfflineSite] Setting ccrStatus to Pending in update:', {
          existingCCRStatus: existingCCRStatus,
          newCCRStatus: 'Pending'
        });
      }
      // If neither condition is met, ccrStatus is not included in updateData, so it won't be changed
      
      // CRITICAL: If we have an existingRecord (especially after ownership transfer),
      // use its _id for the update query instead of fileId+rowKey+userId
      // This prevents duplicate key errors when userId has changed
      let updateQuery;
      if (existingRecord && existingRecord._id) {
        // Use _id when we have an existing record (handles ownership transfer cases)
        updateQuery = { _id: existingRecord._id };
        console.log('[saveEquipmentOfflineSite] Using existing record _id for update (handles ownership transfer):', {
          documentId: existingRecord._id.toString(),
          currentUserId: existingRecord.userId,
          requestedUserId: userId
        });
      } else {
        // Use fileId+rowKey+userId for normal cases
        updateQuery = { fileId, rowKey, userId };
        console.log('[saveEquipmentOfflineSite] Using fileId+rowKey+userId for update');
      }
      
      offlineSite = await EquipmentOfflineSites.findOneAndUpdate(
        updateQuery,
        updateData,
        { new: true, upsert: !existingRecord, runValidators: true } // Only upsert if no existing record
      );
      
      console.log('[saveEquipmentOfflineSite] Updated record ID:', offlineSite._id, 'updatedAt:', offlineSite.updatedAt);
      console.log('[saveEquipmentOfflineSite] Saved remarks in updated record:', offlineSite.remarks);
    }

    // ===================================================================
    // CRITICAL: Trigger Action Completion and Approval when Resolved
    // When a routed document is resolved, update the related action to "Completed"
    // This will trigger the approval creation logic in updateActionStatus
    // ===================================================================
    if (finalSiteObservations === '' && offlineSite) {
      try {
        // Get current user role first to check if this is a routed user resolving
        const currentUserDoc = await User.findOne({ userId: userId }).lean();
        const currentUserRole = currentUserDoc?.role || '';
        
        // Check if this is a routed document (has routing suffix in rowKey)
        // OR if ownership was transferred (savedFrom indicates routing)
        // OR if current user is a routed user (RTU/Communication, O&M, etc.) resolving
        const isRoutedDocument = rowKey && rowKey.includes('-routed-');
        const hasOwnershipTransfer = offlineSite.savedFrom && 
          (offlineSite.savedFrom.includes('Ownership transferred') || 
           offlineSite.savedFrom.includes('Routed from'));
        const isRoutedUser = currentUserRole && 
          !['Equipment', 'AMC', 'CCR', 'Admin'].includes(currentUserRole);
        
        console.log('[saveEquipmentOfflineSite] 🔍 Checking if approval should be created:', {
          rowKey: rowKey,
          siteCode: siteCode.trim().toUpperCase(),
          userId: userId,
          currentUserRole: currentUserRole,
          isRoutedDocument: isRoutedDocument,
          hasOwnershipTransfer: hasOwnershipTransfer,
          isRoutedUser: isRoutedUser,
          savedFrom: offlineSite.savedFrom,
          shouldCreateApproval: isRoutedDocument || hasOwnershipTransfer || isRoutedUser
        });
        
        // Handle routed documents, ownership-transferred documents, OR routed users resolving
        if (isRoutedDocument || hasOwnershipTransfer || isRoutedUser) {
          console.log('[saveEquipmentOfflineSite] 🔍 Resolved routed/transferred document detected - finding related action:', {
            rowKey: rowKey,
            siteCode: siteCode.trim().toUpperCase(),
            userId: userId,
            isRoutedDocument: isRoutedDocument,
            hasOwnershipTransfer: hasOwnershipTransfer,
            savedFrom: offlineSite.savedFrom
          });
          
          // Extract base rowKey to find the original action (if routed document)
          const baseRowKey = isRoutedDocument ? rowKey.split('-routed-')[0] : rowKey;
          
          // Find the action related to this resolution
          // Strategy 1: Try to find by sourceFileId and rowKey (or base rowKey)
          let relatedAction = await Action.findOne({
            sourceFileId: fileId,
            $or: [
              { rowKey: rowKey },
              { rowKey: baseRowKey },
              { 'rowData.__siteObservationRowKey': rowKey },
              { 'rowData.__siteObservationRowKey': baseRowKey }
            ],
            assignedToUserId: userId,
            status: { $in: ['Pending', 'In Progress', 'Completed'] }
          })
          .sort({ createdAt: -1 })
          .lean();
          
          // Strategy 2: If not found, try finding by siteCode from rowData
          if (!relatedAction) {
            const siteCodeUpper = siteCode.trim().toUpperCase();
            relatedAction = await Action.findOne({
              sourceFileId: fileId,
              assignedToUserId: userId,
              status: { $in: ['Pending', 'In Progress', 'Completed'] },
              $or: [
                { 'rowData.Site Code': siteCodeUpper },
                { 'rowData.SITE CODE': siteCodeUpper },
                { 'rowData.Code': siteCodeUpper },
                { 'rowData.CODE': siteCodeUpper }
              ]
            })
            .sort({ createdAt: -1 })
            .lean();
          }
          
          // Strategy 3: Try finding by siteCode without userId filter (for ownership transfer or routed users)
          if (!relatedAction) {
            const siteCodeUpper = siteCode.trim().toUpperCase();
            relatedAction = await Action.findOne({
              sourceFileId: fileId,
              assignedToRole: currentUserRole, // Match by role instead of userId
              status: { $in: ['Pending', 'In Progress', 'Completed'] },
              $or: [
                { 'rowData.Site Code': siteCodeUpper },
                { 'rowData.SITE CODE': siteCodeUpper }
              ]
            })
            .sort({ createdAt: -1 })
            .lean();
            
            console.log('[saveEquipmentOfflineSite] Strategy 3 result (by siteCode with role):', {
              found: !!relatedAction,
              actionId: relatedAction?._id?.toString(),
              assignedToRole: relatedAction?.assignedToRole
            });
          }
          
          // Strategy 4: Most permissive - try finding by siteCode without any user filter
          if (!relatedAction) {
            const siteCodeUpper = siteCode.trim().toUpperCase();
            relatedAction = await Action.findOne({
              sourceFileId: fileId,
              status: { $in: ['Pending', 'In Progress', 'Completed'] },
              $or: [
                { 'rowData.Site Code': siteCodeUpper },
                { 'rowData.SITE CODE': siteCodeUpper }
              ]
            })
            .sort({ createdAt: -1 })
            .lean();
            
            console.log('[saveEquipmentOfflineSite] Strategy 4 result (by siteCode only):', {
              found: !!relatedAction,
              actionId: relatedAction?._id?.toString(),
              assignedToUserId: relatedAction?.assignedToUserId,
              assignedToRole: relatedAction?.assignedToRole,
              typeOfIssue: relatedAction?.typeOfIssue
            });
            
            if (relatedAction) {
              console.log('[saveEquipmentOfflineSite] ✓ Found action (most permissive search):', {
                actionId: relatedAction._id.toString(),
                assignedToUserId: relatedAction.assignedToUserId,
                currentUserId: userId,
                assignedToRole: relatedAction.assignedToRole,
                currentUserRole: currentUserRole,
                typeOfIssue: relatedAction.typeOfIssue
              });
            }
          }
          
          // If still no action found, log all possible actions for debugging
          if (!relatedAction) {
            console.error('[saveEquipmentOfflineSite] ❌ No action found with any strategy. Debugging...');
            const siteCodeUpper = siteCode.trim().toUpperCase();
            const allActionsForSite = await Action.find({
              sourceFileId: fileId,
              $or: [
                { 'rowData.Site Code': siteCodeUpper },
                { 'rowData.SITE CODE': siteCodeUpper }
              ]
            })
            .select('_id assignedToUserId assignedToRole status typeOfIssue createdAt rowKey')
            .sort({ createdAt: -1 })
            .lean();
            
            console.error('[saveEquipmentOfflineSite] All actions found for this site:', {
              siteCode: siteCodeUpper,
              fileId: fileId,
              totalActions: allActionsForSite.length,
              actions: allActionsForSite.map(a => ({
                actionId: a._id.toString(),
                assignedToUserId: a.assignedToUserId,
                assignedToRole: a.assignedToRole,
                status: a.status,
                typeOfIssue: a.typeOfIssue,
                rowKey: a.rowKey,
                createdAt: a.createdAt
              }))
            });
          }
          
          if (relatedAction) {
            console.log('[saveEquipmentOfflineSite] Found related action - updating to Completed:', {
              actionId: relatedAction._id,
              currentStatus: relatedAction.status,
              assignedToUserId: relatedAction.assignedToUserId,
              typeOfIssue: relatedAction.typeOfIssue
            });
            
            // Update action status to Completed
            // This will trigger the approval creation logic when updateActionStatus is called
            // But we need to trigger it here directly
            const action = await Action.findById(relatedAction._id);
            if (action && action.status !== 'Completed') {
              action.status = 'Completed';
              action.completedDate = new Date();
              if (remarks) {
                action.remarks = (action.remarks || '') + (action.remarks ? '\n\n' : '') + remarks;
              }
              await action.save();
              
              console.log('[saveEquipmentOfflineSite] ✓ Action updated to Completed:', {
                actionId: action._id,
                newStatus: action.status
              });
              
              // Now trigger the approval creation logic
              // Import the logic from updateActionStatus or call it directly
              // For now, we'll create the approval directly here
              const isAMCApprovalType = action.typeOfIssue === 'AMC Resolution Approval';
              const isCCRApprovalType = action.typeOfIssue === 'CCR Resolution Approval';
              const isRegularAction = !isAMCApprovalType && !isCCRApprovalType;
              const isNonAMCNonCCR = userId && !['AMC', 'CCR'].includes(userId);
              
              // Get current user role
              const currentUserDoc = await User.findOne({ userId: userId }).lean();
              const currentUserRole = currentUserDoc?.role || '';
              
              console.log('[saveEquipmentOfflineSite] 🔍 Approval workflow check:', {
                currentUserRole: currentUserRole,
                isRegularAction: isRegularAction,
                actionId: action._id.toString(),
                siteCode: siteCode.trim().toUpperCase()
              });
              
              // ===================================================================
              // APPROVAL WORKFLOW BASED ON USER ROLE
              // ===================================================================
              
              if (isRegularAction) {
                // ===================================================================
                // CASE 1: AMC USER RESOLVES → Create Equipment Approval (First Approval)
                // ===================================================================
                if (currentUserRole === 'AMC') {
                  console.log('[saveEquipmentOfflineSite] 🔄 AMC user resolved - Creating Equipment approval (First Approval)');
                  
                  // Find Equipment user (preferably the one who originally routed this)
                  let equipmentUser = null;
                  
                  // Try to find the Equipment user who originally routed this action
                  if (action.assignedByUserId && action.assignedByRole === 'Equipment') {
                    const originalEquipmentUser = await User.findOne({ 
                      userId: action.assignedByUserId,
                      role: 'Equipment',
                      status: 'approved',
                      isActive: true
                    }).lean();
                    
                    if (originalEquipmentUser) {
                      equipmentUser = originalEquipmentUser;
                      console.log('[saveEquipmentOfflineSite] Found original Equipment user who routed this:', {
                        userId: equipmentUser.userId,
                        fullName: equipmentUser.fullName
                      });
                    }
                  }
                  
                  // If not found, get any Equipment user
                  if (!equipmentUser) {
                    const allEquipmentUsers = await User.find({
                      role: 'Equipment',
                      status: 'approved',
                      isActive: true
                    }).lean();
                    
                    if (allEquipmentUsers.length > 0) {
                      equipmentUser = allEquipmentUsers[0];
                      console.log('[saveEquipmentOfflineSite] Using first available Equipment user:', {
                        userId: equipmentUser.userId,
                        fullName: equipmentUser.fullName
                      });
                    }
                  }
                  
                  if (equipmentUser) {
                    // Check if Equipment approval already exists
                    const existingEquipmentAction = await Action.findOne({
                      typeOfIssue: 'AMC Resolution Approval',
                      sourceFileId: fileId,
                      'rowData.Site Code': siteCode.trim().toUpperCase(),
                      assignedToUserId: equipmentUser.userId,
                      status: { $in: ['Pending', 'In Progress'] }
                    }).lean();
                    
                    if (!existingEquipmentAction) {
                      console.log('[saveEquipmentOfflineSite] Creating Equipment approval (First Approval for AMC):', {
                        originalActionId: action._id,
                        equipmentUserId: equipmentUser.userId,
                        siteCode: siteCode.trim().toUpperCase()
                      });
                      
                      // Create Equipment approval action
                      const equipmentApproval = await Action.create({
                        rowData: {
                          ...(action.rowData || {}),
                          _actionId: action._id.toString(),
                          __siteObservationStatus: 'Resolved',
                          __amcResolutionActionId: action._id.toString()
                        },
                        headers: action.headers || [],
                        routing: 'Equipment Team',
                        typeOfIssue: 'AMC Resolution Approval',
                        remarks: remarks || 'AMC resolution completed; pending Equipment approval',
                        photo: action.photo || null,
                        assignedToUserId: equipmentUser.userId,
                        assignedToRole: 'Equipment',
                        assignedToDivision: action.assignedToDivision || null,
                        assignedByUserId: userId,
                        assignedByRole: 'AMC',
                        sourceFileId: fileId,
                        originalRowIndex: action.originalRowIndex || null,
                        status: 'Pending',
                        priority: action.priority || 'Medium',
                        assignedDate: new Date()
                      });
                      
                      // Create Approval document for Equipment (First Approval)
                      const equipmentApprovalDoc = await Approval.create({
                        actionId: equipmentApproval._id,
                        siteCode: siteCode.trim().toUpperCase(),
                        equipmentOfflineSiteId: offlineSite._id,
                        approvalType: 'AMC Resolution Approval',
                        status: 'Pending',
                        submittedByUserId: userId,
                        submittedByRole: 'AMC',
                        assignedToUserId: equipmentUser.userId,
                        assignedToRole: 'Equipment',
                        submissionRemarks: remarks || 'AMC resolution completed; pending Equipment approval',
                        photos: action.photo ? (Array.isArray(action.photo) ? action.photo : [action.photo]) : [],
                        supportDocuments: [],
                        fileId: fileId,
                        rowKey: rowKey,
                        originalRowData: action.rowData || {},
                        metadata: {
                          originalActionId: action._id.toString(),
                          approvalSequence: 'first'
                        }
                      });
                      
                      console.log('[saveEquipmentOfflineSite] ✅✅✅ Equipment approval created (First Approval for AMC):', {
                        approvalId: equipmentApprovalDoc._id,
                        actionId: equipmentApproval._id,
                        equipmentUserId: equipmentUser.userId,
                        siteCode: siteCode.trim().toUpperCase(),
                        note: 'When Equipment approves, CCR approval will be created automatically'
                      });
                    } else {
                      console.log('[saveEquipmentOfflineSite] Equipment approval already exists:', {
                        existingActionId: existingEquipmentAction._id
                      });
                    }
                  } else {
                    console.error('[saveEquipmentOfflineSite] ❌ No Equipment user found - Cannot create first approval for AMC resolution');
                  }
                }
                // ===================================================================
                // CASE 2: OTHER ROLES (RTU/Communication, O&M, etc.) RESOLVE → Create CCR Approval
                // ===================================================================
                else if (currentUserRole !== 'CCR' && currentUserRole !== 'Equipment') {
                  console.log('[saveEquipmentOfflineSite] 🔄 Non-AMC user resolved - Creating CCR approval:', {
                    userRole: currentUserRole,
                    userId: userId
                  });
                  
                  // Find CCR user
                  const allCCRUsers = await User.find({
                    role: 'CCR',
                    status: 'approved',
                    isActive: true
                  }).lean();
                  
                  const ccrUser = allCCRUsers[0];
                  
                  if (ccrUser) {
                    console.log('[saveEquipmentOfflineSite] Creating CCR approval for resolved routed document:', {
                      originalActionId: action._id,
                      ccrUserId: ccrUser.userId,
                      siteCode: siteCode.trim().toUpperCase(),
                      resolvedByRole: currentUserRole
                    });
                    
                    // Check if CCR approval already exists (check both Action and Approval documents)
                    const siteCodeUpper = siteCode.trim().toUpperCase();
                    
                    const existingCCRAction = await Action.findOne({
                      typeOfIssue: 'CCR Resolution Approval',
                      sourceFileId: fileId,
                      $or: [
                        { 'rowData.Site Code': siteCodeUpper },
                        { 'rowData.SITE CODE': siteCodeUpper }
                      ],
                      status: { $in: ['Pending', 'In Progress'] }
                    }).lean();
                    
                    const existingCCRApproval = await Approval.findOne({
                      approvalType: 'CCR Resolution Approval',
                      siteCode: siteCodeUpper,
                      status: { $in: ['Pending', 'In Progress'] }
                    }).lean();
                    
                    if (!existingCCRAction && !existingCCRApproval) {
                      console.log('[saveEquipmentOfflineSite] No existing CCR approval found - creating new approval');
                    } else {
                      console.log('[saveEquipmentOfflineSite] CCR approval already exists - skipping creation:', {
                        existingActionId: existingCCRAction?._id?.toString(),
                        existingApprovalId: existingCCRApproval?._id?.toString()
                      });
                    }
                    
                    if (!existingCCRAction && !existingCCRApproval) {
                      // Get division from action or offlineSite
                      const division = action.assignedToDivision || 
                        offlineSite.division ||
                        offlineSite.originalRowData?.['DIVISION'] || 
                        offlineSite.originalRowData?.['Division'] || 
                        offlineSite.originalRowData?.['division'] || 
                        offlineSite.originalRowData?.['CIRCLE'] ||
                        offlineSite.circle || 
                        'General';
                      
                      // Create CCR approval action
                      const ccrApproval = await Action.create({
                        rowData: {
                          ...(action.rowData || {}),
                          _actionId: action._id.toString(),
                          __siteObservationStatus: 'Resolved'
                        },
                        headers: action.headers || [],
                        routing: 'CCR Team',
                        typeOfIssue: 'CCR Resolution Approval',
                        remarks: remarks || `Resolution completed by ${currentUserRole} team; pending CCR approval`,
                        photo: action.photo || null,
                        assignedToUserId: ccrUser.userId,
                        assignedToRole: 'CCR',
                        assignedToDivision: division, // Required field - use from action or fallback to 'General'
                        assignedByUserId: action.assignedByUserId || userId,
                        assignedByRole: action.assignedByRole || currentUserRole,
                        sourceFileId: fileId,
                        originalRowIndex: action.originalRowIndex || null,
                        status: 'Pending',
                        priority: action.priority || 'Medium',
                        assignedDate: new Date()
                      });
                      
                      // Create Approval document
                      const approval = await Approval.create({
                        actionId: ccrApproval._id,
                        siteCode: siteCode.trim().toUpperCase(),
                        equipmentOfflineSiteId: offlineSite._id,
                        approvalType: 'CCR Resolution Approval',
                        status: 'Pending',
                        submittedByUserId: action.assignedByUserId || userId,
                        submittedByRole: action.assignedByRole || currentUserRole,
                        assignedToUserId: ccrUser.userId,
                        assignedToRole: 'CCR',
                        submissionRemarks: remarks || `Resolution completed by ${currentUserRole} team; pending CCR approval`,
                        photos: action.photo ? (Array.isArray(action.photo) ? action.photo : [action.photo]) : [],
                        supportDocuments: [],
                        fileId: fileId,
                        rowKey: rowKey,
                        originalRowData: action.rowData || {},
                        metadata: {}
                      });
                      
                      console.log('[saveEquipmentOfflineSite] ✅✅✅ CCR approval created:', {
                        approvalId: approval._id.toString(),
                        actionId: ccrApproval._id.toString(),
                        siteCode: siteCode.trim().toUpperCase(),
                        resolvedByRole: currentUserRole,
                        assignedToUserId: approval.assignedToUserId,
                        assignedToRole: approval.assignedToRole,
                        status: approval.status,
                        note: 'Any CCR user can see this approval (CCR users are not division-specific)'
                      });
                      
                      // Send notification to all CCR users (since any CCR user can approve)
                      try {
                        const allCCRUsers = await User.find({
                          role: 'CCR',
                          status: 'approved',
                          isActive: true
                        }).select('userId fullName').lean();
                        
                        const notifications = allCCRUsers.map(ccrUser => ({
                          userId: ccrUser.userId,
                          title: 'New Resolution Approval Required',
                          message: `Site ${siteCode.trim().toUpperCase()} resolution requires CCR approval.`,
                          type: 'info',
                          category: 'approval',
                          application: 'Equipment Maintenance',
                          link: '/dashboard/my-approvals',
                          metadata: {
                            approvalId: approval._id.toString(),
                            actionId: ccrApproval._id.toString(),
                            siteCode: siteCode.trim().toUpperCase()
                          }
                        }));
                        
                        await Notification.insertMany(notifications);
                        console.log('[saveEquipmentOfflineSite] ✅ Notifications sent to all CCR users:', {
                          ccrUsersCount: allCCRUsers.length,
                          siteCode: siteCode.trim().toUpperCase()
                        });
                      } catch (notifError) {
                        console.error('[saveEquipmentOfflineSite] Error sending notifications to CCR users:', notifError.message);
                      }
                    } else {
                      console.log('[saveEquipmentOfflineSite] CCR approval already exists:', {
                        existingActionId: existingCCRAction._id
                      });
                    }
                  } else {
                    console.error('[saveEquipmentOfflineSite] ❌ No CCR user found - Cannot create approval');
                  }
                } else {
                  console.log('[saveEquipmentOfflineSite] Skipping approval creation:', {
                    reason: currentUserRole === 'CCR' ? 'CCR users cannot create approvals for themselves' : 
                            currentUserRole === 'Equipment' ? 'Equipment users resolve through different workflow' : 'Unknown role',
                    userRole: currentUserRole
                  });
                }
              }
            }
          } else {
            // No action found - but we still need to create approval for routed users
            console.log('[saveEquipmentOfflineSite] ⚠️ No related action found, but checking if we can create approval directly:', {
              rowKey: rowKey,
              siteCode: siteCode.trim().toUpperCase(),
              userId: userId,
              currentUserRole: currentUserRole,
              isRoutedUser: isRoutedUser
            });
            
            // If this is a routed user resolving and no action found, create action and approval directly
            if (isRoutedUser && currentUserRole && !['Equipment', 'AMC', 'CCR'].includes(currentUserRole)) {
              console.log('[saveEquipmentOfflineSite] Creating CCR approval directly (no action found, but routed user resolved):', {
                siteCode: siteCode.trim().toUpperCase(),
                resolvedByRole: currentUserRole,
                resolvedByUserId: userId
              });
              
              try {
                // Find CCR user
                const allCCRUsers = await User.find({
                  role: 'CCR',
                  status: 'approved',
                  isActive: true
                }).lean();
                
                const ccrUser = allCCRUsers[0];
                
                if (ccrUser) {
                  const siteCodeUpper = siteCode.trim().toUpperCase();
                  
                  // Check if CCR approval already exists
                  const existingCCRApproval = await Approval.findOne({
                    approvalType: 'CCR Resolution Approval',
                    siteCode: siteCodeUpper,
                    status: { $in: ['Pending', 'In Progress'] }
                  }).lean();
                  
                  if (!existingCCRApproval) {
                    // Get division from offlineSite or originalRowData
                    const division = offlineSite.division || 
                      offlineSite.originalRowData?.['DIVISION'] || 
                      offlineSite.originalRowData?.['Division'] || 
                      offlineSite.originalRowData?.['division'] || 
                      offlineSite.originalRowData?.['CIRCLE'] ||
                      offlineSite.circle || 
                      '';
                    
                    // Create CCR approval action first
                    const ccrApprovalAction = await Action.create({
                      rowData: offlineSite.originalRowData || {},
                      headers: offlineSite.headers || [],
                      routing: 'CCR Team',
                      typeOfIssue: 'CCR Resolution Approval',
                      remarks: remarks || `Resolution completed by ${currentUserRole} team; pending CCR approval`,
                      photo: offlineSite.viewPhotos || null,
                      assignedToUserId: ccrUser.userId,
                      assignedToRole: 'CCR',
                      assignedToDivision: division || 'General', // Required field - use division or default
                      assignedByUserId: userId,
                      assignedByRole: currentUserRole,
                      sourceFileId: fileId,
                      status: 'Pending',
                      priority: 'Medium',
                      assignedDate: new Date()
                    });
                    
                    // Create Approval document
                    const approval = await Approval.create({
                      actionId: ccrApprovalAction._id,
                      siteCode: siteCodeUpper,
                      equipmentOfflineSiteId: offlineSite._id,
                      approvalType: 'CCR Resolution Approval',
                      status: 'Pending',
                      submittedByUserId: userId,
                      submittedByRole: currentUserRole,
                      assignedToUserId: ccrUser.userId,
                      assignedToRole: 'CCR',
                      submissionRemarks: remarks || `Resolution completed by ${currentUserRole} team; pending CCR approval`,
                      photos: offlineSite.viewPhotos || [],
                      supportDocuments: offlineSite.supportDocuments || [],
                      fileId: fileId,
                      rowKey: rowKey,
                      originalRowData: offlineSite.originalRowData || {},
                      metadata: {}
                    });
                    
                    console.log('[saveEquipmentOfflineSite] ✅✅✅ CCR approval created directly (fallback - no action found):', {
                      approvalId: approval._id.toString(),
                      actionId: ccrApprovalAction._id.toString(),
                      siteCode: siteCodeUpper,
                      resolvedByRole: currentUserRole
                    });
                    
                    // Send notification to all CCR users
                    try {
                      const allCCRUsersForNotif = await User.find({
                        role: 'CCR',
                        status: 'approved',
                        isActive: true
                      }).select('userId fullName').lean();
                      
                      const notifications = allCCRUsersForNotif.map(ccrUser => ({
                        userId: ccrUser.userId,
                        title: 'New Resolution Approval Required',
                        message: `Site ${siteCodeUpper} resolution requires CCR approval.`,
                        type: 'info',
                        category: 'approval',
                        application: 'Equipment Maintenance',
                        link: '/dashboard/my-approvals',
                        metadata: {
                          approvalId: approval._id.toString(),
                          actionId: ccrApprovalAction._id.toString(),
                          siteCode: siteCodeUpper
                        }
                      }));
                      
                      await Notification.insertMany(notifications);
                      console.log('[saveEquipmentOfflineSite] ✅ Notifications sent to all CCR users (fallback):', {
                        ccrUsersCount: allCCRUsersForNotif.length,
                        siteCode: siteCodeUpper
                      });
                    } catch (notifError) {
                      console.error('[saveEquipmentOfflineSite] Error sending notifications (fallback):', notifError.message);
                    }
                  } else {
                    console.log('[saveEquipmentOfflineSite] CCR approval already exists (fallback check):', {
                      existingApprovalId: existingCCRApproval._id.toString()
                    });
                  }
                } else {
                  console.error('[saveEquipmentOfflineSite] ❌ No CCR user found - Cannot create approval (fallback)');
                }
              } catch (fallbackError) {
                console.error('[saveEquipmentOfflineSite] ❌ Error creating approval in fallback mode:', {
                  error: fallbackError.message,
                  stack: fallbackError.stack
                });
              }
            }
          }
        }
      } catch (approvalTriggerError) {
        console.error('[saveEquipmentOfflineSite] ❌❌❌ Error triggering approval for resolved document:', {
          error: approvalTriggerError.message,
          stack: approvalTriggerError.stack,
          siteCode: siteCode,
          rowKey: rowKey,
          userId: userId,
          message: 'Document was saved successfully, but approval trigger failed'
        });
        // Don't fail the save operation
      }
    }

    res.status(200).json({
      success: true,
      data: offlineSite,
      message: 'Equipment offline site data saved successfully'
    });
  } catch (error) {
    console.error('Error saving equipment offline site:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save equipment offline site data'
    });
  }
};

// @desc    Bulk save or update multiple equipment offline sites
// @route   POST /api/equipment-offline-sites/bulk
// @access  Private
export const bulkSaveEquipmentOfflineSites = async (req, res) => {
  try {
    const { sites } = req.body; // Array of site data objects
    const userId = req.user.userId;

    if (!Array.isArray(sites) || sites.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sites array is required and must not be empty'
      });
    }

    const results = [];
    const errors = [];

    for (const site of sites) {
      try {
        const {
          fileId,
          rowKey,
          siteCode,
          originalRowData,
          headers,
          siteObservations,
          taskStatus,
          typeOfIssue,
          viewPhotos,
          photoMetadata,
          remarks,
          supportDocuments,
          deviceStatus,
          noOfDaysOffline,
          savedFrom
        } = site;

        if (!fileId || !rowKey || !siteCode || !originalRowData) {
          errors.push({ rowKey: rowKey || 'unknown', error: 'Missing required fields' });
          continue;
        }

        // Extract location information
        const circle = originalRowData['CIRCLE'] || originalRowData['Circle'] || originalRowData['circle'] || '';
        const division = originalRowData['DIVISION'] || originalRowData['Division'] || originalRowData['division'] || '';
        const subDivision = originalRowData['SUB DIVISION'] || originalRowData['Sub Division'] || originalRowData['subDivision'] || originalRowData['sub_division'] || '';

        // CRITICAL: When updating, preserve existing typeOfIssue and remarks if new values are empty
        // This prevents overwriting data saved from Dashboard/My Sites dialog
        const existingSite = await EquipmentOfflineSites.findOne({ fileId, rowKey, userId });
        const finalTypeOfIssue = typeOfIssue !== undefined && typeOfIssue !== null && String(typeOfIssue).trim() !== ''
          ? String(typeOfIssue)
          : (existingSite?.typeOfIssue ? String(existingSite.typeOfIssue) : '');
        const finalRemarks = remarks !== undefined && remarks !== null && String(remarks).trim() !== ''
          ? String(remarks)
          : (existingSite?.remarks ? String(existingSite.remarks) : '');

        // CRITICAL: For Reports compatibility, Resolved = empty string, Pending = non-empty string
        // If siteObservations is 'Resolved' (string), convert to empty string
        let finalSiteObservations = '';
        if (siteObservations !== undefined && siteObservations !== null) {
          const siteObsStr = String(siteObservations).trim();
          if (siteObsStr === 'Resolved') {
            finalSiteObservations = ''; // Resolved = empty string for Reports
            // Log removed per user request
          } else if (siteObsStr === 'Pending' || siteObsStr.length > 0) {
            finalSiteObservations = siteObsStr; // Pending = non-empty string
            if (siteObsStr === 'Pending') {
              // Log removed per user request
            }
          } else {
            finalSiteObservations = ''; // Empty = Resolved
          }
        }
        
        // Determine CCR Status: If Resolved, set to Pending
        let ccrStatus = '';
        if (siteObservations !== undefined && siteObservations !== null) {
          const siteObsStr = String(siteObservations).trim();
          if (siteObsStr === 'Resolved') {
            ccrStatus = 'Pending';
          }
        }
        
        // Also check if finalSiteObservations is empty (which means Resolved) and ccrStatus wasn't set
        if (ccrStatus === '' && finalSiteObservations === '') {
          const hasResolvedData = taskStatus === 'Resolved' || 
                                 (taskStatus !== undefined && String(taskStatus).toLowerCase().includes('resolved')) ||
                                 (finalRemarks && String(finalRemarks).trim() !== '') ||
                                 (viewPhotos && Array.isArray(viewPhotos) && viewPhotos.length > 0);
          
          if (hasResolvedData) {
            ccrStatus = 'Pending';
          }
        }
        
        // Determine if we should set ccrStatus to Pending
        const existingCCRStatus = existingSite?.ccrStatus ? String(existingSite.ccrStatus).trim() : '';
        const shouldUpdateCCRStatus = ccrStatus === 'Pending' && existingCCRStatus !== 'Approved' && existingCCRStatus !== 'Kept for Monitoring';
        
        // Log removed per user request
        
        // Build update data conditionally for ccrStatus
        const bulkUpdateData = {
          fileId,
          rowKey,
          siteCode: siteCode.trim().toUpperCase(),
          userId,
          originalRowData,
          headers: headers || [],
          siteObservations: finalSiteObservations,
          taskStatus: taskStatus !== undefined ? taskStatus : '',
          typeOfIssue: finalTypeOfIssue, // Use preserved or new value
          viewPhotos: viewPhotos || [],
          photoMetadata: photoMetadata || [],
          remarks: finalRemarks, // Use preserved or new value
          supportDocuments: supportDocuments || [],
          deviceStatus: deviceStatus || '',
          noOfDaysOffline: noOfDaysOffline || null,
          circle: circle.trim(),
          division: division.trim(),
          subDivision: subDivision.trim(),
          savedFrom: savedFrom || 'MY OFFLINE SITES',
          lastSyncedAt: new Date(),
        };
        
        // CRITICAL: Preserve existing ccrStatus if it's already 'Approved' or 'Kept for Monitoring'
        // Only update to 'Pending' if it's not already in a final approval state
        if (existingCCRStatus === 'Approved' || existingCCRStatus === 'Kept for Monitoring') {
          // Preserve the existing approved/monitoring status - DO NOT overwrite it
          bulkUpdateData.ccrStatus = existingCCRStatus;
          // Log removed per user request
        } else if (shouldUpdateCCRStatus) {
          // Set ccrStatus to Pending if Resolved is being submitted (unless already Approved/Monitoring)
          bulkUpdateData.ccrStatus = 'Pending';
          // Log removed per user request
        }
        // If neither condition is met, ccrStatus is not included in updateData, so it won't be changed
        
        const offlineSite = await EquipmentOfflineSites.findOneAndUpdate(
          { fileId, rowKey, userId },
          bulkUpdateData,
          { new: true, upsert: true, runValidators: true }
        );

        results.push(offlineSite);
      } catch (error) {
        errors.push({ rowKey: site.rowKey || 'unknown', error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      saved: results.length,
      errors: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error bulk saving equipment offline sites:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk save equipment offline sites'
    });
  }
};

// @desc    Get equipment offline site by fileId and rowKey
// @route   GET /api/equipment-offline-sites/:fileId/:rowKey
// @access  Private
export const getEquipmentOfflineSite = async (req, res) => {
  try {
    const { fileId, rowKey } = req.params;
    const userId = req.user.userId;

    const offlineSite = await EquipmentOfflineSites.findOne({
      fileId,
      rowKey,
      userId
    });

    if (!offlineSite) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: offlineSite
    });
  } catch (error) {
    console.error('Error fetching equipment offline site:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch equipment offline site'
    });
  }
};

// @desc    Get all equipment offline sites for current user
// @route   GET /api/equipment-offline-sites
// @access  Private
export const getAllEquipmentOfflineSites = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fileId, includeApproved } = req.query; // Optional filter by fileId, includeApproved flag

    // Build base query conditions
    const queryConditions = [{ userId }];
    if (fileId) {
      queryConditions.push({ fileId });
    }

    // Exclude records where CCR has approved (ccrStatus === 'Approved') unless includeApproved is true
    // CCR role user is the FINAL approval authority
    // When CCR approves, the record should be hidden from MY OFFLINE SITES tab but remain in database
    // Reports can still access them by passing includeApproved=true
    if (includeApproved !== 'true') {
      // Exclude records where ccrStatus === 'Approved'
      // This will include records where ccrStatus is null, undefined, empty string, 'Pending', 'Kept for Monitoring', etc.
      queryConditions.push({
        $or: [
          { ccrStatus: { $ne: 'Approved' } },
          { ccrStatus: { $exists: false } },
          { ccrStatus: null },
          { ccrStatus: '' }
        ]
      });
      
      // CRITICAL: Also exclude records that have approved CCR approvals in the Approvals collection
      // Find all approved CCR Resolution Approvals
      const approvedApprovals = await Approval.find({
        approvalType: 'CCR Resolution Approval',
        status: 'Approved'
      }).select('equipmentOfflineSiteId siteCode').lean();
      
      console.log('[getAllEquipmentOfflineSites] Found approved CCR approvals:', {
        count: approvedApprovals.length,
        approvals: approvedApprovals.map(a => ({
          equipmentOfflineSiteId: a.equipmentOfflineSiteId?.toString(),
          siteCode: a.siteCode
        }))
      });
      
      // Get list of equipmentOfflineSiteIds and siteCodes that have approved approvals
      const approvedSiteIds = approvedApprovals
        .map(a => a.equipmentOfflineSiteId)
        .filter(id => id !== null && id !== undefined);
      
    const approvedSiteCodes = approvedApprovals
      .map(a => a.siteCode)
      .filter(code => code && code.trim() !== '')
      .map(code => code.trim().toUpperCase());
    
    console.log('[getAllEquipmentOfflineSites] Exclusion criteria:', {
      approvedSiteIdsCount: approvedSiteIds.length,
      approvedSiteCodesCount: approvedSiteCodes.length,
      approvedSiteCodes: approvedSiteCodes,
      checkingSiteCode: '5W1572',
      willExclude: approvedSiteCodes.includes('5W1572')
    });
      
      // Exclude documents that have approved approvals
      // We want to EXCLUDE documents where: _id IN approvedSiteIds OR siteCode IN approvedSiteCodes
      // So we INCLUDE documents where: _id NOT IN approvedSiteIds AND siteCode NOT IN approvedSiteCodes
      if (approvedSiteIds.length > 0 || approvedSiteCodes.length > 0) {
        const inclusionConditions = [];
        
        if (approvedSiteIds.length > 0) {
          // Use ObjectIds directly - MongoDB will handle comparison
          inclusionConditions.push({ _id: { $nin: approvedSiteIds } });
        }
        
        if (approvedSiteCodes.length > 0) {
          // Exclude documents with siteCode in approvedSiteCodes
          inclusionConditions.push({ siteCode: { $nin: approvedSiteCodes } });
        }
        
        if (inclusionConditions.length > 0) {
          // Both conditions must be true (document's _id is NOT in approvedSiteIds AND siteCode is NOT in approvedSiteCodes)
          if (inclusionConditions.length === 1) {
            queryConditions.push(inclusionConditions[0]);
          } else {
            queryConditions.push({ $and: inclusionConditions });
          }
        }
      }
    }

    // Build final query with all conditions combined with $and
    const query = queryConditions.length > 1 ? { $and: queryConditions } : queryConditions[0];

    console.log('[getAllEquipmentOfflineSites] Final query:', JSON.stringify(query, null, 2));
    console.log('[getAllEquipmentOfflineSites] Query conditions count:', queryConditions.length);

    const offlineSites = await EquipmentOfflineSites.find(query)
      .sort({ updatedAt: -1 });
    
    console.log('[getAllEquipmentOfflineSites] Found offline sites:', {
      count: offlineSites.length,
      siteCodes: offlineSites.map(s => s.siteCode)
    });
    
    // CRITICAL: Also return excluded siteCodes for frontend filtering (if includeApproved is not true)
    let excludedSiteCodes = [];
    if (includeApproved !== 'true') {
      // Get excluded siteCodes from approved approvals (already queried above if within the if block)
      // Query again to get siteCodes for response
      const approvedApprovals = await Approval.find({
        approvalType: 'CCR Resolution Approval',
        status: 'Approved'
      }).select('siteCode').lean();
      
      excludedSiteCodes = Array.from(new Set(
        approvedApprovals
          .map(a => a.siteCode)
          .filter(code => code && code.trim() !== '')
          .map(code => code.trim().toUpperCase())
      ));
      
      console.log('[getAllEquipmentOfflineSites] Exclusion summary:', {
        excludedSiteCodesCount: excludedSiteCodes.length,
        excludedSiteCodes: excludedSiteCodes
      });
    }

    res.status(200).json({
      success: true,
      data: offlineSites,
      excludedSiteCodes: excludedSiteCodes, // SiteCodes that should be excluded from frontend display
      count: offlineSites.length
    });
  } catch (error) {
    console.error('Error fetching equipment offline sites:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch equipment offline sites'
    });
  }
};

// @desc    Get equipment offline sites by fileId (returns map by rowKey for compatibility)
// @route   GET /api/equipment-offline-sites/file/:fileId
// @access  Private
export const getEquipmentOfflineSitesByFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    // Exclude records where CCR has approved (ccrStatus === 'Approved')
    // CCR role user is the FINAL approval authority
    // When CCR approves, the record should be hidden from MY OFFLINE SITES tab but remain in database
    
    // CRITICAL: Also exclude records that have approved CCR approvals in the Approvals collection
    // Find all approved CCR Resolution Approvals
    const approvedApprovals = await Approval.find({
      approvalType: 'CCR Resolution Approval',
      status: 'Approved'
    }).select('equipmentOfflineSiteId siteCode').lean();
    
    // Get list of equipmentOfflineSiteIds and siteCodes that have approved approvals
    const approvedSiteIds = approvedApprovals
      .map(a => a.equipmentOfflineSiteId)
      .filter(id => id !== null && id !== undefined);
    
    const approvedSiteCodes = approvedApprovals
      .map(a => a.siteCode)
      .filter(code => code && code.trim() !== '')
      .map(code => code.trim().toUpperCase());
    
    console.log('[getEquipmentOfflineSitesByFile] Exclusion criteria:', {
      approvedSiteIdsCount: approvedSiteIds.length,
      approvedSiteCodesCount: approvedSiteCodes.length,
      approvedSiteCodes: approvedSiteCodes,
      checkingSiteCode: '5W1572',
      willExclude: approvedSiteCodes.includes('5W1572'),
      note: 'These siteCodes will be hidden for ALL users (original AND routed documents)'
    });
    
    // Use explicit $and to ensure fileId, userId, ccrStatus, and approval conditions are all applied
    const queryConditions = [
      { fileId },
      { userId },
      {
        $or: [
          { ccrStatus: { $ne: 'Approved' } },      // Exclude 'Approved' - matches everything else
          { ccrStatus: { $exists: false } },        // Include records where ccrStatus doesn't exist
          { ccrStatus: null },                      // Include records where ccrStatus is null
          { ccrStatus: '' }                         // Include records where ccrStatus is empty string
        ]
      }
    ];
    
    // Add approval exclusion conditions: exclude documents that have approved approvals
    // We want to EXCLUDE documents where: _id IN approvedSiteIds OR siteCode IN approvedSiteCodes
    // So we INCLUDE documents where: _id NOT IN approvedSiteIds AND siteCode NOT IN approvedSiteCodes
    if (approvedSiteIds.length > 0 || approvedSiteCodes.length > 0) {
      const inclusionConditions = [];
      if (approvedSiteIds.length > 0) {
        inclusionConditions.push({ _id: { $nin: approvedSiteIds } });
      }
      if (approvedSiteCodes.length > 0) {
        inclusionConditions.push({ siteCode: { $nin: approvedSiteCodes } });
      }
      
      // Both conditions must be true (document's _id is NOT in approvedSiteIds AND siteCode is NOT in approvedSiteCodes)
      // This ensures we only include documents that don't have approved approvals
      if (inclusionConditions.length > 0) {
        if (inclusionConditions.length === 1) {
          queryConditions.push(inclusionConditions[0]);
        } else {
          queryConditions.push({ $and: inclusionConditions });
        }
      }
    }
    
    const query = {
      $and: queryConditions
    };
    
    const offlineSites = await EquipmentOfflineSites.find(query).sort({ updatedAt: -1 });
    
    // CRITICAL: Get excluded siteCodes from ALL approved approvals, regardless of userId
    // When CCR approves a siteCode, it should be hidden for ALL users, not just the original Equipment user
    // So we get excluded records from ALL users that match approved siteCodes
    
    // Get all excluded rowKeys (those with ccrStatus === 'Approved' OR have approved approvals)
    // NOTE: We still filter by fileId and userId for the excluded records returned to frontend,
    // but excludedSiteCodes will include ALL approved siteCodes for frontend filtering
    const excludedStatusRecords = await EquipmentOfflineSites.find({
      fileId,
      userId,
      ccrStatus: 'Approved'
    })
    .select('rowKey siteCode _id')
    .lean();
    
    // Get records excluded by approved approvals (for current user only, for rowKey exclusion)
    const excludedApprovalConditions = [];
    if (approvedSiteIds.length > 0) {
      excludedApprovalConditions.push({ _id: { $in: approvedSiteIds } });
    }
    if (approvedSiteCodes.length > 0) {
      excludedApprovalConditions.push({ siteCode: { $in: approvedSiteCodes } });
    }
    
    const excludedApprovalRecords = excludedApprovalConditions.length > 0
      ? await EquipmentOfflineSites.find({
          fileId,
          userId,
          $or: excludedApprovalConditions
        })
        .select('rowKey siteCode _id')
        .lean()
      : [];
    
    // Combine and deduplicate excluded records (for current user only)
    const allExcludedRecords = [...excludedStatusRecords];
    excludedApprovalRecords.forEach(record => {
      if (!allExcludedRecords.find(r => r._id.toString() === record._id.toString())) {
        allExcludedRecords.push(record);
      }
    });
    
    const excludedCount = allExcludedRecords.length;

    // Convert to map format for compatibility with web app
    const sitesMap = {};
    offlineSites.forEach(site => {
      sitesMap[site.rowKey] = {
        siteObservations: site.siteObservations,
        taskStatus: site.taskStatus,
        typeOfIssue: site.typeOfIssue,
        viewPhotos: site.viewPhotos,
        photoMetadata: site.photoMetadata,
        remarks: site.remarks,
        supportDocuments: site.supportDocuments,
        originalRowData: site.originalRowData,
        headers: site.headers,
        timestamp: site.updatedAt.toISOString(),
        savedFrom: site.savedFrom,
      };
    });

    // excludedRowKeys already calculated above from allExcludedRecords (includes both ccrStatus and approval exclusions)
    const excludedRowKeys = allExcludedRecords.map(r => r.rowKey);
    
    // CRITICAL: Return excluded siteCodes from ALL approved approvals, regardless of userId
    // When CCR approves a siteCode, it should be hidden for ALL users in MY OFFLINE SITES
    // Frontend rows come from original file data and may not have matching rowKeys
    // So we filter by siteCode instead - and we use ALL approved siteCodes, not just current user's
    
    // Get excluded siteCodes from approved approvals directly - this is the source of truth
    // These are ALL approved siteCodes, regardless of which user owns the record
    const approvedSiteCodesFromApprovals = approvedApprovals
      .map(a => a.siteCode)
      .filter(code => code && code.trim() !== '')
      .map(code => code.trim().toUpperCase());
    
    // Also get excluded siteCodes from current user's excluded records (for completeness)
    const excludedSiteCodes = Array.from(new Set(
      allExcludedRecords
        .map(r => r.siteCode)
        .filter(code => code && code.trim() !== '')
        .map(code => code.trim().toUpperCase())
    ));
    
    // Combine and deduplicate - use ALL approved siteCodes as the final list
    // This ensures that when CCR approves ANY siteCode, it's hidden for ALL users
    const allExcludedSiteCodes = Array.from(new Set([
      ...approvedSiteCodesFromApprovals,  // ALL approved siteCodes (source of truth)
      ...excludedSiteCodes                 // Current user's excluded siteCodes (additional)
    ]));
    
    console.log('[getEquipmentOfflineSitesByFile] Excluded siteCodes calculation:', {
      approvedSiteCodesFromApprovals,
      excludedSiteCodesFromRecords: excludedSiteCodes,
      finalExcludedSiteCodes: allExcludedSiteCodes,
      userId: userId,
      fileId: fileId,
      note: 'excludedSiteCodes include ALL approved siteCodes for ALL users (original AND routed documents)',
      routingNote: 'Routed documents share the same siteCode as original, so they are automatically excluded'
    });
    
    console.log('[getEquipmentOfflineSitesByFile] Exclusion summary:', {
      excludedRowKeysCount: excludedRowKeys.length,
      excludedSiteCodesCount: allExcludedSiteCodes.length,
      excludedSiteCodes: allExcludedSiteCodes,
      excludedCount: excludedCount
    });

    res.status(200).json({
      success: true,
      data: sitesMap,
      excludedRowKeys: excludedRowKeys, // List of rowKeys that were excluded (ccrStatus === 'Approved' or has approved approval)
      excludedSiteCodes: allExcludedSiteCodes, // List of siteCodes that should be excluded from frontend display
      excludedCount: excludedCount,
      count: offlineSites.length
    });
  } catch (error) {
    console.error('Error fetching equipment offline sites by file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch equipment offline sites by file'
    });
  }
};

// @desc    Update only No of Days Offline for matching Site Code and Device Status
// @route   PUT /api/equipment-offline-sites/update-days-offline
// @access  Private
export const updateDaysOfflineOnly = async (req, res) => {
  try {
    const { siteCode, deviceStatus, noOfDaysOffline } = req.body;
    const userId = req.user.userId;

    if (!siteCode || !deviceStatus || noOfDaysOffline === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Site Code, Device Status, and No of Days Offline are required'
      });
    }

    // Find all records matching Site Code and Device Status for this user
    // IMPORTANT: We use native MongoDB update to prevent Mongoose from auto-updating updatedAt
    // This ensures only the specific record being updated gets its updatedAt changed
    const db = EquipmentOfflineSites.db;
    const collection = db.collection('Equipment offline sites');
    
    const updateResult = await collection.updateMany(
      {
        siteCode: siteCode.trim().toUpperCase(),
        deviceStatus: deviceStatus.trim(),
        userId
      },
      {
        $set: {
          noOfDaysOffline: parseInt(String(noOfDaysOffline)) || null,
          lastSyncedAt: new Date()
          // Note: We don't set updatedAt here, so it won't change
        }
      }
    );
    
    const updatedSites = {
      modifiedCount: updateResult.modifiedCount,
      matchedCount: updateResult.matchedCount
    };

    res.status(200).json({
      success: true,
      message: `Updated No of Days Offline for ${updatedSites.modifiedCount} record(s)`,
      modifiedCount: updatedSites.modifiedCount
    });
  } catch (error) {
    console.error('Error updating days offline:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update days offline'
    });
  }
};

// @desc    Bulk update No of Days Offline for matching Site Code and Device Status
// @route   PUT /api/equipment-offline-sites/bulk-update-days-offline
// @access  Private
export const bulkUpdateDaysOfflineOnly = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { siteCode, deviceStatus, noOfDaysOffline }
    const userId = req.user.userId;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required and must not be empty'
      });
    }

    const results = [];
    let totalModified = 0;

    for (const update of updates) {
      try {
        const { siteCode, deviceStatus, noOfDaysOffline } = update;

        if (!siteCode || !deviceStatus || noOfDaysOffline === undefined) {
          results.push({ siteCode: siteCode || 'unknown', success: false, error: 'Missing required fields' });
          continue;
        }

        // Update all records matching Site Code and Device Status for this user
        // IMPORTANT: We use native MongoDB update to prevent Mongoose from auto-updating updatedAt
        // This ensures only the specific record being updated gets its updatedAt changed
        const db = EquipmentOfflineSites.db;
        const collection = db.collection('Equipment offline sites');
        
        const updateResult = await collection.updateMany(
          {
            siteCode: siteCode.trim().toUpperCase(),
            deviceStatus: deviceStatus.trim(),
            userId
          },
          {
            $set: {
              noOfDaysOffline: parseInt(String(noOfDaysOffline)) || null,
              lastSyncedAt: new Date()
              // Note: We don't set updatedAt here, so it won't change
            }
          }
        );

        totalModified += updateResult.modifiedCount;
        results.push({
          siteCode: siteCode.trim().toUpperCase(),
          deviceStatus: deviceStatus.trim(),
          modifiedCount: updateResult.modifiedCount,
          success: true
        });
      } catch (error) {
        results.push({ siteCode: update.siteCode || 'unknown', success: false, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      totalModified,
      results
    });
  } catch (error) {
    console.error('Error bulk updating days offline:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to bulk update days offline'
    });
  }
};

// @desc    Delete equipment offline site
// @route   DELETE /api/equipment-offline-sites/:fileId/:rowKey
// @access  Private
export const deleteEquipmentOfflineSite = async (req, res) => {
  try {
    const { fileId, rowKey } = req.params;
    const userId = req.user.userId;

    const offlineSite = await EquipmentOfflineSites.findOneAndDelete({
      fileId,
      rowKey,
      userId
    });

    if (!offlineSite) {
      return res.status(404).json({
        success: false,
        error: 'Equipment offline site not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Equipment offline site deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting equipment offline site:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete equipment offline site'
    });
  }
};

// @desc    Get reports data with filters
// @route   GET /api/equipment-offline-sites/reports
// @access  Private
export const getReports = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reportType, circles, divisions, subDivisions, fromDate, toDate } = req.query;

    console.log('Reports API - User ID:', userId);
    console.log('Reports API - Query params:', { reportType, circles, divisions, subDivisions, fromDate, toDate });
    console.log('Reports API - Database:', EquipmentOfflineSites.db?.databaseName || 'unknown');

    // Build query
    const query = { userId };

    // Filter by report type using taskStatus (case-insensitive)
    // Resolved = taskStatus is empty string ("") or "Resolved" (string, any case: resolved, RESOLVED, Resolved, etc.)
    // Pending = taskStatus has any non-empty value except "Resolved" (case-insensitive) (e.g., "Pending", "Pending at O&M Team", etc.)
    if (reportType === 'Resolved') {
      query.$or = [
        { taskStatus: '' },
        { taskStatus: { $regex: /^resolved$/i } }, // Case-insensitive match for "Resolved"
        { taskStatus: null },
        { taskStatus: { $exists: false } }
      ];
    } else if (reportType === 'Pending') {
      // Explicitly exclude empty string, null, and "Resolved" (case-insensitive)
      query.$and = [
        { taskStatus: { $exists: true } },
        { taskStatus: { $ne: '' } },
        { taskStatus: { $ne: null } },
        { taskStatus: { $not: { $regex: /^resolved$/i } } } // Exclude "Resolved" in any case
      ]; // Any non-empty value except "Resolved" (any case) = Pending (e.g., "Pending", "Pending at O&M Team", etc.)
    }
    
    console.log('Reports API - Filter by taskStatus:', { reportType, queryCondition: query.$or || query.$and });

    // Filter by circles (multiple selection)
    if (circles) {
      const circleArray = Array.isArray(circles) ? circles : [circles];
      const filteredCircles = circleArray.filter(c => c && String(c).trim() !== '');
      if (filteredCircles.length > 0) {
        query.circle = { $in: filteredCircles };
      }
    }

    // Filter by divisions (multiple selection)
    if (divisions) {
      const divisionArray = Array.isArray(divisions) ? divisions : [divisions];
      const filteredDivisions = divisionArray.filter(d => d && String(d).trim() !== '');
      if (filteredDivisions.length > 0) {
        query.division = { $in: filteredDivisions };
      }
    }

    // Filter by subDivisions (multiple selection)
    if (subDivisions) {
      const subDivisionArray = Array.isArray(subDivisions) ? subDivisions : [subDivisions];
      const filteredSubDivisions = subDivisionArray.filter(s => s && String(s).trim() !== '');
      if (filteredSubDivisions.length > 0) {
        query.subDivision = { $in: filteredSubDivisions };
      }
    }

    // Filter by date range (createdAt)
    if (fromDate && toDate) {
      try {
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        
        // Validate dates
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          query.createdAt = {
            $gte: startDate,
            $lte: endDate
          };
          console.log('Reports API - Date range filter:', {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          });
        }
      } catch (dateError) {
        console.error('Reports API - Invalid date range:', dateError);
      }
    }

    console.log('Reports API - Final query:', JSON.stringify(query, null, 2));

    // Fetch data with user population for Resolved By
    // Ensure we get fresh data from database (no caching)
    let reports;
    try {
      reports = await EquipmentOfflineSites.find(query)
        .populate('user', 'fullName userId')
        .sort({ createdAt: -1 })
        .lean();
      
      console.log('Reports API - Found', reports.length, 'reports');
      
      // Handle multiple records for the same site code
      if (reportType === 'Resolved') {
        // For Resolved reports: Get only the most recent Resolved record for each site code
        // Group by siteCode and keep only the latest one (already sorted by createdAt desc)
        const siteCodeMap = new Map();
        reports.forEach(report => {
          const siteCode = report.siteCode?.trim().toUpperCase();
          if (siteCode && !siteCodeMap.has(siteCode)) {
            siteCodeMap.set(siteCode, report);
          }
        });
        reports = Array.from(siteCodeMap.values());
        console.log('Reports API - After deduplication (Resolved):', reports.length, 'unique site codes');
      } else if (reportType === 'Pending') {
        // For Pending reports: Exclude site codes that have a Resolved record
        // First, find all site codes that have Resolved records
        const resolvedSiteCodes = await EquipmentOfflineSites.distinct('siteCode', {
          userId,
          $or: [
            { taskStatus: '' },
            { taskStatus: { $regex: /^resolved$/i } },
            { taskStatus: null },
            { taskStatus: { $exists: false } }
          ]
        });
        
        const resolvedSiteCodesSet = new Set(
          resolvedSiteCodes.map(code => code?.trim().toUpperCase()).filter(Boolean)
        );
        
        // Filter out site codes that have Resolved records
        reports = reports.filter(report => {
          const siteCode = report.siteCode?.trim().toUpperCase();
          return !resolvedSiteCodesSet.has(siteCode);
        });
        
        console.log('Reports API - After excluding Resolved site codes (Pending):', reports.length, 'remaining reports');
      }
    } catch (dbError) {
      console.error('Reports API - Database query error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database query failed: ' + (dbError.message || 'Unknown error')
      });
    }

    // Build CCR status map for Resolved report type
    let ccrStatusMap = {};
    if (reportType === 'Resolved' && reports.length > 0) {
      try {
        // Get all unique siteCodes from reports
        const siteCodes = reports
          .map(r => (r.siteCode || '').trim().toUpperCase())
          .filter(Boolean);

        if (siteCodes.length > 0) {
          // PRIMARY SOURCE: Check Approval collection for CCR Resolution Approval status
          // This is the source of truth for CCR approval status
          const ccrApprovals = await Approval.find({
            approvalType: 'CCR Resolution Approval',
            siteCode: { $in: siteCodes },
            status: { $in: ['Pending', 'Approved', 'Rejected'] }
          })
          .sort({ createdAt: -1 }) // Get most recent approval for each site
          .lean();

          // Group by siteCode and get the most recent approval status
          const approvalMap = new Map();
          ccrApprovals.forEach(approval => {
            const sc = (approval.siteCode || '').trim().toUpperCase();
            if (!sc || approvalMap.has(sc)) return; // Skip if already processed (most recent first)
            
            const approvalStatus = String(approval.status || '').trim();
            if (approvalStatus === 'Approved') {
              approvalMap.set(sc, 'Approved');
            } else if (approvalStatus === 'Rejected') {
              // Rejected approvals might be kept for monitoring
              const remarks = String(approval.approvalRemarks || approval.submissionRemarks || '').toLowerCase();
              if (remarks.includes('kept for monitoring') || remarks.includes('monitoring')) {
                approvalMap.set(sc, 'Kept for Monitoring');
              } else {
                approvalMap.set(sc, 'Pending'); // Rejected without monitoring = still Pending
              }
            } else {
              approvalMap.set(sc, 'Pending');
            }
          });

          // Update ccrStatusMap with approval statuses (Approval collection is source of truth)
          approvalMap.forEach((status, siteCode) => {
            ccrStatusMap[siteCode] = status;
          });

          // FALLBACK: For sites without approval records, check EquipmentOfflineSites.ccrStatus
          reports.forEach(report => {
            const sc = (report.siteCode || '').trim().toUpperCase();
            if (sc && !ccrStatusMap[sc] && report.ccrStatus) {
              const ccrStatus = String(report.ccrStatus).trim();
              if (ccrStatus && ['Pending', 'Approved', 'Kept for Monitoring'].includes(ccrStatus)) {
                ccrStatusMap[sc] = ccrStatus;
              }
            }
          });
        }

        // Set default "Pending" for any sites without status
        reports.forEach(report => {
          const sc = (report.siteCode || '').trim().toUpperCase();
          if (sc && !ccrStatusMap[sc]) {
            ccrStatusMap[sc] = 'Pending';
          }
        });

        console.log('Reports API - CCR Status Map:', ccrStatusMap);
      } catch (ccrErr) {
        console.error('Reports API - Error computing CCR status map:', ccrErr);
      }
    }

    // Format the response
    const formattedReports = reports.map((report, index) => {
      // Handle createdAt date - support both Date objects and MongoDB extended JSON format
      let createdAtDate = null;
      if (report.createdAt) {
        // If it's already a Date object
        if (report.createdAt instanceof Date) {
          createdAtDate = report.createdAt;
        }
        // If it's MongoDB extended JSON format with $date
        else if (report.createdAt.$date) {
          createdAtDate = new Date(report.createdAt.$date);
        }
        // If it's a string
        else if (typeof report.createdAt === 'string') {
          createdAtDate = new Date(report.createdAt);
        }
        // If it's a number (timestamp)
        else if (typeof report.createdAt === 'number') {
          createdAtDate = new Date(report.createdAt);
        }
      }

      // Format the date for display
      const formattedDate = createdAtDate && !isNaN(createdAtDate.getTime())
        ? createdAtDate.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })
        : '';

      const normalizedSiteCode = (report.siteCode || '').trim().toUpperCase();
      const ccrStatus =
        reportType === 'Resolved'
          ? (ccrStatusMap[normalizedSiteCode] || 'Pending')
          : '';

      return {
        slNo: index + 1,
        siteCode: report.siteCode || '',
        taskStatus: report.taskStatus || '',
        typeOfIssue: report.typeOfIssue || '',
        remarks: report.remarks || '',
        updatedTimeAndDate: formattedDate,
        resolvedBy: report.user?.fullName || report.userId || 'N/A',
        ccrStatus
      };
    });

    res.status(200).json({
      success: true,
      data: formattedReports,
      count: formattedReports.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    console.error('Error stack:', error.stack);
    
    // Ensure we always return JSON
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch reports',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// @desc    Get detailed report information by site code
// @route   GET /api/equipment-offline-sites/reports/details
// @access  Private
export const getReportDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { siteCode, reportType } = req.query;

    if (!siteCode) {
      return res.status(400).json({
        success: false,
        error: 'Site Code is required'
      });
    }

    // Build query
    const query = { 
      userId,
      siteCode: siteCode.trim().toUpperCase()
    };

    // Filter by report type if provided using taskStatus (case-insensitive)
    // Resolved = taskStatus is empty string ("") or "Resolved" (string, any case: resolved, RESOLVED, Resolved, etc.)
    // Pending = taskStatus has any non-empty value except "Resolved" (case-insensitive) (e.g., "Pending", "Pending at O&M Team", etc.)
    if (reportType === 'Resolved') {
      query.$or = [
        { taskStatus: '' },
        { taskStatus: { $regex: /^resolved$/i } }, // Case-insensitive match for "Resolved"
        { taskStatus: null },
        { taskStatus: { $exists: false } }
      ];
    } else if (reportType === 'Pending') {
      // Explicitly exclude empty string, null, and "Resolved" (case-insensitive)
      query.$and = [
        { taskStatus: { $exists: true } },
        { taskStatus: { $ne: '' } },
        { taskStatus: { $ne: null } },
        { taskStatus: { $not: { $regex: /^resolved$/i } } } // Exclude "Resolved" in any case
      ]; // Any non-empty value except "Resolved" (any case) = Pending (e.g., "Pending", "Pending at O&M Team", etc.)
    }

    // Fetch the record - for Resolved, get the most recent one (since we create new documents)
    // Sort by createdAt descending to get the latest record first
    const record = await EquipmentOfflineSites.findOne(query)
      .populate('user', 'fullName userId')
      .sort({ createdAt: -1 })
      .lean();

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Extract data from originalRowData
    const originalData = record.originalRowData || {};
    
    // Helper function to get value from originalRowData with multiple key variations
    const getValue = (keys) => {
      for (const key of keys) {
        if (originalData[key]) {
          return String(originalData[key]).trim();
        }
      }
      return '';
    };

    // Format updatedAt
    let updatedAtFormatted = '';
    if (record.updatedAt) {
      const updatedAtDate = record.updatedAt instanceof Date 
        ? record.updatedAt 
        : (record.updatedAt.$date ? new Date(record.updatedAt.$date) : new Date(record.updatedAt));
      
      if (!isNaN(updatedAtDate.getTime())) {
        updatedAtFormatted = updatedAtDate.toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
    }

    // Format response
    const details = {
      circle: record.circle || getValue(['CIRCLE', 'Circle', 'circle']) || '',
      division: record.division || getValue(['DIVISION', 'Division', 'division']) || '',
      subDivision: record.subDivision || getValue(['SUB DIVISION', 'Sub Division', 'subDivision', 'sub_division']) || '',
      siteCode: record.siteCode || '',
      deviceType: getValue(['DEVICE TYPE', 'Device Type', 'device type', 'DEVICETYPE', 'DeviceType', 'device_type']) || '',
      equipmentMake: getValue(['EQUIPMENT MAKE', 'Equipment Make', 'equipment make', 'EQUIPMENTMAKE', 'EquipmentMake', 'equipment_make']) || '',
      rtuMake: getValue(['RTU MAKE', 'RTU Make', 'rtu make', 'RTUMAKE', 'RtuMake', 'rtu_make']) || '',
      hrn: getValue(['HRN', 'hrn', 'Hrn']) || '',
      attribute: getValue(['ATTRIBUTE', 'Attribute', 'attribute']) || '',
      deviceStatus: record.deviceStatus || getValue(['DEVICE STATUS', 'Device Status', 'device status', 'DEVICESTATUS', 'DeviceStatus', 'device_status']) || '',
      noOfDaysOffline: record.noOfDaysOffline !== undefined && record.noOfDaysOffline !== null ? record.noOfDaysOffline : null,
      taskStatus: record.taskStatus || '',
      typeOfIssue: record.typeOfIssue || '',
      updatedAt: updatedAtFormatted,
      viewPhotos: record.viewPhotos || []
    };

    res.status(200).json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Error fetching report details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch report details'
    });
  }
};

// @desc    Get unique filter options (Circle, Division, Sub Division)
// @route   GET /api/equipment-offline-sites/reports/filters
// @access  Private
export const getReportFilters = async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log('Report Filters API - User ID:', userId);
    console.log('Report Filters API - Database:', EquipmentOfflineSites.db?.databaseName || 'unknown');

    // Get unique values for each filter
    const [circles, divisions, subDivisions] = await Promise.all([
      EquipmentOfflineSites.distinct('circle', { userId, circle: { $exists: true, $ne: '' } }),
      EquipmentOfflineSites.distinct('division', { userId, division: { $exists: true, $ne: '' } }),
      EquipmentOfflineSites.distinct('subDivision', { userId, subDivision: { $exists: true, $ne: '' } })
    ]);

    console.log('Report Filters API - Found:', {
      circles: circles.length,
      divisions: divisions.length,
      subDivisions: subDivisions.length
    });

    res.status(200).json({
      success: true,
      data: {
        circles: circles.filter(c => c).sort(),
        divisions: divisions.filter(d => d).sort(),
        subDivisions: subDivisions.filter(s => s).sort()
      }
    });
  } catch (error) {
    console.error('Error fetching report filters:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch report filters'
    });
  }
};

// @desc    Get LOCAL-REMOTE report data aggregated from ONLINE-OFFLINE.xlsx
// @route   GET /api/equipment-offline-sites/reports/local-remote
// @access  Private
export const getLocalRemoteReports = async (req, res) => {
  try {
    const { circles, divisions, date } = req.query;

    console.log('LOCAL-REMOTE Reports API - Query params:', { circles, divisions, date });

    // Find ONLINE-OFFLINE.xlsx file from uploads collection
    const onlineOfflineFiles = await Upload.find({
      $or: [
        { uploadType: 'online-offline-data' },
        { name: { $regex: /online.*offline/i } }
      ]
    })
    .sort({ uploadedAt: -1, createdAt: -1 })
    .lean();

    if (!onlineOfflineFiles || onlineOfflineFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ONLINE-OFFLINE.xlsx file not found in uploads'
      });
    }

    // Get the latest ONLINE-OFFLINE file
    const latestFile = onlineOfflineFiles[0];
    console.log('LOCAL-REMOTE Reports - Using file:', latestFile.name, 'FileId:', latestFile.fileId);

    // Fetch the full file data
    const fullFile = await Upload.findOne({ fileId: latestFile.fileId }).lean();
    if (!fullFile || !fullFile.rows || fullFile.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'ONLINE-OFFLINE.xlsx file has no data'
      });
    }

    const rows = fullFile.rows;
    const headers = fullFile.headers || (rows[0] ? Object.keys(rows[0]) : []);

    console.log('LOCAL-REMOTE Reports - Total rows:', rows.length);
    console.log('LOCAL-REMOTE Reports - Headers:', headers);

    // Find column headers
    const normalizeHeader = (h) => String(h || '').trim().toLowerCase();
    
    // Find DIVISION column
    const divisionHeader = headers.find(h => {
      const normalized = normalizeHeader(h);
      return normalized === 'division' || normalized === 'division name';
    });

    // Find CIRCLE column for filtering
    const circleHeader = headers.find(h => {
      const normalized = normalizeHeader(h);
      return normalized === 'circle';
    });

    // Find DEVICE STATUS column (from latest date group)
    // Find all date columns first
    const parseDateFromColumnName = (columnName) => {
      const datePatterns = [
        /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
        /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      ];
      
      for (const pattern of datePatterns) {
        const match = String(columnName).match(pattern);
        if (match) {
          if (pattern.source.includes('\\d{4}') && pattern.source.startsWith('(\\d{4})')) {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else {
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          }
        }
      }
      return null;
    };

    const dateColumns = [];
    headers.forEach((h, index) => {
      const normalized = normalizeHeader(h);
      if (normalized.includes('date')) {
        const parsedDate = parseDateFromColumnName(h);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          dateColumns.push({ name: h, date: parsedDate, index });
        }
      }
    });

    // If date is provided, find the matching date column; otherwise use latest
    let targetDateColumn = null;
    let deviceStatusHeader = null;
    let equipmentLRSwitchStatusHeader = null;

    if (date) {
      // Parse the provided date (format: YYYY-MM-DD)
      const [year, month, day] = date.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      
      // Find the date column that matches the selected date
      targetDateColumn = dateColumns.find(dc => {
        const dcDate = dc.date;
        return dcDate.getFullYear() === targetDate.getFullYear() &&
               dcDate.getMonth() === targetDate.getMonth() &&
               dcDate.getDate() === targetDate.getDate();
      });
      
      if (!targetDateColumn) {
        return res.status(400).json({
          success: false,
          error: `No data found for the selected date: ${date}`
        });
      }
    } else {
      // If no date provided, use latest date column
      if (dateColumns.length > 0) {
        dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
        targetDateColumn = dateColumns[0];
      }
    }

    if (targetDateColumn) {
      const targetDateIndex = targetDateColumn.index;

      // Find columns after target date column (before next date column)
      for (let i = targetDateIndex + 1; i < headers.length; i++) {
        const nextCol = headers[i];
        const normalized = normalizeHeader(nextCol);
        
        // Stop if we hit another date column
        if (dateColumns.some(dc => dc.name === nextCol && dc.index !== targetDateIndex)) break;
        
        // Find DEVICE STATUS
        if (!deviceStatusHeader && normalized.includes('device') && normalized.includes('status') && !normalized.includes('rtu')) {
          deviceStatusHeader = nextCol;
        }
        
        // Find EQUIPMENT L/R SWITCH STATUS
        if (!equipmentLRSwitchStatusHeader && ((normalized.includes('equipment') && normalized.includes('switch')) || 
            (normalized.includes('l/r') && normalized.includes('switch')))) {
          equipmentLRSwitchStatusHeader = nextCol;
        }
        
        // Stop after finding both or hitting RTU column
        if (deviceStatusHeader && equipmentLRSwitchStatusHeader) break;
        if (normalized.includes('rtu') && normalized.includes('switch')) break;
      }
    } else {
      // Fallback: find first occurrence if no date columns found
      deviceStatusHeader = headers.find(h => {
        const normalized = normalizeHeader(h);
        return normalized.includes('device') && normalized.includes('status') && !normalized.includes('rtu');
      });
      
      equipmentLRSwitchStatusHeader = headers.find(h => {
        const normalized = normalizeHeader(h);
        return (normalized.includes('equipment') && normalized.includes('switch')) ||
               (normalized.includes('l/r') && normalized.includes('switch'));
      });
    }

    console.log('LOCAL-REMOTE Reports - Division header:', divisionHeader);
    console.log('LOCAL-REMOTE Reports - Device Status header:', deviceStatusHeader);
    console.log('LOCAL-REMOTE Reports - Equipment L/R Switch Status header:', equipmentLRSwitchStatusHeader);
    if (targetDateColumn) {
      console.log('LOCAL-REMOTE Reports - Using date column:', targetDateColumn.name, 'Date:', targetDateColumn.date.toISOString().split('T')[0]);
    } else {
      console.log('LOCAL-REMOTE Reports - No specific date column found, using first occurrence of status columns');
    }

    if (!divisionHeader || !deviceStatusHeader || !equipmentLRSwitchStatusHeader) {
      return res.status(400).json({
        success: false,
        error: 'Required columns not found in ONLINE-OFFLINE.xlsx file'
      });
    }

    // Filter by circles and divisions if provided
    const circleArray = circles ? (Array.isArray(circles) ? circles : [circles]) : [];
    const divisionArray = divisions ? (Array.isArray(divisions) ? divisions : [divisions]) : [];

    // Aggregate data by DIVISION
    const divisionStats = new Map();

    rows.forEach(row => {
      const division = String(row[divisionHeader] || '').trim();
      const circle = circleHeader ? String(row[circleHeader] || '').trim() : 
                     String(row['CIRCLE'] || row['Circle'] || row['circle'] || '').trim();
      
      // Filter by circle if provided
      if (circleArray.length > 0 && !circleArray.includes(circle)) {
        return;
      }
      
      // Filter by division if provided
      if (divisionArray.length > 0 && !divisionArray.includes(division)) {
        return;
      }

      if (!division) return;

      // Initialize division stats if not exists
      if (!divisionStats.has(division)) {
        divisionStats.set(division, {
          division,
          online: 0,
          offline: 0,
          local: 0,
          remote: 0
        });
      }

      const stats = divisionStats.get(division);

      // Count DEVICE STATUS
      const deviceStatus = String(row[deviceStatusHeader] || '').trim().toUpperCase();
      if (deviceStatus === 'ONLINE') {
        stats.online++;
      } else if (deviceStatus === 'OFFLINE') {
        stats.offline++;
      }

      // Count EQUIPMENT L/R SWITCH STATUS
      const equipmentStatus = String(row[equipmentLRSwitchStatusHeader] || '').trim().toUpperCase();
      if (equipmentStatus === 'LOCAL') {
        stats.local++;
      } else if (equipmentStatus === 'REMOTE') {
        stats.remote++;
      }
    });

    // Convert to array and sort by division name
    const reportData = Array.from(divisionStats.values()).sort((a, b) => 
      a.division.localeCompare(b.division)
    );

    // Get the latest date from date columns (for default date picker)
    let latestDate = null;
    if (dateColumns.length > 0) {
      dateColumns.sort((a, b) => b.date.getTime() - a.date.getTime());
      const latestDateObj = dateColumns[0].date;
      // Format as YYYY-MM-DD for date input
      const year = latestDateObj.getFullYear();
      const month = String(latestDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(latestDateObj.getDate()).padStart(2, '0');
      latestDate = `${year}-${month}-${day}`;
    }

    // Calculate trend data - aggregate totals for each date
    const trendDataMap = new Map();
    
    // Process all date columns to build trend data
    dateColumns.sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort chronologically
    
    dateColumns.forEach(dateCol => {
      const dateIndex = dateCol.index;
      const dateObj = dateCol.date;
      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      // Find status columns for this date group
      let deviceStatusHeaderForDate = null;
      let equipmentLRSwitchStatusHeaderForDate = null;
      
      // Find columns after this date column
      for (let i = dateIndex + 1; i < headers.length; i++) {
        const nextCol = headers[i];
        const normalized = normalizeHeader(nextCol);
        
        // Stop if we hit another date column
        if (dateColumns.some(dc => dc.name === nextCol && dc.index !== dateIndex)) break;
        
        // Find DEVICE STATUS
        if (!deviceStatusHeaderForDate && normalized.includes('device') && normalized.includes('status') && !normalized.includes('rtu')) {
          deviceStatusHeaderForDate = nextCol;
        }
        
        // Find EQUIPMENT L/R SWITCH STATUS
        if (!equipmentLRSwitchStatusHeaderForDate && ((normalized.includes('equipment') && normalized.includes('switch')) || 
            (normalized.includes('l/r') && normalized.includes('switch')))) {
          equipmentLRSwitchStatusHeaderForDate = nextCol;
        }
        
        // Stop after finding both
        if (deviceStatusHeaderForDate && equipmentLRSwitchStatusHeaderForDate) break;
        if (normalized.includes('rtu') && normalized.includes('switch')) break;
      }
      
      if (deviceStatusHeaderForDate && equipmentLRSwitchStatusHeaderForDate) {
        // Aggregate totals for this date (with filters applied)
        let online = 0, offline = 0, local = 0, remote = 0;
        
        rows.forEach(row => {
          const division = String(row[divisionHeader] || '').trim();
          const circle = circleHeader ? String(row[circleHeader] || '').trim() : 
                         String(row['CIRCLE'] || row['Circle'] || row['circle'] || '').trim();
          
          // Apply same filters as main report
          if (circleArray.length > 0 && !circleArray.includes(circle)) {
            return;
          }
          if (divisionArray.length > 0 && !divisionArray.includes(division)) {
            return;
          }
          
          const deviceStatus = String(row[deviceStatusHeaderForDate] || '').trim().toUpperCase();
          if (deviceStatus === 'ONLINE') online++;
          else if (deviceStatus === 'OFFLINE') offline++;
          
          const equipmentStatus = String(row[equipmentLRSwitchStatusHeaderForDate] || '').trim().toUpperCase();
          if (equipmentStatus === 'LOCAL') local++;
          else if (equipmentStatus === 'REMOTE') remote++;
        });
        
        // Format date for display (DD-MM-YYYY)
        const displayDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
        
        trendDataMap.set(dateStr, {
          date: displayDate,
          dateSort: dateStr,
          online,
          offline,
          local,
          remote
        });
      }
    });
    
    // Convert to array and sort by date
    const trendDataArray = Array.from(trendDataMap.values())
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));

    console.log('LOCAL-REMOTE Reports - Aggregated data:', reportData.length, 'divisions');
    console.log('LOCAL-REMOTE Reports - Latest date:', latestDate);
    console.log('LOCAL-REMOTE Reports - Trend data points:', trendDataArray.length);

    res.status(200).json({
      success: true,
      data: reportData,
      count: reportData.length,
      latestDate: latestDate,
      trendData: trendDataArray
    });
  } catch (error) {
    console.error('Error fetching LOCAL-REMOTE reports:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch LOCAL-REMOTE reports',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

