import Action from '../models/Action.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Approval from '../models/Approval.js';
import EquipmentOfflineSites from '../models/EquipmentOfflineSites.js';
import EmailConfig from '../models/EmailConfig.js';
import Upload from '../models/Upload.js';
import AdminUploadField from '../models/AdminUploadField.js';
import mongoose from 'mongoose';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Team to Role mapping
const TEAM_TO_ROLE = {
  'Equipment Team': 'Equipment',
  'RTU/Communication Team': 'RTU/Communication',
  'AMC Team': 'AMC',
  'O&M Team': 'O&M',
  'Relay Team': 'Relay',
  'CCR Team': 'CCR',
  "System Team": 'System',
  "C&D's Team": 'C&D'
};

// Normalize division name for case-insensitive matching
function normalizeDivision(division) {
  if (!division) return '';
  return division.trim().toLowerCase();
}

// Normalize circle name for case-insensitive matching
function normalizeCircle(circle) {
  if (!circle) return '';
  return circle.trim().toUpperCase();
}

// Cache for Jyothi Electricals Site Codes (loaded from file)
let jyothiSiteCodesCache = null;
let jyothiSiteCodesCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Function to clear cache (useful for debugging)
export function clearJyothiSiteCodesCache() {
  jyothiSiteCodesCache = null;
  jyothiSiteCodesCacheTime = null;
  console.log('Jyothi Site Codes cache cleared');
}

// Load Site Codes from Jyothi electricals.xlsx file
async function loadJyothiSiteCodes() {
  try {
    // Check cache first
    if (jyothiSiteCodesCache && jyothiSiteCodesCacheTime && 
        (Date.now() - jyothiSiteCodesCacheTime) < CACHE_DURATION) {
      return jyothiSiteCodesCache;
    }

    // Try to find file in Upload model first (regular uploads)
    let jyothiFile = await Upload.findOne({
      name: { $regex: /jyothi.*electricals/i }
    }).lean();

    console.log('Searching for Jyothi file:', {
      inUploadModel: !!jyothiFile,
      uploadFileName: jyothiFile?.name || 'N/A'
    });

    let headers = null;
    let rows = null;

    if (jyothiFile && jyothiFile.rows && Array.isArray(jyothiFile.rows) && jyothiFile.rows.length > 0) {
      // File found in Upload model with parsed data
      headers = jyothiFile.headers || [];
      rows = jyothiFile.rows;
      console.log('Found Jyothi electricals.xlsx in Upload model');
    } else {
      // Try to find in AdminUploadField (Admin Uploads)
      console.log('File not found in Upload model, searching AdminUploadField...');
      const adminUploadField = await AdminUploadField.findOne({
        $or: [
          { fieldName: { $regex: /jyothi.*electricals/i } },
          { 'uploadedFile.fileName': { $regex: /jyothi.*electricals/i } }
        ]
      }).lean();

      console.log('AdminUploadField search result:', {
        found: !!adminUploadField,
        fieldName: adminUploadField?.fieldName || 'N/A',
        fileName: adminUploadField?.uploadedFile?.fileName || 'N/A'
      });

      if (adminUploadField && adminUploadField.uploadedFile && adminUploadField.uploadedFile.fileUrl) {
        // Parse the XLSX file from Admin Uploads
        try {
          const fileUrl = adminUploadField.uploadedFile.fileUrl;
          console.log('AdminUploadField found:', {
            fieldName: adminUploadField.fieldName,
            fileName: adminUploadField.uploadedFile.fileName,
            fileUrl: fileUrl
          });
          
          // Handle both relative and absolute paths
          let filePath;
          if (path.isAbsolute(fileUrl)) {
            filePath = fileUrl;
          } else {
            // fileUrl is relative from server root (e.g., "uploads/admin/file.xlsx")
            filePath = path.join(__dirname, '..', fileUrl);
          }
          
          console.log('Constructed file path:', filePath);
          console.log('File exists check:', fs.existsSync(filePath));
          
          if (fs.existsSync(filePath)) {
            console.log('Found Jyothi electricals.xlsx in Admin Uploads, parsing file...');
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            
            if (data.length > 0) {
              headers = data[0].map(h => h ? String(h).trim() : '');
              rows = data.slice(1).map(row => {
                const rowObj = {};
                headers.forEach((header, index) => {
                  if (header && row[index] !== undefined && row[index] !== null) {
                    rowObj[header] = String(row[index]).trim();
                  }
                });
                return rowObj;
              }).filter(row => Object.keys(row).length > 0);
              console.log('Parsed Jyothi electricals.xlsx from Admin Uploads:', rows.length, 'rows');
              console.log('Headers found:', headers);
            } else {
              console.log('File has no data rows');
            }
          } else {
            console.log('Jyothi electricals.xlsx file path not found on server:', filePath);
            console.log('Attempted to read from:', filePath);
            console.log('Current working directory:', process.cwd());
            console.log('__dirname:', __dirname);
          }
        } catch (parseError) {
          console.error('Error parsing Jyothi electricals.xlsx from Admin Uploads:', parseError);
          console.error('Parse error stack:', parseError.stack);
        }
      } else {
        console.log('AdminUploadField found but no fileUrl:', {
          hasUploadedFile: !!adminUploadField?.uploadedFile,
          hasFileUrl: !!adminUploadField?.uploadedFile?.fileUrl
        });
      }
    }

    if (!headers || !rows || rows.length === 0) {
      console.log('Jyothi electricals.xlsx file not found or has no rows');
      jyothiSiteCodesCache = new Set();
      jyothiSiteCodesCacheTime = Date.now();
      return jyothiSiteCodesCache;
    }

    // Find Site Code column header (case-insensitive)
    let siteCodeKey = null;
    
    const siteCodeKeys = ['Site Code', 'SITE CODE', 'SiteCode', 'Site_Code', 'site code', 'site_code'];
    for (const key of siteCodeKeys) {
      if (headers.includes(key)) {
        siteCodeKey = key;
        break;
      }
    }

    // Also try case-insensitive search
    if (!siteCodeKey) {
      for (const header of headers) {
        const normalizedHeader = header.toLowerCase().trim();
        if (normalizedHeader.includes('site') && normalizedHeader.includes('code')) {
          siteCodeKey = header;
          break;
        }
      }
    }

    if (!siteCodeKey) {
      console.log('Site Code column not found in Jyothi electricals.xlsx file');
      jyothiSiteCodesCache = new Set();
      jyothiSiteCodesCacheTime = Date.now();
      return jyothiSiteCodesCache;
    }

    // Extract Site Codes from rows
    const siteCodes = new Set();
    const originalSiteCodes = []; // For logging only
    
    for (const row of rows) {
      if (row && row[siteCodeKey]) {
        const siteCode = String(row[siteCodeKey]).trim();
        if (siteCode) {
          // Store normalized version (uppercase) for case-insensitive matching
          const normalized = siteCode.toUpperCase();
          siteCodes.add(normalized);
          originalSiteCodes.push(siteCode);
          
          // Also add original case if different
          if (normalized !== siteCode) {
            originalSiteCodes.push(siteCode);
          }
        }
      }
    }

    console.log(`Loaded ${siteCodes.size} Site Codes from Jyothi electricals.xlsx file`);
    console.log(`Site Code column key used: "${siteCodeKey}"`);
    console.log(`Total rows processed: ${rows.length}`);
    
    if (siteCodes.size > 0 && originalSiteCodes.length > 0) {
      const sampleCodes = originalSiteCodes.slice(0, 10);
      console.log(`Sample Site Codes (original): ${sampleCodes.join(', ')}`);
      console.log(`Sample Site Codes (normalized): ${Array.from(siteCodes).slice(0, 10).join(', ')}`);
      // Log all Site Codes for debugging (if not too many)
      if (siteCodes.size <= 100) {
        console.log(`ALL Site Codes in Jyothi file (normalized, sorted):`, Array.from(siteCodes).sort());
      } else {
        console.log(`Too many Site Codes (${siteCodes.size}), showing first 50:`, Array.from(siteCodes).slice(0, 50).sort());
      }
    } else {
      console.log('WARNING: No Site Codes found in Jyothi electricals.xlsx file');
      console.log('File search criteria: name contains "jyothi" and "electricals" (case-insensitive)');
      console.log('Available headers in file:', headers);
      console.log('First row sample:', rows[0] || 'No rows');
    }
    jyothiSiteCodesCache = siteCodes;
    jyothiSiteCodesCacheTime = Date.now();
    return siteCodes;
  } catch (error) {
    console.error('Error loading Jyothi Site Codes:', error);
    jyothiSiteCodesCache = new Set();
    jyothiSiteCodesCacheTime = Date.now();
    return jyothiSiteCodesCache;
  }
}

// Find AMC user by Site Code (for Jyothi Electricals vendor)
async function findAMCUserBySiteCode(siteCode) {
  try {
    if (!siteCode) {
      console.log('findAMCUserBySiteCode: No Site Code provided');
      return null;
    }

    const siteCodeNormalized = String(siteCode).trim().toUpperCase(); // Normalize to uppercase for case-insensitive matching
    // Also remove any extra whitespace
    const siteCodeCleaned = siteCodeNormalized.replace(/\s+/g, ' ').trim();
    console.log(`findAMCUserBySiteCode: Checking Site Code "${siteCodeCleaned}" (original: "${siteCode}")`);

    // Load Site Codes from Jyothi electricals.xlsx
    const jyothiSiteCodes = await loadJyothiSiteCodes();
    
    // Log some sample Site Codes for debugging
    if (jyothiSiteCodes.size > 0) {
      const sampleCodes = Array.from(jyothiSiteCodes).slice(0, 10);
      console.log(`Jyothi Site Codes loaded (sample): ${sampleCodes.join(', ')}`);
      console.log(`Total Jyothi Site Codes: ${jyothiSiteCodes.size}`);
    } else {
      console.log('WARNING: No Site Codes loaded from Jyothi electricals.xlsx file');
    }
    
    // Check if Site Code is in Jyothi Electricals list (case-insensitive comparison)
    const isInList = jyothiSiteCodes.has(siteCodeCleaned);
    console.log(`Site Code "${siteCodeCleaned}" ${isInList ? 'FOUND' : 'NOT FOUND'} in Jyothi Electricals list`);
    
    // Enhanced debugging: Show all Site Codes if not found
    if (!isInList) {
      console.log(`=== DEBUG: Site Code "${siteCodeCleaned}" NOT FOUND ===`);
      console.log(`Original Site Code: "${siteCode}"`);
      console.log(`Normalized Site Code: "${siteCodeCleaned}"`);
      console.log(`Total Site Codes in Jyothi file: ${jyothiSiteCodes.size}`);
      if (jyothiSiteCodes.size > 0) {
        const allCodes = Array.from(jyothiSiteCodes);
        console.log(`First 20 Site Codes in file:`, allCodes.slice(0, 20));
        // Check for similar codes (partial match)
        const similarCodes = allCodes.filter(code => 
          code.includes(siteCodeCleaned) || 
          siteCodeCleaned.includes(code) ||
          code.replace(/\s+/g, '') === siteCodeCleaned.replace(/\s+/g, '') ||
          siteCodeCleaned.replace(/\s+/g, '') === code.replace(/\s+/g, '')
        );
        if (similarCodes.length > 0) {
          console.log(`Similar Site Codes found:`, similarCodes);
        }
      }
      console.log(`=== End Debug ===`);
    }
    
    // Debug: Check if "3W2872" is in the list (for troubleshooting)
    if (siteCodeCleaned.includes('3W2872') || siteCodeCleaned.includes('3w2872')) {
      console.log(`DEBUG: Checking for Site Code "3W2872"`);
      console.log(`Normalized Site Code: "${siteCodeCleaned}"`);
      console.log(`Is "3W2872" in list?`, jyothiSiteCodes.has('3W2872'));
      console.log(`All Site Codes containing "3W2872":`, Array.from(jyothiSiteCodes).filter(c => c.includes('3W2872') || c.includes('3w2872')));
    }
    
    if (!isInList) {
      console.log(`Site Code "${siteCodeCleaned}" not found in Jyothi Electricals list`);
      console.log(`This Site Code will be routed using Circle-based logic instead`);
      return null;
    }

    console.log(`✓ Site Code "${siteCodeCleaned}" found in Jyothi Electricals list, routing to Jyothi Electricals vendor`);

    // Check if Site Code was already routed to Jyothi Electricals (prevent duplicate routing)
    // Check multiple possible Site Code field names in rowData - case-insensitive comparison
    const existingAction = await Action.findOne({
      $or: [
        { 'rowData.Site Code': { $regex: new RegExp(`^${siteCodeCleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'rowData.SITE CODE': { $regex: new RegExp(`^${siteCodeCleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'rowData.SiteCode': { $regex: new RegExp(`^${siteCodeCleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'rowData.Site_Code': { $regex: new RegExp(`^${siteCodeCleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { 'rowData.site code': { $regex: new RegExp(`^${siteCodeCleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ],
      assignedToRole: 'AMC',
      status: { $ne: 'Completed' } // Only check non-completed actions
    }).lean();

    if (existingAction) {
      // Check if assigned user is from Jyothi Electricals vendor
      const existingUser = await User.findOne({
        userId: existingAction.assignedToUserId,
        vendor: 'Jyothi Electricals'
      }).lean();

      if (existingUser) {
        console.log(`Site Code "${siteCodeCleaned}" already routed to Jyothi Electricals user: ${existingUser.userId}`);
        return null; // Already routed, don't route again
      } else {
        console.log(`Site Code "${siteCodeCleaned}" exists in actions but not assigned to Jyothi Electricals, proceeding with routing`);
      }
    }

    // Find AMC users with Jyothi Electricals vendor (case-insensitive search)
    const jyothiUsers = await User.find({
      role: 'AMC',
      vendor: { $regex: /^jyothi.*electricals$/i }, // Case-insensitive vendor match
      status: 'approved',
      isActive: true
    }).lean();

    console.log(`Found ${jyothiUsers.length} AMC users with Jyothi Electricals vendor`);
    
    if (jyothiUsers.length === 0) {
      // Try exact match as fallback
      const exactMatchUsers = await User.find({
        role: 'AMC',
        vendor: 'Jyothi Electricals',
        status: 'approved',
        isActive: true
      }).lean();
      
      console.log(`Found ${exactMatchUsers.length} AMC users with exact vendor match "Jyothi Electricals"`);
      
      if (exactMatchUsers.length === 0) {
        console.log('ERROR: No AMC users found with Jyothi Electricals vendor');
        // Get all unique vendors for AMC role users
        const allVendors = await User.distinct('vendor', { role: 'AMC' });
        console.log('Available vendors in database for AMC role:', allVendors);
        return null;
      }
      
      const selectedUser = exactMatchUsers[0];
      console.log(`✓ AMC user found for Jyothi Electricals (Site Code priority): ${selectedUser.userId} (${selectedUser.fullName})`);
      return selectedUser;
    }

    // Return the first available user (or implement load balancing logic here)
    const selectedUser = jyothiUsers[0];
    console.log(`✓ AMC user found for Jyothi Electricals (Site Code priority): ${selectedUser.userId} (${selectedUser.fullName})`);
    
    return selectedUser;
  } catch (error) {
    console.error('Error finding AMC user by Site Code:', error);
    return null;
  }
}

// Find AMC user by circle and vendor mapping
async function findAMCUserByCircle(circle) {
  try {
    const normalizedCircle = normalizeCircle(circle);
    
    console.log('Finding AMC user for circle:', normalizedCircle);
    
    // Vendor to Circle mapping
    let targetVendor = null;
    if (normalizedCircle === 'SOUTH' || normalizedCircle === 'WEST') {
      targetVendor = 'Shrishaila Electricals(India Pvt ltd)';
    } else if (normalizedCircle === 'NORTH' || normalizedCircle === 'EAST') {
      targetVendor = 'Spectrum Consultants';
    }
    
    console.log('Target vendor for circle:', { circle: normalizedCircle, vendor: targetVendor });
    
    if (!targetVendor) {
      console.log('No vendor mapped for circle:', normalizedCircle);
      return null;
    }
    
    // Normalize vendor name for comparison (remove case sensitivity)
    const normalizeVendor = (vendor) => {
      if (!vendor) return '';
      return vendor.trim().toLowerCase().replace(/\s+/g, ' ');
    };
    
    const normalizedTargetVendor = normalizeVendor(targetVendor);
    
    // Find all AMC users first (approved and active)
    const allAMCUsers = await User.find({ 
      role: 'AMC',
      status: 'approved',
      isActive: true
    }).lean();
    
    console.log(`Found ${allAMCUsers.length} total AMC users (approved and active)`);
    
    // Log all AMC users for debugging
    allAMCUsers.forEach(user => {
      console.log(`  - User: ${user.userId} (${user.fullName}), Vendor: "${user.vendor}", Circles: ${user.circle ? user.circle.join(', ') : 'none'}`);
    });
    
    // Filter by vendor (case-insensitive) and circle
    const usersWithMatchingVendor = allAMCUsers.filter(user => {
      const userVendorNormalized = normalizeVendor(user.vendor);
      const vendorMatch = userVendorNormalized === normalizedTargetVendor;
      
      if (!vendorMatch) {
        console.log(`  User ${user.userId} vendor "${user.vendor}" does not match target "${targetVendor}"`);
      }
      
      return vendorMatch;
    });
    
    console.log(`Found ${usersWithMatchingVendor.length} AMC users with matching vendor "${targetVendor}"`);
    
    // Find user whose circle matches
    const matchedUser = usersWithMatchingVendor.find(user => {
      if (!user.circle || !Array.isArray(user.circle) || user.circle.length === 0) {
        console.log(`  User ${user.userId} has no circles`);
        return false;
      }
      
      const circleMatch = user.circle.some(userCircle => {
        const normalizedUserCircle = normalizeCircle(userCircle);
        const matches = normalizedUserCircle === normalizedCircle;
        if (matches) {
          console.log(`  ✓ Circle match found: User ${user.userId} has circle "${userCircle}" (normalized: "${normalizedUserCircle}")`);
        } else {
          console.log(`  ✗ Circle mismatch: User ${user.userId} has circle "${userCircle}" (normalized: "${normalizedUserCircle}") but need "${normalizedCircle}"`);
        }
        return matches;
      });
      
      return circleMatch;
    });
    
    if (matchedUser) {
      console.log(`✓ AMC user found: ${matchedUser.userId} (${matchedUser.fullName}), Vendor: ${matchedUser.vendor}, Circle: ${matchedUser.circle.join(', ')}`);
    } else {
      console.log(`✗ No AMC user found matching circle "${normalizedCircle}" with vendor "${targetVendor}"`);
      console.log(`  Available users with vendor "${targetVendor}":`);
      usersWithMatchingVendor.forEach(user => {
        console.log(`    - ${user.userId} (${user.fullName}), Circles: ${user.circle ? user.circle.join(', ') : 'none'}`);
      });
    }
    
    return matchedUser || null;
  } catch (error) {
    console.error('Error finding AMC user by circle:', error);
    return null;
  }
}

// Find user by division and role (case-insensitive division matching)
async function findUserByDivisionAndRole(division, role) {
  try {
    const normalizedDivision = normalizeDivision(division);
    
    // Find users with matching role
    const users = await User.find({ 
      role: role,
      status: 'approved',
      isActive: true
    }).lean();
    
    // Find user whose division matches (case-insensitive)
    const matchedUser = users.find(user => {
      if (!user.division || !Array.isArray(user.division)) return false;
      
      return user.division.some(userDiv => 
        normalizeDivision(userDiv) === normalizedDivision
      );
    });
    
    return matchedUser;
  } catch (error) {
    console.error('Error finding user by division and role:', error);
    return null;
  }
}

// Send email notification for routing
async function sendRoutingEmail(assignedUser, siteCode, typeOfIssue, division, routing, priority, originalAssignedUser = null) {
  try {
    // Get SMTP configuration
    const emailConfig = await EmailConfig.findOne();
    
    // Check if email is enabled
    if (!emailConfig || !emailConfig.enabled) {
      console.log('Email notifications are disabled');
      return;
    }

    // Check if assigned user has email
    if (!assignedUser.email) {
      console.log(`User ${assignedUser.userId} has no email address`);
      return;
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: parseInt(emailConfig.port),
      secure: emailConfig.secure || false,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    // Prepare email content
    const isReroute = originalAssignedUser !== null;
    const subject = siteCode 
      ? (isReroute ? `Action Rerouted to You: Site ${siteCode} - ${typeOfIssue}` : `New Action Assigned: Site ${siteCode} - ${typeOfIssue}`)
      : (isReroute ? `Action Rerouted to You: ${typeOfIssue}` : `New Action Assigned: ${typeOfIssue}`);

    const priorityColor = priority === 'High' ? '#dc2626' : priority === 'Medium' ? '#f59e0b' : '#10b981';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">${isReroute ? 'Action Rerouted to You' : 'New Action Assigned'}</h2>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
            Hello <strong>${assignedUser.fullName || assignedUser.userId}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
            ${isReroute ? 'A maintenance action has been rerouted to you.' : 'A new maintenance action has been assigned to you.'}
          </p>
          
          ${isReroute && originalAssignedUser ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: bold;">🔄 Rerouted Information</p>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #92400e;">
              <strong>From User:</strong> ${originalAssignedUser.fullName || originalAssignedUser.userId} (${originalAssignedUser.role || 'Unknown'})
            </p>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #92400e;">
              <strong>Reroute Time:</strong> ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
          ` : ''}
          
          <div style="background: white; border-left: 4px solid ${priorityColor}; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <table style="width: 100%; border-collapse: collapse;">
              ${siteCode ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 140px;">Site Code:</td>
                <td style="padding: 8px 0; color: #6b7280;">${siteCode}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Type of Issue:</td>
                <td style="padding: 8px 0; color: #6b7280;">${typeOfIssue}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Division:</td>
                <td style="padding: 8px 0; color: #6b7280;">${division}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Routing Team:</td>
                <td style="padding: 8px 0; color: #6b7280;">${routing}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Priority:</td>
                <td style="padding: 8px 0; color: ${priorityColor}; font-weight: bold;">${priority || 'Medium'}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:5173/dashboard/my-action" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; text-decoration: none; padding: 15px 30px; 
                      border-radius: 5px; font-weight: bold;">
              View Actions
            </a>
          </div>
          
          <p style="font-size: 14px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This is an automated notification from BESCOM DAS System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
      to: assignedUser.email,
      subject: subject,
      html: htmlContent
    });

    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // Re-throw to be caught by caller
  }
}

// Submit routing - creates an action and assigns it to appropriate user
export async function submitRouting(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { 
      rowData, 
      headers, 
      routing, 
      typeOfIssue, 
      remarks, 
      priority,
      photo, 
      sourceFileId, 
      originalRowIndex,
      rowKey,
      taskStatus  // Add this for ownership transfer
    } = req.body;

    // Validate required fields
    if (!rowData || !routing || !typeOfIssue || !sourceFileId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: rowData, routing, typeOfIssue, sourceFileId' 
      });
    }

    // Map team to role
    const targetRole = TEAM_TO_ROLE[routing];
    if (!targetRole) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid routing: ${routing}. Supported routings: ${Object.keys(TEAM_TO_ROLE).join(', ')}` 
      });
    }

    // Extract division from rowData (case-insensitive search)
    let division = null;
    const divisionKeys = ['DIVISION', 'Division', 'division', 'DIVISION NAME', 'Division Name', 'division name'];
    
    for (const key of divisionKeys) {
      if (rowData[key]) {
        division = rowData[key];
        break;
      }
    }

    // Also check case-insensitive in all keys
    if (!division) {
      for (const key in rowData) {
        if (normalizeDivision(key).includes('division')) {
          division = rowData[key];
          break;
        }
      }
    }

    // Extract Site Code from rowData for priority routing (Jyothi Electricals)
    // MUST be checked FIRST before Circle-based routing
    let siteCode = null;
    const siteCodeKeys = ['Site Code', 'SITE CODE', 'SiteCode', 'Site_Code', 'site code', 'site_code'];
    
    for (const key of siteCodeKeys) {
      if (rowData[key]) {
        siteCode = String(rowData[key]).trim();
        console.log(`Site Code extracted from rowData: "${siteCode}" (key: "${key}")`);
        break;
      }
    }

    // Also check case-insensitive in all keys
    if (!siteCode) {
      for (const key in rowData) {
        const normalizedKey = key.toLowerCase().trim();
        if (normalizedKey.includes('site') && normalizedKey.includes('code')) {
          siteCode = String(rowData[key]).trim();
          console.log(`Site Code extracted from rowData (case-insensitive): "${siteCode}" (key: "${key}")`);
          break;
        }
      }
    }

    if (!siteCode) {
      console.log('WARNING: Site Code not found in rowData for AMC routing');
    }

    // Extract circle from rowData (case-insensitive search) - needed for AMC routing fallback
    let circle = null;
    const circleKeys = ['CIRCLE', 'Circle', 'circle'];
    
    for (const key of circleKeys) {
      if (rowData[key]) {
        circle = normalizeCircle(rowData[key]); // Normalize to uppercase for case-insensitive comparison
        break;
      }
    }

    // Also check case-insensitive in all keys
    if (!circle) {
      for (const key in rowData) {
        if (normalizeCircle(key).toUpperCase() === 'CIRCLE') {
          circle = normalizeCircle(rowData[key]); // Normalize to uppercase
          break;
        }
      }
    }

    // If circle still not found, try to derive from Division
    if (!circle && division) {
      const divisionUpper = String(division).trim().toUpperCase();
      // Map divisions to circles
      // HSR, JAYANAGAR, KORAMANGALA → SOUTH CIRCLE
      const southCircleDivisions = ['HSR', 'JAYANAGAR', 'KORAMANGALA'];
      if (southCircleDivisions.includes(divisionUpper)) {
        circle = 'SOUTH';
      }
    }

    // For AMC routing, check Site Code priority first, then fall back to Circle-based routing
    let assignedUser = null;
    if (targetRole === 'AMC') {
      console.log('=== AMC Routing Logic ===');
      console.log('Extracted Site Code:', siteCode);
      console.log('Extracted Circle:', circle);
      console.log('Target Role:', targetRole);
      
      // Priority 1: ALWAYS check Site Code for Jyothi Electricals routing FIRST
      // This takes precedence over Circle-based routing
      if (siteCode) {
        console.log('Priority 1: Checking Site Code priority for AMC routing:', siteCode);
        console.log('Site Code value (before normalization):', siteCode);
        console.log('Site Code type:', typeof siteCode);
        console.log('Site Code length:', siteCode ? siteCode.length : 0);
        
        const siteCodeResult = await findAMCUserBySiteCode(siteCode);
        assignedUser = siteCodeResult;
        
        if (assignedUser) {
          console.log('✓ AMC user found via Site Code priority (Jyothi Electricals):', assignedUser.userId, assignedUser.vendor);
          console.log('STOPPING: Site Code priority succeeded, will NOT check Circle-based routing');
          // IMPORTANT: If Site Code routing succeeds, DO NOT fall back to Circle-based routing
          // Site Code priority takes precedence - even if Site Code exists, it should route to Jyothi if in list
        } else {
          console.log('Site Code priority check did not find a match for:', siteCode);
          console.log('This means Site Code is NOT in Jyothi Electricals list, proceeding to Circle-based routing');
        }
      } else {
        console.log('No Site Code found in rowData, skipping Site Code priority check');
        console.log('Available keys in rowData:', Object.keys(rowData || {}));
      }

      // Priority 2: Only if Site Code routing didn't work (Site Code not in Jyothi list), fall back to Circle-based routing
      if (!assignedUser && circle) {
        console.log('Priority 2: Site Code priority not applicable (Site Code not in Jyothi list), falling back to Circle-based routing:', circle);
        assignedUser = await findAMCUserByCircle(circle);
        
        if (assignedUser) {
          console.log('✓ AMC user found via Circle-based routing:', assignedUser.userId, assignedUser.vendor);
        } else {
          console.log('Circle-based routing also failed, no AMC user found');
        }
      }

      if (!assignedUser) {
        const errorMsg = siteCode 
          ? `No AMC user found for Site Code: ${siteCode} or Circle: ${circle || 'N/A'}. Please ensure an AMC user exists with the appropriate vendor.`
          : `No AMC user found for Circle: ${circle || 'N/A'}. Please ensure an AMC user exists with the appropriate vendor mapped to this circle.`;
        
        console.error('AMC routing failed:', {
          siteCode,
          circle,
          targetVendor: circle === 'SOUTH' || circle === 'WEST' ? 'Shrishaila Electricals(India Pvt ltd)' : 
                        circle === 'NORTH' || circle === 'EAST' ? 'Spectrum Consultants' : 'Unknown'
        });
        
        return res.status(404).json({ 
          success: false, 
          error: errorMsg
        });
      }

      console.log('Final AMC routing result:', {
        userId: assignedUser.userId,
        fullName: assignedUser.fullName,
        vendor: assignedUser.vendor,
        circle: assignedUser.circle,
        routingMethod: siteCode && assignedUser.vendor && assignedUser.vendor.toLowerCase().includes('jyothi') ? 'Site Code Priority' : 'Circle-based'
      });
    } else {
      // For CCR role, find any active CCR user (not division-specific)
      if (targetRole === 'CCR') {
        const allCCRUsers = await User.find({
          role: 'CCR',
          status: 'approved',
          isActive: true
        }).lean();
        
        console.log('CCR user lookup:', {
          found: allCCRUsers.length,
          users: allCCRUsers.map(u => ({
            userId: u.userId,
            fullName: u.fullName,
            role: u.role,
            status: u.status,
            isActive: u.isActive
          }))
        });
        
        assignedUser = allCCRUsers[0]; // Get first available CCR user
        
        if (!assignedUser) {
          return res.status(404).json({ 
            success: false, 
            error: `No CCR user found. Please ensure at least one CCR user exists with status 'approved' and isActive 'true'.` 
          });
        }
        
        console.log('Selected CCR user for assignment:', {
          userId: assignedUser.userId,
          fullName: assignedUser.fullName
        });
      } else {
        // For other roles, find user by division and role
        if (!division) {
          return res.status(400).json({ 
            success: false, 
            error: 'Division not found in row data' 
          });
        }

        assignedUser = await findUserByDivisionAndRole(division, targetRole);
        
        if (!assignedUser) {
          return res.status(404).json({ 
            success: false, 
            error: `No ${targetRole} user found for division: ${division}. Please ensure a user exists with role '${targetRole}' and division '${division}' (case-insensitive matching).` 
          });
        }
      }
    }

    // Create action
    console.log('Creating action with assignment:', {
      assignedToUserId: assignedUser.userId,
      assignedToRole: targetRole,
      assignedToDivision: division || circle || null,
      assignedToVendor: assignedUser.vendor || null,
      assignedByUserId: currentUser.userId,
      assignedByRole: currentUser.role,
      routing,
      typeOfIssue,
      sourceFileId
    });
    
    const action = await Action.create({
      rowData,
      headers: headers || [],
      routing,
      typeOfIssue,
      remarks: remarks || '',
      photo: photo || null,
      assignedToUserId: assignedUser.userId,
      assignedToRole: targetRole,
      assignedToDivision: division || circle || null, // Store division or circle
      assignedToVendor: assignedUser.vendor || null, // Store vendor for AMC routing (if applicable)
      assignedByUserId: currentUser.userId,
      assignedByRole: currentUser.role,
      sourceFileId,
      originalRowIndex: originalRowIndex || null,
      status: 'Pending',
      priority: priority || 'Medium',
      assignedDate: new Date()
    });

    console.log('Action created successfully:', {
      actionId: action._id,
      assignedToUserId: action.assignedToUserId,
      assignedToRole: action.assignedToRole,
      typeOfIssue: action.typeOfIssue,
      routing: action.routing,
      status: action.status,
      assignedUserFullName: assignedUser.fullName,
      assignedUserUserId: assignedUser.userId
    });

    // Reuse siteCode already extracted above, or extract if not already done
    if (!siteCode && rowData) {
      // Try common field names for site code
      const siteCodeKeys = ['Site Code', 'SITE CODE', 'site_code', 'SiteCode', 'Site_Code'];
      for (const key of siteCodeKeys) {
        if (rowData[key]) {
          siteCode = String(rowData[key]).trim();
          break;
        }
      }
      // If no exact match, try case-insensitive search
      if (!siteCode) {
        for (const key in rowData) {
          if (key.toLowerCase().includes('site') && key.toLowerCase().includes('code')) {
            siteCode = String(rowData[key]).trim();
            break;
          }
        }
      }
    }

    // Create notification for the assigned user
    try {
      const notificationTitle = 'New Action Assigned';
      const notificationMessage = siteCode 
        ? `Site ${siteCode} has been routed to you. Type of Issue: ${typeOfIssue}`
        : `A new action has been routed to you. Type of Issue: ${typeOfIssue}`;

      await Notification.create({
        userId: assignedUser.userId,
        title: notificationTitle,
        message: notificationMessage,
        type: 'info',
        category: 'maintenance',
        application: 'Equipment Maintenance',
        link: '/dashboard/my-action',
        metadata: {
          actionId: action._id.toString(),
          sourceFileId,
          priority: priority || 'Medium',
          routing,
          division
        }
      });
    } catch (notifError) {
      // Log error but don't fail the action creation
      console.error('Error creating notification:', notifError);
    }

    // Send email notification
    try {
      await sendRoutingEmail(assignedUser, siteCode, typeOfIssue, division, routing, priority);
    } catch (emailError) {
      // Log error but don't fail the action creation
      console.error('Error sending email notification:', emailError);
    }

    // Create Approval document if this is an approval type action
    if (typeOfIssue === 'AMC Resolution Approval' || typeOfIssue === 'CCR Resolution Approval') {
      try {
        // Extract site code if not already extracted
        let approvalSiteCode = siteCode;
        if (!approvalSiteCode && rowData) {
          const siteCodeKeys = ['Site Code', 'SITE CODE', 'site_code', 'SiteCode', 'Site_Code'];
          for (const key of siteCodeKeys) {
            if (rowData[key]) {
              approvalSiteCode = String(rowData[key]).trim();
              break;
            }
          }
        }

        // Find EquipmentOfflineSites record if available
        let equipmentOfflineSiteId = null;
        if (approvalSiteCode && rowKey) {
          try {
            const equipmentSite = await EquipmentOfflineSites.findOne({
              siteCode: approvalSiteCode.trim().toUpperCase(),
              rowKey: rowKey,
              userId: currentUser.userId
            }).lean();
            
            if (equipmentSite) {
              equipmentOfflineSiteId = equipmentSite._id;
            }
          } catch (equipmentError) {
            console.error('Error finding EquipmentOfflineSites for approval:', equipmentError);
          }
        }

        // Extract photos and support documents from rowData
        const photos = photo ? (Array.isArray(photo) ? photo : [photo]) : [];
        const supportDocuments = rowData.__supportDocuments || [];

        // Create approval document
        const approval = await Approval.create({
          actionId: action._id,
          siteCode: approvalSiteCode ? approvalSiteCode.trim().toUpperCase() : '',
          equipmentOfflineSiteId: equipmentOfflineSiteId,
          approvalType: typeOfIssue,
          status: 'Pending',
          submittedByUserId: currentUser.userId,
          submittedByRole: currentUser.role,
          assignedToUserId: assignedUser.userId,
          assignedToRole: targetRole,
          submissionRemarks: remarks || '',
          photos: photos,
          supportDocuments: supportDocuments,
          fileId: sourceFileId,
          rowKey: rowKey || '',
          originalRowData: rowData || {},
          metadata: {}
        });

        console.log('Approval document created:', {
          approvalId: approval._id,
          actionId: action._id,
          approvalType: typeOfIssue,
          siteCode: approvalSiteCode,
          assignedToUserId: assignedUser.userId
        });
      } catch (approvalError) {
        // Log error but don't fail the action creation
        console.error('Error creating approval document:', approvalError);
      }
    }

    // ===================================================================
    // SIMPLE TWO-DOCUMENT CREATION: Original and Routed
    // Create Equipment Offline Sites documents when routing occurs
    // ===================================================================
    
    console.log('[Routing] Checking if document creation should execute:', {
      hasRowKey: !!rowKey,
      rowKeyValue: rowKey,
      hasSourceFileId: !!sourceFileId,
      sourceFileIdValue: sourceFileId,
      hasSiteCode: !!siteCode,
      siteCodeValue: siteCode,
      hasAssignedUser: !!assignedUser?.userId,
      assignedUserId: assignedUser?.userId,
      willExecute: !!(rowKey && sourceFileId && siteCode && assignedUser?.userId)
    });
    
    if (rowKey && sourceFileId && siteCode && assignedUser?.userId) {
      try {
        // Extract base rowKey (remove routing suffix if exists)
        let baseRowKey = rowKey;
        if (rowKey && rowKey.includes('-routed-')) {
          baseRowKey = rowKey.split('-routed-')[0];
        }

        console.log('[Routing] Creating two documents - Original and Routed:', {
          siteCode: siteCode.trim().toUpperCase(),
          baseRowKey: baseRowKey,
          currentUserId: currentUser.userId,
          routedUserId: assignedUser.userId
        });

        // STEP 1: ALWAYS CREATE ORIGINAL DOCUMENT FIRST (MANDATORY)
        const currentUserDoc = await User.findOne({ userId: currentUser.userId }).lean();
        
        // CRITICAL: Unique index is on {fileId: 1, rowKey: 1}
        // This means only ONE document can exist with same fileId+rowKey (regardless of userId)
        // FIRST: Check if ANY document exists with this fileId+rowKey combination (without userId filter)
        let originalDoc = await EquipmentOfflineSites.findOne({
          fileId: sourceFileId,
          rowKey: baseRowKey
        }).lean();

        console.log('[Routing] 🔍 Checking for original document:', {
          fileId: sourceFileId,
          baseRowKey: baseRowKey,
          currentUserId: currentUser.userId,
          found: !!originalDoc,
          foundDocument: originalDoc ? {
            _id: originalDoc._id.toString(),
            rowKey: originalDoc.rowKey,
            userId: originalDoc.userId,
            foundUserId: originalDoc.userId,
            expectedUserId: currentUser.userId,
            isForCurrentUser: originalDoc.userId === currentUser.userId,
            hasRoutingSuffix: originalDoc.rowKey.includes('-routed-')
          } : null
        });

        // If document exists but belongs to a different user, we have a problem
        if (originalDoc && originalDoc.userId !== currentUser.userId) {
          console.error('[Routing] ❌❌❌ CRITICAL: Document with baseRowKey exists but belongs to DIFFERENT user!', {
            documentId: originalDoc._id.toString(),
            foundUserId: originalDoc.userId,
            currentUserId: currentUser.userId,
            rowKey: originalDoc.rowKey,
            siteCode: originalDoc.siteCode
          });
          // We cannot create a new document due to unique index, so we must throw an error
          throw new Error(`Document with rowKey "${baseRowKey}" already exists for user "${originalDoc.userId}". Cannot create for user "${currentUser.userId}" due to unique index constraint.`);
        }

        // CRITICAL: If document found has routing suffix, it's NOT the original - reset it
        if (originalDoc && originalDoc.rowKey && originalDoc.rowKey.includes('-routed-')) {
          console.error('[Routing] ❌ Found document has routing suffix - NOT original! Will create true original.');
          originalDoc = null;
        }

        // If original document doesn't exist, CREATE IT NOW (MANDATORY)
        if (!originalDoc) {
          console.log('[Routing] Original document NOT found - CREATING it now:', {
            baseRowKey: baseRowKey,
            siteCode: siteCode.trim().toUpperCase(),
            userId: currentUser.userId
          });

          const newOriginalDoc = new EquipmentOfflineSites({
            fileId: sourceFileId,
            rowKey: baseRowKey,
            siteCode: siteCode.trim().toUpperCase(),
            userId: currentUser.userId,
            user: currentUserDoc ? currentUserDoc._id : null,
            originalRowData: rowData || {},
            headers: headers || [],
            siteObservations: 'Pending',
            ccrStatus: '',
            taskStatus: taskStatus || `Pending at ${currentUser.role} Team`,
            typeOfIssue: typeOfIssue || '',
            viewPhotos: photo ? (Array.isArray(photo) ? photo : [photo]) : [],
            photoMetadata: [],
            remarks: remarks || '',
            supportDocuments: [],
            deviceStatus: '',
            noOfDaysOffline: null,
            circle: circle || '',
            division: division || '',
            subDivision: '',
            status: 'Pending',
            savedFrom: 'Original document created on routing',
            lastSyncedAt: new Date(),
            createdAt: new Date(),
          });
          
          try {
            await newOriginalDoc.save();
            originalDoc = newOriginalDoc.toObject();
            console.log('[Routing] ✅✅✅ Original document CREATED successfully:', {
              documentId: newOriginalDoc._id.toString(),
              rowKey: baseRowKey,
              userId: currentUser.userId,
              siteCode: siteCode.trim().toUpperCase()
            });

            // IMMEDIATE VERIFICATION: Check document was actually saved
            const verifySaved = await EquipmentOfflineSites.findById(newOriginalDoc._id).lean();
            if (!verifySaved) {
              console.error('[Routing] ❌❌❌ CRITICAL: Original document not found immediately after save!');
              throw new Error('Original document was not saved to database');
            }
            console.log('[Routing] ✓✓✓ Verified: Original document exists in database after save:', {
              documentId: verifySaved._id.toString(),
              database: EquipmentOfflineSites.db.name,
              collection: EquipmentOfflineSites.collection.name,
              connectionState: EquipmentOfflineSites.db.readyState
            });
          } catch (error) {
            console.error('[Routing] ❌❌❌ CRITICAL ERROR creating original document:', {
              error: error.message,
              errorCode: error.code,
              errorName: error.name,
              stack: error.stack
            });

            if (error.code === 11000) {
              // Duplicate key error - document already exists with this fileId+rowKey
              console.log('[Routing] Duplicate key error - trying to find existing document...');
              originalDoc = await EquipmentOfflineSites.findOne({
                fileId: sourceFileId,
                rowKey: baseRowKey
              }).lean();

              if (originalDoc && originalDoc.userId === currentUser.userId && !originalDoc.rowKey.includes('-routed-')) {
                console.log('[Routing] ✓ Found existing original document after duplicate error');
              } else if (originalDoc) {
                console.error('[Routing] ❌ Found document but wrong user or has routing suffix:', {
                  foundUserId: originalDoc.userId,
                  currentUserId: currentUser.userId,
                  hasRoutingSuffix: originalDoc.rowKey.includes('-routed-'),
                  message: 'Cannot use this as original document'
                });
                originalDoc = null;
              } else {
                console.error('[Routing] ❌❌❌ CRITICAL: Original document not found after duplicate error!');
                originalDoc = null;
              }
            } else {
              // Other error - cannot proceed
              throw error;
            }
          }
        } else {
          // Convert mongoose document to object if needed
          if (originalDoc.toObject) {
            originalDoc = originalDoc.toObject();
          }
          
          // VERIFY: Check document actually exists in database by ID
          const verifyById = await EquipmentOfflineSites.findById(originalDoc._id).lean();
          if (!verifyById) {
            console.error('[Routing] ❌❌❌ CRITICAL: Document found but does NOT exist in database by ID!', {
              documentId: originalDoc._id.toString(),
              rowKey: originalDoc.rowKey,
              userId: originalDoc.userId
            });
            originalDoc = null; // Reset to null so we create it
          } else {
            console.log('[Routing] ✓ Original document already exists - verified in database:', {
              documentId: originalDoc._id.toString(),
              rowKey: originalDoc.rowKey,
              userId: originalDoc.userId,
              siteCode: originalDoc.siteCode,
              fileId: originalDoc.fileId,
              verifiedInDatabase: true
            });
          }
        }

        // CRITICAL CHECK: Original document MUST exist before proceeding
        if (!originalDoc || !originalDoc._id) {
          console.error('[Routing] ❌❌❌ CRITICAL ERROR: Original document is missing - ABORTING routed document creation');
          
          // Final database check - query directly to see what exists
          const dbCheck = await EquipmentOfflineSites.find({
            fileId: sourceFileId,
            siteCode: siteCode.trim().toUpperCase()
          }).select('_id rowKey userId siteObservations').lean();
          
          console.error('[Routing] Database check - all documents for this fileId+siteCode:', {
            fileId: sourceFileId,
            siteCode: siteCode.trim().toUpperCase(),
            foundDocuments: dbCheck.map(d => ({
              _id: d._id.toString(),
              rowKey: d.rowKey,
              userId: d.userId,
              siteObservations: d.siteObservations,
              hasRoutingSuffix: d.rowKey.includes('-routed-')
            }))
          });
          
          throw new Error('Original document must exist before creating routed document - creation failed');
        }

        // STEP 2: OWNERSHIP TRANSFER - Transfer original document ownership to assigned user
        // Get assignedUserDoc FIRST (before ownership transfer) so it's available for routed document creation
        let assignedUserDoc = null;
        try {
          assignedUserDoc = await User.findOne({ userId: assignedUser.userId }).lean();
          if (!assignedUserDoc) {
            console.error('[Ownership Transfer] ⚠️ WARNING: Could not find User document for assigned user:', assignedUser.userId);
          } else {
            console.log('[Ownership Transfer] ✓ Found assigned user document:', {
              userId: assignedUser.userId,
              userObjectId: assignedUserDoc._id?.toString()
            });
          }
        } catch (userDocError) {
          console.error('[Ownership Transfer] ❌ ERROR fetching assigned user document:', userDocError.message);
          assignedUserDoc = null;
        }
        
        console.log('\n[Ownership Transfer] ========================================');
        console.log('[Ownership Transfer] 🔄 Starting ownership transfer process');
        console.log('[Ownership Transfer] Transfer Details:', {
          originalDocumentId: originalDoc._id.toString(),
          fromUserId: currentUser.userId,
          fromUserRole: currentUser.role,
          fromUserName: currentUser.fullName || currentUser.userId,
          toUserId: assignedUser.userId,
          toUserRole: targetRole,
          toUserName: assignedUser.fullName || assignedUser.userId,
          siteCode: siteCode.trim().toUpperCase(),
          fileId: sourceFileId,
          rowKey: baseRowKey,
          routing: routing,
          typeOfIssue: typeOfIssue
        });

        try {

          // Store previous values for logging
          const previousOwner = originalDoc.userId;
          const previousTaskStatus = originalDoc.taskStatus || '';
          const previousSavedFrom = originalDoc.savedFrom || '';

          // Preserve originalUserId when transferring ownership
          // This ensures Pending Site Observations show in Reports for original owner
          const originalUserIdValue = originalDoc.originalUserId || originalDoc.userId;
          
          // Update original document to transfer ownership
          const ownershipUpdateData = {
            userId: assignedUser.userId, // Transfer ownership to assigned user
            originalUserId: originalUserIdValue, // Preserve original owner for Reports visibility
            user: assignedUserDoc ? assignedUserDoc._id : null,
            taskStatus: taskStatus || `Pending at ${targetRole} Team`,
            savedFrom: `Ownership transferred from ${currentUser.role} to ${targetRole}`,
            lastSyncedAt: new Date(),
            updatedAt: new Date()
          };

          console.log('[Ownership Transfer] 📝 Updating original document:', {
            documentId: originalDoc._id.toString(),
            changes: {
              userId: {
                from: previousOwner,
                to: assignedUser.userId
              },
              taskStatus: {
                from: previousTaskStatus,
                to: ownershipUpdateData.taskStatus
              },
              savedFrom: {
                from: previousSavedFrom,
                to: ownershipUpdateData.savedFrom
              }
            }
          });

          // Perform ownership transfer update
          const updatedOriginalDoc = await EquipmentOfflineSites.findByIdAndUpdate(
            originalDoc._id,
            ownershipUpdateData,
            { new: true, runValidators: true }
          ).lean();

          if (!updatedOriginalDoc) {
            throw new Error('Failed to update document during ownership transfer');
          }

          console.log('[Ownership Transfer] ✅✅✅ Ownership transfer completed successfully!');
          console.log('[Ownership Transfer] Transfer Summary:', {
            documentId: updatedOriginalDoc._id.toString(),
            previousOwner: previousOwner,
            newOwner: updatedOriginalDoc.userId,
            previousTaskStatus: previousTaskStatus,
            newTaskStatus: updatedOriginalDoc.taskStatus,
            previousSavedFrom: previousSavedFrom,
            newSavedFrom: updatedOriginalDoc.savedFrom,
            transferTimestamp: new Date().toISOString(),
            transferDuration: 'Completed'
          });

          // Verify ownership transfer in database
          const verifyTransfer = await EquipmentOfflineSites.findById(originalDoc._id).lean();
          if (verifyTransfer && verifyTransfer.userId === assignedUser.userId) {
            console.log('[Ownership Transfer] ✓✓✓ Verification PASSED: Document ownership successfully transferred');
            console.log('[Ownership Transfer] Verification Details:', {
              documentId: verifyTransfer._id.toString(),
              currentOwner: verifyTransfer.userId,
              expectedOwner: assignedUser.userId,
              ownershipMatch: verifyTransfer.userId === assignedUser.userId,
              taskStatus: verifyTransfer.taskStatus,
              savedFrom: verifyTransfer.savedFrom
            });
          } else {
            console.error('[Ownership Transfer] ❌❌❌ Verification FAILED: Ownership transfer not confirmed');
            console.error('[Ownership Transfer] Verification Details:', {
              documentId: originalDoc._id.toString(),
              currentOwner: verifyTransfer?.userId,
              expectedOwner: assignedUser.userId,
              ownershipMatch: verifyTransfer?.userId === assignedUser.userId
            });
          }

          // Update originalDoc reference for use in routed document creation
          originalDoc = updatedOriginalDoc;

          console.log('[Ownership Transfer] ========================================\n');
        } catch (ownershipError) {
          console.error('[Ownership Transfer] ❌❌❌ ERROR during ownership transfer');
          console.error('[Ownership Transfer] Error Details:', {
            error: ownershipError.message,
            stack: ownershipError.stack,
            documentId: originalDoc._id.toString(),
            fromUserId: currentUser.userId,
            toUserId: assignedUser.userId
          });
          console.log('[Ownership Transfer] ⚠️ Continuing with routed document creation despite ownership transfer failure\n');
          // Continue with routed document creation even if ownership transfer fails
          // The original document still exists, just ownership wasn't transferred
        }

        // STEP 3: Create ROUTED document (for assigned user) - only if original exists
        // Ensure assignedUserDoc is available (fetch again if needed)
        if (!assignedUserDoc) {
          console.log('[Routing] Fetching assignedUserDoc for routed document creation...');
          try {
            assignedUserDoc = await User.findOne({ userId: assignedUser.userId }).lean();
          } catch (err) {
            console.error('[Routing] Error fetching assignedUserDoc:', err.message);
            assignedUserDoc = null;
          }
        }
        
        const timestamp = Date.now();
        const routedRowKey = `${baseRowKey}-routed-${assignedUser.userId}-${timestamp}`;
        
        console.log('[Routing] Creating routed document with assignedUserDoc:', {
          hasAssignedUserDoc: !!assignedUserDoc,
          assignedUserId: assignedUser.userId
        });
        
        const routedDoc = new EquipmentOfflineSites({
          fileId: sourceFileId,
          rowKey: routedRowKey,
          siteCode: siteCode.trim().toUpperCase(),
          userId: assignedUser.userId,
          user: assignedUserDoc ? assignedUserDoc._id : null,
          originalRowData: originalDoc.originalRowData || rowData || {},
          headers: originalDoc.headers || headers || [],
          siteObservations: 'Pending',
          ccrStatus: '',
          taskStatus: taskStatus || `Pending at ${targetRole} Team`,
          typeOfIssue: typeOfIssue || '',
          viewPhotos: originalDoc.viewPhotos || (photo ? (Array.isArray(photo) ? photo : [photo]) : []),
          photoMetadata: originalDoc.photoMetadata || [],
          remarks: remarks || originalDoc.remarks || '',
          supportDocuments: originalDoc.supportDocuments || [],
          deviceStatus: originalDoc.deviceStatus || '',
          noOfDaysOffline: originalDoc.noOfDaysOffline || null,
          circle: originalDoc.circle || circle || '',
          division: originalDoc.division || division || '',
          subDivision: originalDoc.subDivision || '',
          status: 'Pending',
          savedFrom: `Routed from ${currentUser.role} to ${targetRole}`,
          lastSyncedAt: new Date(),
          createdAt: new Date(),
        });

        await routedDoc.save();
        console.log('[Routing] ✅ Routed document created:', {
          documentId: routedDoc._id.toString(),
          rowKey: routedRowKey,
          userId: assignedUser.userId,
          originalDocId: originalDoc._id.toString()
        });
        
        // IMMEDIATE VERIFICATION: Check routed document was actually saved to database
        const verifyRoutedSaved = await EquipmentOfflineSites.findById(routedDoc._id).lean();
        if (!verifyRoutedSaved) {
          console.error('[Routing] ❌❌❌ CRITICAL: Routed document not found immediately after save!');
          throw new Error('Routed document was not saved to database');
        }
        console.log('[Routing] ✓✓✓ Verified: Routed document exists in database after save:', {
          documentId: verifyRoutedSaved._id.toString(),
          rowKey: verifyRoutedSaved.rowKey,
          userId: verifyRoutedSaved.userId,
          database: EquipmentOfflineSites.db.name,
          collection: EquipmentOfflineSites.collection.name
        });

        // FINAL VERIFICATION: Check both documents exist in database
        // First, verify by ID directly (most reliable)
        const verifyOriginalById = originalDoc && originalDoc._id 
          ? await EquipmentOfflineSites.findById(originalDoc._id).lean()
          : null;
        
        // Also check by query (WITHOUT userId filter initially, then verify)
        // After ownership transfer, userId has changed, so we can't filter by original userId
        let verifyOriginal = await EquipmentOfflineSites.findOne({
          fileId: sourceFileId,
          rowKey: baseRowKey,
          siteCode: siteCode.trim().toUpperCase()
        }).lean();
        
        // If found but userId doesn't match, check if ownership was transferred
        if (verifyOriginal && verifyOriginal.userId !== currentUser.userId) {
          // Check if ownership was transferred
          if (verifyOriginal.savedFrom && verifyOriginal.savedFrom.includes('Ownership transferred')) {
            console.log('[Routing] Original document found but userId changed due to ownership transfer - this is expected');
            // This is expected - ownership was transferred, so userId is different
          } else {
            // Not an ownership transfer case - might be an issue
            console.log('[Routing] Original document found with different userId but no ownership transfer indicator');
          }
        }

        // Check ALL documents with this fileId+siteCode (to see what's actually there)
        const allDocsForSite = await EquipmentOfflineSites.find({
          fileId: sourceFileId,
          siteCode: siteCode.trim().toUpperCase()
        }).select('_id rowKey userId siteCode fileId savedFrom createdAt').lean();

        const verifyRouted = await EquipmentOfflineSites.findOne({
          fileId: sourceFileId,
          rowKey: routedRowKey,
          siteCode: siteCode.trim().toUpperCase(),
          userId: assignedUser.userId
        }).lean();

        console.log('[Routing] 🔍 Final verification - COMPLETE DATABASE CHECK:');
        console.log('[Routing] Original document verification:', {
          originalDocumentId: originalDoc?._id?.toString(),
          originalDocumentExistsById: !!verifyOriginalById,
          originalDocumentExistsByQuery: !!verifyOriginal,
          originalDocUserId: verifyOriginalById?.userId || verifyOriginal?.userId,
          expectedUserId: currentUser.userId,
          originalRowKey: verifyOriginalById?.rowKey || verifyOriginal?.rowKey,
          originalSavedFrom: verifyOriginalById?.savedFrom || verifyOriginal?.savedFrom
        });
        
        console.log('[Routing] Routed document verification:', {
          routedDocumentExists: !!verifyRouted,
          routedDocumentId: verifyRouted?._id?.toString(),
          routedRowKey: verifyRouted?.rowKey,
          routedUserId: verifyRouted?.userId
        });

        console.log('[Routing] ALL documents for this fileId+siteCode in database:', {
          fileId: sourceFileId,
          siteCode: siteCode.trim().toUpperCase(),
          database: EquipmentOfflineSites.db.name,
          collection: EquipmentOfflineSites.collection.name,
          totalDocuments: allDocsForSite.length,
          documents: allDocsForSite.map(d => ({
            _id: d._id.toString(),
            rowKey: d.rowKey,
            userId: d.userId,
            isOriginal: !d.rowKey.includes('-routed-'),
            isRouted: d.rowKey.includes('-routed-'),
            savedFrom: d.savedFrom,
            createdAt: d.createdAt
          }))
        });
        
        // ADDITIONAL VERIFICATION: Direct database query using native MongoDB driver
        // This bypasses Mongoose to ensure we're querying the actual database
        try {
          const db = EquipmentOfflineSites.db;
          const collection = db.collection('Equipment offline sites');
          
          const directQueryResults = await collection.find({
            fileId: sourceFileId,
            siteCode: siteCode.trim().toUpperCase()
          }).toArray();
          
          // Get database name from connection
          const mongooseDb = mongoose.connection.db;
          const dbName = mongooseDb?.databaseName || db?.databaseName || EquipmentOfflineSites.db?.databaseName || 'unknown';
          
          console.log('[Routing] 🔍 DIRECT DATABASE QUERY (bypassing Mongoose):', {
            database: dbName,
            collection: collection.collectionName,
            totalDocuments: directQueryResults.length,
            documents: directQueryResults.map(d => ({
              _id: d._id.toString(),
              rowKey: d.rowKey,
              userId: d.userId,
              isOriginal: !d.rowKey.includes('-routed-'),
              isRouted: d.rowKey.includes('-routed-')
            }))
          });
          
          console.log('[Routing] 📍 HOW TO FIND IN MONGODB COMPASS:', {
            step1: '1. Open MongoDB Compass',
            step2: `2. Connect to your MongoDB server`,
            step3: `3. Select database: "${dbName}"`,
            step4: `4. Open collection: "Equipment offline sites"`,
            step5: `5. Use Filter: { "fileId": "${sourceFileId}", "siteCode": "${siteCode.trim().toUpperCase()}" }`,
            step6: `6. Or search by ID: { "_id": ObjectId("${originalDoc._id.toString()}") }`,
            step7: `7. Expected: ${directQueryResults.length} document(s) should be visible`
          });
          
          if (directQueryResults.length !== allDocsForSite.length) {
            console.error('[Routing] ⚠️ WARNING: Mongoose query and direct DB query return different results!', {
              mongooseResults: allDocsForSite.length,
              directQueryResults: directQueryResults.length
            });
          }
        } catch (dbError) {
          console.error('[Routing] ❌ Error in direct database query:', dbError.message);
        }

        // Summary of verification results
        const bothDocumentsExist = verifyOriginal && verifyRouted;
        
        if (bothDocumentsExist) {
          console.log('[Routing] ✅✅✅ SUCCESS: Both documents verified in database!', {
            originalDocumentId: verifyOriginal._id.toString(),
            routedDocumentId: verifyRouted._id.toString(),
            originalUserId: verifyOriginal.userId,
            routedUserId: verifyRouted.userId,
            siteCode: siteCode.trim().toUpperCase()
          });
        } else {
          console.error('[Routing] ❌❌❌ VERIFICATION FAILED:', {
            originalDocumentExists: !!verifyOriginal,
            routedDocumentExists: !!verifyRouted,
            originalDocumentId: verifyOriginal?._id?.toString() || 'NOT FOUND',
            routedDocumentId: verifyRouted?._id?.toString() || 'NOT FOUND',
            totalDocumentsFound: allDocsForSite.length,
            siteCode: siteCode.trim().toUpperCase()
          });
          
          if (!verifyOriginal) {
            console.error('[Routing] ❌❌❌ CRITICAL: Original document NOT found in database!');
            console.error('[Routing] Expected document:', {
              fileId: sourceFileId,
              rowKey: baseRowKey,
              siteCode: siteCode.trim().toUpperCase(),
              userId: currentUser.userId
            });
          }
          
          if (!verifyRouted) {
            console.error('[Routing] ❌❌❌ CRITICAL: Routed document NOT found in database!');
            console.error('[Routing] Expected document:', {
              fileId: sourceFileId,
              rowKey: routedRowKey,
              siteCode: siteCode.trim().toUpperCase(),
              userId: assignedUser.userId
            });
          }
        }
      } catch (error) {
        console.error('[Routing] ❌❌❌ CRITICAL ERROR creating documents:', {
          error: error.message,
          stack: error.stack,
          siteCode: siteCode,
          rowKey: rowKey,
          currentUserId: currentUser.userId,
          routedUserId: assignedUser?.userId
        });
        // Don't fail the entire request - action was already created
        // But log the error so we can debug
      }
    }

    res.json({
      success: true,
      message: `Action assigned to ${assignedUser.fullName || assignedUser.userId} (${targetRole}, ${division || 'N/A'})`,
      action: {
        _id: action._id.toString(),
        id: action._id.toString(),
        assignedToUserId: action.assignedToUserId,
        assignedToRole: action.assignedToRole,
        assignedToDivision: action.assignedToDivision,
        typeOfIssue: action.typeOfIssue,
        routing: action.routing,
        status: action.status
      }
    });

    // FINAL ASYNC VERIFICATION: Check documents persist after response is sent
    // This runs asynchronously so it doesn't block the response
    if (siteCode && sourceFileId) {
      setTimeout(async () => {
        try {
          const finalCheck = await EquipmentOfflineSites.find({
            fileId: sourceFileId,
            siteCode: siteCode.trim().toUpperCase()
          }).lean();
          
          const mongooseDb = mongoose.connection.db;
          const dbName = mongooseDb?.databaseName || 'unknown';
          
          console.log('[Routing] 🔍 FINAL ASYNC VERIFICATION (after response sent):', {
            timestamp: new Date().toISOString(),
            database: dbName,
            collection: 'Equipment offline sites',
            fileId: sourceFileId,
            siteCode: siteCode.trim().toUpperCase(),
            totalDocuments: finalCheck.length,
            documents: finalCheck.map(d => ({
              _id: d._id.toString(),
              rowKey: d.rowKey,
              userId: d.userId,
              isOriginal: !d.rowKey.includes('-routed-'),
              isRouted: d.rowKey.includes('-routed-')
            }))
          });
          
          if (finalCheck.length !== 2) {
            console.error('[Routing] ⚠️ WARNING: Expected 2 documents but found', finalCheck.length);
          } else {
            console.log('[Routing] ✅✅✅ FINAL VERIFICATION PASSED: Both documents persist in database');
          }
        } catch (verifyError) {
          console.error('[Routing] ❌ Error in final async verification:', verifyError.message);
        }
      }, 2000); // Wait 2 seconds after response is sent
    }
  } catch (error) {
    console.error('Error submitting routing:', error);
    next(error);
  }
}

// Get actions routed by current user (for Equipment users to see status of routed actions)
export async function getMyRoutedActions(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Find actions where current user is the assigner (routed by them)
    const query = { 
      assignedByUserId: currentUser.userId,
      assignedByRole: currentUser.role
    };

    // Find actions
    const actions = await Action.find(query)
      .sort({ assignedDate: -1 })
      .lean();

    res.json({
      success: true,
      count: actions.length,
      actions: actions
    });
  } catch (error) {
    console.error('Error fetching routed actions:', error);
    next(error);
  }
}

// Get actions assigned to current user
export async function getMyActions(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log('getMyActions - Current user:', {
      userId: currentUser.userId,
      role: currentUser.role,
      fullName: currentUser.fullName
    });

    const { status, priority, search } = req.query;
    
    // Build query
    const query = { assignedToUserId: currentUser.userId };
    
    console.log('getMyActions - Query:', query);
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Find actions
    let actions = await Action.find(query)
      .sort({ assignedDate: -1 })
      .lean();

    console.log('getMyActions - Found actions:', {
      count: actions.length,
      actionTypes: actions.map(a => a.typeOfIssue),
      assignedToUserIds: [...new Set(actions.map(a => a.assignedToUserId))],
      actions: actions.map(a => ({
        _id: a._id,
        typeOfIssue: a.typeOfIssue,
        status: a.status,
        assignedToUserId: a.assignedToUserId,
        routing: a.routing
      }))
    });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      actions = actions.filter(action => {
        // Search in rowData fields
        if (action.rowData) {
          return Object.values(action.rowData).some(val => 
            String(val || '').toLowerCase().includes(searchLower)
          );
        }
        // Search in other fields
        return (
          (action.routing && action.routing.toLowerCase().includes(searchLower)) ||
          (action.typeOfIssue && action.typeOfIssue.toLowerCase().includes(searchLower)) ||
          (action.remarks && action.remarks.toLowerCase().includes(searchLower)) ||
          (action.assignedToDivision && action.assignedToDivision.toLowerCase().includes(searchLower))
        );
      });
    }

    res.json({
      success: true,
      count: actions.length,
      actions: actions
    });
  } catch (error) {
    console.error('Error fetching actions:', error);
    next(error);
  }
}

// Get all actions (for CCR role to see all actions)
export async function getAllActions(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Only allow CCR role to fetch all actions
    if (currentUser.role !== 'CCR') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only CCR role can access all actions' });
    }

    console.log('getAllActions - CCR user fetching all actions');

    // Find all actions
    const actions = await Action.find({})
      .sort({ assignedDate: -1 })
      .lean();

    console.log('getAllActions - Found actions:', {
      count: actions.length
    });

    res.json({
      success: true,
      data: actions,
      count: actions.length
    });
  } catch (error) {
    console.error('Error fetching all actions:', error);
    next(error);
  }
}

// Update action status
export async function updateActionStatus(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { actionId } = req.params;
    const { status, remarks } = req.body;

    // Verify action belongs to current user
    const action = await Action.findOne({
      _id: actionId,
      assignedToUserId: currentUser.userId
    });

    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found or not assigned to you'
      });
    }

    // Update status
    if (status) {
      action.status = status;
      if (status === 'Completed') {
        action.completedDate = new Date();
      }
    }

    if (remarks !== undefined) {
      action.remarks = remarks;
    }

    await action.save();

    // ------------------------------------------------------------------
    // Generic: For non-AMC, non-CCR users completing a regular action,
    // create a CCR approval action directly (single-step approval).
    // ------------------------------------------------------------------
    try {
      const statusUpper = typeof status === 'string' ? status.toUpperCase() : '';
      const isCompleted = statusUpper === 'COMPLETED';
      const isAMCApprovalType = action.typeOfIssue === 'AMC Resolution Approval';
      const isCCRApprovalType = action.typeOfIssue === 'CCR Resolution Approval';
      const isRegularAction = !isAMCApprovalType && !isCCRApprovalType;
      const isNonAMCNonCCR =
        currentUser.role !== 'AMC' && currentUser.role !== 'CCR';

      if (isCompleted && isRegularAction && isNonAMCNonCCR) {
        // Use this action as the original that needs CCR approval
        const originalAction = action;

        // Find any active CCR user (CCR is not division-specific)
        const allCCRUsers = await User.find({
          role: 'CCR',
          status: 'approved',
          isActive: true
        }).lean();
        
        console.log('CCR user lookup (generic action completion):', {
          found: allCCRUsers.length,
          users: allCCRUsers.map(u => ({
            userId: u.userId,
            fullName: u.fullName
          }))
        });
        
        const ccrUser = allCCRUsers[0]; // Get first available CCR user

        if (ccrUser) {
          console.log('Selected CCR user for generic approval:', {
            userId: ccrUser.userId,
            fullName: ccrUser.fullName
          });
          console.log('Creating CCR approval action for regular action completion:', {
            originalActionId: originalAction._id,
            originalTypeOfIssue: originalAction.typeOfIssue,
            ccrUserId: ccrUser.userId,
            ccrUserFullName: ccrUser.fullName,
            division: originalAction.assignedToDivision
          });
          
          // Mark original action as completed (it's already resolved, waiting for CCR approval)
          // Note: Status enum only allows 'Pending', 'In Progress', 'Completed'
          // We use 'Completed' since the action is done, approval is a separate workflow
          originalAction.status = 'Completed';
          if (remarks !== undefined) {
            originalAction.remarks = remarks;
          }
          await originalAction.save();

          const ccrApproval = await Action.create({
            rowData: {
              ...originalAction.rowData,
              _actionId: originalAction._id.toString(),
              __siteObservationStatus: 'Resolved'
            },
            headers: originalAction.headers || [],
            routing: 'CCR Team',
            typeOfIssue: 'CCR Resolution Approval',
            remarks:
              remarks ||
              'Resolution completed; pending CCR approval',
            photo: originalAction.photo || null,
            assignedToUserId: ccrUser.userId,
            assignedToRole: 'CCR',
            assignedToDivision: originalAction.assignedToDivision || 'General',
            assignedByUserId: currentUser.userId,
            assignedByRole: currentUser.role,
            sourceFileId: originalAction.sourceFileId,
            originalRowIndex: originalAction.originalRowIndex || null,
            status: 'Pending',
            priority: originalAction.priority || 'Medium',
            assignedDate: new Date()
          });
          
          console.log('CCR approval action created (generic):', {
            actionId: ccrApproval._id,
            assignedToUserId: ccrApproval.assignedToUserId,
            ccrUserUserId: ccrUser.userId,
            typeOfIssue: ccrApproval.typeOfIssue,
            status: ccrApproval.status,
            match: ccrApproval.assignedToUserId === ccrUser.userId
          });

          // Create Approval document for CCR Resolution Approval
          try {
            const row = originalAction.rowData || {};
            const approvalSiteCode = (row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '').trim().toUpperCase();
            
            // Find EquipmentOfflineSites record
            let equipmentOfflineSiteId = null;
            if (approvalSiteCode) {
              const equipmentSite = await EquipmentOfflineSites.findOne({
                siteCode: approvalSiteCode,
                userId: originalAction.assignedByUserId || originalAction.assignedToUserId,
                siteObservations: '' // Resolved = empty string
              })
              .sort({ createdAt: -1 })
              .lean();
              
              if (equipmentSite) {
                equipmentOfflineSiteId = equipmentSite._id;
              }
            }

            const photos = originalAction.photo ? (Array.isArray(originalAction.photo) ? originalAction.photo : [originalAction.photo]) : [];
            const supportDocuments = row.__supportDocuments || [];

            const approval = await Approval.create({
              actionId: ccrApproval._id,
              siteCode: approvalSiteCode,
              equipmentOfflineSiteId: equipmentOfflineSiteId,
              approvalType: 'CCR Resolution Approval',
              status: 'Pending',
              submittedByUserId: originalAction.assignedByUserId || currentUser.userId,
              submittedByRole: originalAction.assignedByRole || currentUser.role,
              assignedToUserId: ccrUser.userId,
              assignedToRole: 'CCR',
              submissionRemarks: originalAction.remarks || '',
              photos: photos,
              supportDocuments: supportDocuments,
              fileId: originalAction.sourceFileId || action.sourceFileId,
              rowKey: row.__siteObservationRowKey || '',
              originalRowData: row || {},
              metadata: {}
            });

            console.log('Approval document created for CCR Resolution Approval (generic):', {
              approvalId: approval._id,
              actionId: ccrApproval._id,
              siteCode: approvalSiteCode
            });
          } catch (approvalError) {
            console.error('Error creating approval document for CCR Resolution Approval (generic):', approvalError);
          }

          // Optional notification to CCR
          try {
            const row = originalAction.rowData || {};
            const siteCode =
              row['Site Code'] ||
              row['SITE CODE'] ||
              row['Code'] ||
              row['CODE'] ||
              '';
            await Notification.create({
              userId: ccrUser.userId,
              title: 'Resolution Approval Required',
              message: siteCode
                ? `Site ${siteCode} resolution requires your approval.`
                : 'A resolution requires your approval.',
              type: 'info',
              category: 'maintenance',
              application: 'Equipment Maintenance',
              link: '/dashboard/my-approvals',
              metadata: {
                actionId: ccrApproval._id.toString(),
                originalActionId: originalAction._id.toString()
              }
            });
          } catch (notifErr) {
            console.error(
              'Error creating CCR approval notification (generic path):',
              notifErr
            );
          }
        } else {
          console.warn(
            'No CCR user found to assign generic CCR approval for completed action',
            {
              originalActionId: originalAction._id,
              originalTypeOfIssue: originalAction.typeOfIssue,
              division: originalAction.assignedToDivision,
              currentUserRole: currentUser.role
            }
          );
        }
      }
    } catch (genericCCRError) {
      console.error(
        'Error creating generic CCR approval action:',
        genericCCRError
      );
      // Do not fail the main response because of this secondary update
    }

    // ------------------------------------------------------------------
    // STEP 1: Equipment approves/rechecks AMC Resolution Approval action (FIRST APPROVAL)
    //         - Create/Update Approval document for AMC Resolution Approval
    //         - Mirror status on original AMC/vendor action
    //         - When Completed, create CCR approval action (SECOND APPROVAL)
    // ------------------------------------------------------------------
    try {
      const isEquipment = currentUser.role === 'Equipment';
      const statusUpper = typeof status === 'string' ? status.toUpperCase() : '';
      const isCompleted = statusUpper === 'COMPLETED';
      const isInProgress = statusUpper === 'IN PROGRESS';
      const isAMCApprovalType = action.typeOfIssue === 'AMC Resolution Approval';
      const originalActionId = action.rowData && action.rowData._actionId;

      // FIRST: Create/Update Approval document for AMC Resolution Approval (First Approval)
      if (isEquipment && (isCompleted || isInProgress) && isAMCApprovalType) {
        try {
          // Find or create Approval document for this AMC Resolution Approval action
          let amcApproval = await Approval.findOne({ actionId: action._id });
          
          if (!amcApproval) {
            console.log('[STEP 1] Creating Approval document for AMC Resolution Approval (First Approval):', action._id);
            
            // Extract site code and other data from action
            const row = action.rowData || {};
            const approvalSiteCode = (row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '').trim().toUpperCase();
            
            // Find EquipmentOfflineSites record
            let equipmentOfflineSiteId = null;
            if (approvalSiteCode) {
              try {
                const equipmentSite = await EquipmentOfflineSites.findOne({
                  siteCode: approvalSiteCode,
                  userId: action.assignedToUserId || action.assignedByUserId,
                })
                .sort({ createdAt: -1 })
                .lean();
                
                if (equipmentSite) {
                  equipmentOfflineSiteId = equipmentSite._id;
                }
              } catch (equipmentError) {
                console.error('Error finding EquipmentOfflineSites for AMC approval:', equipmentError);
              }
            }

            const photos = action.photo ? (Array.isArray(action.photo) ? action.photo : [action.photo]) : [];
            const supportDocuments = row.__supportDocuments || [];

            // Determine initial status
            let initialStatus = 'Pending';
            if (isCompleted) {
              initialStatus = 'Approved';
            } else if (isInProgress) {
              const remarksLower = String(remarks || '').toLowerCase();
              if (remarksLower.includes('kept for monitoring')) {
                initialStatus = 'Kept for Monitoring';
              } else {
                initialStatus = 'Recheck Requested';
              }
            }

            // Create Approval document for AMC Resolution Approval (First Approval)
            amcApproval = await Approval.create({
              actionId: action._id,
              siteCode: approvalSiteCode,
              equipmentOfflineSiteId: equipmentOfflineSiteId,
              approvalType: 'AMC Resolution Approval',
              status: initialStatus,
              submittedByUserId: action.assignedByUserId || currentUser.userId,
              submittedByRole: action.assignedByRole || 'AMC',
              assignedToUserId: action.assignedToUserId || currentUser.userId,
              assignedToRole: 'Equipment',
              submissionRemarks: action.remarks || '',
              photos: photos,
              supportDocuments: supportDocuments,
              fileId: action.sourceFileId,
              rowKey: row.__siteObservationRowKey || '',
              originalRowData: row || {},
              metadata: {}
            });

            // Set approver info if already approved
            if (isCompleted || (isInProgress && String(remarks || '').toLowerCase().includes('kept for monitoring'))) {
              amcApproval.approvedByUserId = currentUser.userId;
              amcApproval.approvedByRole = currentUser.role;
              amcApproval.approvedAt = new Date();
              if (remarks !== undefined) {
                amcApproval.approvalRemarks = remarks;
              }
              await amcApproval.save();
            }

            console.log('[STEP 1] Created Approval document for AMC Resolution Approval (First Approval):', {
              approvalId: amcApproval._id,
              actionId: action._id,
              status: initialStatus
            });
          } else {
            // Update existing Approval document
            let newApprovalStatus = amcApproval.status;
            
            if (isCompleted) {
              newApprovalStatus = 'Approved';
              amcApproval.approvedByUserId = currentUser.userId;
              amcApproval.approvedByRole = currentUser.role;
              amcApproval.approvedAt = new Date();
            } else if (isInProgress) {
              const remarksLower = String(remarks || '').toLowerCase();
              if (remarksLower.includes('kept for monitoring')) {
                newApprovalStatus = 'Kept for Monitoring';
                amcApproval.approvedByUserId = currentUser.userId;
                amcApproval.approvedByRole = currentUser.role;
                amcApproval.approvedAt = new Date();
              } else {
                newApprovalStatus = 'Recheck Requested';
              }
            }
            
            amcApproval.status = newApprovalStatus;
            if (remarks !== undefined) {
              amcApproval.approvalRemarks = remarks;
            }
            
            await amcApproval.save();
            
            console.log('[STEP 1] Updated Approval document for AMC Resolution Approval (First Approval):', {
              approvalId: amcApproval._id,
              actionId: action._id,
              newStatus: newApprovalStatus
            });
          }
        } catch (amcApprovalError) {
          console.error('[STEP 1] Error creating/updating AMC Resolution Approval document:', amcApprovalError);
          // Don't fail the main response
        }
      }

      // SECOND: Handle original action and create CCR approval ONLY if Equipment verified and approved
      // IMPORTANT: CCR approval is ONLY created when Equipment "Verify and Approve" (status = Completed)
      // For "Recheck" (In Progress) or "Kept for Monitoring" (In Progress), do NOT create CCR approval
      console.log('[STEP 1] Checking Equipment approval conditions:', {
        isEquipment,
        isCompleted,
        isInProgress,
        isAMCApprovalType,
        originalActionId,
        actionId: action._id,
        actionTypeOfIssue: action.typeOfIssue,
        actionStatus: action.status
      });

      if (isEquipment && (isCompleted || isInProgress) && isAMCApprovalType) {
        // Try to get original action if originalActionId exists
        let originalAction = null;
        if (originalActionId) {
          originalAction = await Action.findById(originalActionId);
          if (originalAction) {
            console.log('[STEP 1] Found original action:', {
              originalActionId: originalAction._id,
              originalActionStatus: originalAction.status
            });
            if (isCompleted) {
              // Mark original action as completed (it's already resolved, waiting for CCR approval)
              // Note: Status enum only allows 'Pending', 'In Progress', 'Completed'
              // We use 'Completed' since the action is done, approval is a separate workflow
              originalAction.status = 'Completed';
            } else if (isInProgress) {
              // Recheck or Kept for Monitoring from Equipment goes back to AMC
              // Do NOT create CCR approval for these actions
              originalAction.status = 'In Progress';
            }

            if (remarks !== undefined) {
              originalAction.remarks = remarks;
            }
            await originalAction.save();
          } else {
            console.log('[STEP 1] Original action not found for originalActionId:', originalActionId);
          }
        } else {
          console.log('[STEP 1] No originalActionId found, using current action as actionData');
        }

        // Use originalAction if available, otherwise use the current action for data
        const actionData = originalAction || action;
        console.log('[STEP 1] Using actionData:', {
          actionDataId: actionData._id,
          actionDataTypeOfIssue: actionData.typeOfIssue
        });

        // CRITICAL: Only create CCR approval action if Equipment "Verify and Approve" (status = Completed)
        // Do NOT create CCR approval for "Recheck" (In Progress) or "Kept for Monitoring" (In Progress)
        let ccrUser = null; // Declare outside to use in notification
        let ccrApproval = null; // Declare outside to use in notification
        if (isCompleted) {
            console.log('[STEP 1] Equipment verified and approved - Creating CCR approval (Second Approval)');
            // Find any active CCR user (CCR is not division-specific)
            const allCCRUsers = await User.find({
              role: 'CCR',
              status: 'approved',
              isActive: true
            }).lean();
            
            console.log('CCR user lookup (Equipment approval):', {
              found: allCCRUsers.length,
              users: allCCRUsers.map(u => ({
                userId: u.userId,
                fullName: u.fullName
              }))
            });
            
            ccrUser = allCCRUsers[0]; // Get first available CCR user

            if (ccrUser) {
              console.log('Selected CCR user for Equipment approval:', {
                userId: ccrUser.userId,
                fullName: ccrUser.fullName
              });
              console.log('Creating CCR approval action after Equipment approval:', {
                originalActionId: actionData._id,
                equipmentApprovalActionId: action._id,
                ccrUserId: ccrUser.userId,
                ccrUserFullName: ccrUser.fullName,
                division: actionData.assignedToDivision
              });
              
              ccrApproval = await Action.create({
                rowData: {
                  ...actionData.rowData,
                  _actionId: actionData._id.toString(),
                  __equipmentApprovalActionId: action._id.toString(),
                  __siteObservationStatus: 'Resolved'
                },
                headers: actionData.headers || [],
                routing: 'CCR Team',
                typeOfIssue: 'CCR Resolution Approval',
                remarks:
                  remarks ||
                  'Resolution approved by Equipment; pending CCR approval',
                photo: actionData.photo || null,
                assignedToUserId: ccrUser.userId,
                assignedToRole: 'CCR',
                assignedToDivision: actionData.assignedToDivision || null,
                assignedByUserId: currentUser.userId,
                assignedByRole: currentUser.role,
                sourceFileId: actionData.sourceFileId || action.sourceFileId,
                originalRowIndex: actionData.originalRowIndex || action.originalRowIndex || null,
                status: 'Pending',
                priority: actionData.priority || action.priority || 'Medium',
                assignedDate: new Date()
              });
              
              console.log('CCR approval action created (Equipment approval):', {
                actionId: ccrApproval._id,
                assignedToUserId: ccrApproval.assignedToUserId,
                ccrUserUserId: ccrUser.userId,
                typeOfIssue: ccrApproval.typeOfIssue,
                status: ccrApproval.status,
                match: ccrApproval.assignedToUserId === ccrUser.userId
              });

              // Create Approval document for CCR Resolution Approval (SECOND APPROVAL)
              // This is created AFTER Equipment has approved the AMC Resolution Approval (First Approval)
              try {
                console.log('[STEP 1] Creating Approval document for CCR Resolution Approval (Second Approval)');
                const row = actionData.rowData || {};
                const approvalSiteCode = (row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '').trim().toUpperCase();
                
                // Find EquipmentOfflineSites record
                let equipmentOfflineSiteId = null;
                if (approvalSiteCode) {
                  const equipmentSite = await EquipmentOfflineSites.findOne({
                    siteCode: approvalSiteCode,
                    userId: actionData.assignedByUserId || actionData.assignedToUserId || currentUser.userId,
                    siteObservations: '' // Resolved = empty string
                  })
                  .sort({ createdAt: -1 })
                  .lean();
                  
                  if (equipmentSite) {
                    equipmentOfflineSiteId = equipmentSite._id;
                  }
                }

                const photos = actionData.photo ? (Array.isArray(actionData.photo) ? actionData.photo : [actionData.photo]) : [];
                const supportDocuments = row.__supportDocuments || [];

                // Create Approval document for CCR Resolution Approval (Second Approval)
                // Equipment user is submitting this for CCR approval after approving AMC Resolution
                const ccrApprovalDoc = await Approval.create({
                  actionId: ccrApproval._id,
                  siteCode: approvalSiteCode,
                  equipmentOfflineSiteId: equipmentOfflineSiteId,
                  approvalType: 'CCR Resolution Approval',
                  status: 'Pending', // CCR hasn't approved yet
                  submittedByUserId: currentUser.userId, // Equipment user who submitted for CCR approval
                  submittedByRole: currentUser.role, // Equipment role
                  assignedToUserId: ccrUser.userId,
                  assignedToRole: 'CCR',
                  submissionRemarks: remarks || 'Resolution approved by Equipment; pending CCR approval',
                  photos: photos,
                  supportDocuments: supportDocuments,
                  fileId: actionData.sourceFileId || action.sourceFileId,
                  rowKey: row.__siteObservationRowKey || '',
                  originalRowData: row || {},
                  metadata: {
                    firstApprovalActionId: action._id.toString(), // Link to first approval (AMC Resolution Approval)
                    firstApprovalType: 'AMC Resolution Approval'
                  }
                });

                console.log('[STEP 1] Approval document created for CCR Resolution Approval (Second Approval):', {
                  approvalId: ccrApprovalDoc._id,
                  actionId: ccrApproval._id,
                  siteCode: approvalSiteCode,
                  firstApprovalActionId: action._id
                });
              } catch (approvalError) {
                console.error('[STEP 1] Error creating approval document for CCR Resolution Approval (Second Approval):', approvalError);
              }

              // Optional notification to CCR (only if CCR approval was created)
              try {
                const row = actionData.rowData || {};
                const siteCode =
                  row['Site Code'] ||
                  row['SITE CODE'] ||
                  row['Code'] ||
                  row['CODE'] ||
                  '';
                await Notification.create({
                  userId: ccrUser.userId,
                  title: 'Resolution Approval Required',
                  message: siteCode
                    ? `Site ${siteCode} resolution requires your approval.`
                    : 'A resolution requires your approval.',
                  type: 'info',
                  category: 'maintenance',
                  application: 'Equipment Maintenance',
                  link: '/dashboard/my-approvals',
                  metadata: {
                    actionId: ccrApproval._id.toString(),
                    originalActionId: actionData._id.toString()
                  }
                });
              } catch (notifErr) {
                console.error(
                  'Error creating CCR approval notification:',
                  notifErr
                );
              }
            } else {
              console.warn('[STEP 1] No CCR user found - Cannot create second approval');
            }
          } else {
            // Equipment did NOT approve (Recheck or Kept for Monitoring)
            // Do NOT create CCR approval - this is correct behavior
            console.log('[STEP 1] Equipment action is NOT "Verify and Approve" (status:', status, ') - Skipping CCR approval creation');
          }
      }
    } catch (linkError) {
      console.error(
        'Error handling Equipment approval for AMC Resolution:',
        linkError
      );
      // Do not fail the main response because of this secondary update
    }

    // ------------------------------------------------------------------
    // STEP 2: CCR approves/rechecks CCR Resolution Approval action
    //         - Finalize or revert original AMC action
    //         - Update CCR status in EquipmentOfflineSites collection
    // ------------------------------------------------------------------
    try {
      const isCCR = currentUser.role === 'CCR';
      const statusUpper = typeof status === 'string' ? status.toUpperCase() : '';
      const isCompleted = statusUpper === 'COMPLETED';
      const isInProgress = statusUpper === 'IN PROGRESS';
      const isCCRApprovalType = action.typeOfIssue === 'CCR Resolution Approval';
      const originalActionId = action.rowData && action.rowData._actionId;

      console.log('[updateActionStatus] STEP 2 - CCR Approval Check:', {
        isCCR: isCCR,
        isCompleted: isCompleted,
        isInProgress: isInProgress,
        isCCRApprovalType: isCCRApprovalType,
        originalActionId: originalActionId,
        actionId: action._id,
        actionTypeOfIssue: action.typeOfIssue,
        actionStatus: action.status
      });

      // Handle original action update if originalActionId exists
      if (isCCR && (isCompleted || isInProgress) && isCCRApprovalType && originalActionId) {
        const originalAction = await Action.findById(originalActionId);
        if (originalAction) {
          if (isCompleted) {
            originalAction.status = 'Completed';
            originalAction.completedDate = new Date();
          } else if (isInProgress) {
            // CCR asked for recheck – back to AMC
            originalAction.status = 'In Progress';
          }

          if (remarks !== undefined) {
            originalAction.remarks = remarks;
          }
          await originalAction.save();
        }
      }
      
      // Update Approval document if this is an approval action
      if ((isCCR || currentUser.role === 'Equipment') && isCCRApprovalType) {
        try {
          // Find the approval document for this action
          const approval = await Approval.findOne({ actionId: action._id });
          
          if (approval) {
            // Determine the new status based on action status and remarks
            let newApprovalStatus = approval.status;
            
            if (isCompleted) {
              newApprovalStatus = 'Approved';
              approval.approvedByUserId = currentUser.userId;
              approval.approvedByRole = currentUser.role;
              approval.approvedAt = new Date();
            } else if (isInProgress) {
              const remarksLower = String(remarks || '').toLowerCase();
              if (remarksLower.includes('kept for monitoring')) {
                newApprovalStatus = 'Kept for Monitoring';
                approval.approvedByUserId = currentUser.userId;
                approval.approvedByRole = currentUser.role;
                approval.approvedAt = new Date();
              } else {
                newApprovalStatus = 'Recheck Requested';
              }
            }
            
            approval.status = newApprovalStatus;
            if (remarks !== undefined) {
              approval.approvalRemarks = remarks;
            }
            
            await approval.save();
            
            console.log('[updateActionStatus] Updated Approval document:', {
              approvalId: approval._id,
              actionId: action._id,
              newStatus: newApprovalStatus
            });
          } else {
            console.warn('[updateActionStatus] Approval document not found for action:', action._id);
          }
        } catch (approvalUpdateError) {
          console.error('[updateActionStatus] Error updating Approval document:', approvalUpdateError);
          // Don't fail the main response
        }
      }
      
      // Update Approval document if this is an approval action
      if ((isCCR || currentUser.role === 'Equipment') && (isCCRApprovalType || action.typeOfIssue === 'AMC Resolution Approval')) {
        try {
          // Find the approval document for this action
          let approval = await Approval.findOne({ actionId: action._id });
          
          // If approval doesn't exist, create it
          if (!approval) {
            console.log('[updateActionStatus] Approval document not found, creating new one for action:', action._id);
            
            // Extract site code and other data from action
            const row = action.rowData || {};
            const approvalSiteCode = (row['Site Code'] || row['SITE CODE'] || row['Code'] || row['CODE'] || '').trim().toUpperCase();
            
            // Find EquipmentOfflineSites record
            // For AMC Resolution Approval: assignedToUserId is the Equipment user who owns the site
            // For CCR Resolution Approval: assignedByUserId is the Equipment user who submitted
            let equipmentOfflineSiteId = null;
            if (approvalSiteCode) {
              try {
                const EquipmentOfflineSites = (await import('../models/EquipmentOfflineSites.js')).default;
                // Try multiple user IDs to find the EquipmentOfflineSites record
                const possibleUserIds = [
                  action.assignedToUserId, // Equipment user for AMC Resolution Approval
                  action.assignedByUserId, // Equipment user for CCR Resolution Approval
                  currentUser.userId // Current user (Equipment)
                ].filter(Boolean);
                
                for (const userId of possibleUserIds) {
                  const equipmentSite = await EquipmentOfflineSites.findOne({
                    siteCode: approvalSiteCode,
                    userId: userId,
                  })
                  .sort({ createdAt: -1 })
                  .lean();
                  
                  if (equipmentSite) {
                    equipmentOfflineSiteId = equipmentSite._id;
                    break;
                  }
                }
              } catch (equipmentError) {
                console.error('Error finding EquipmentOfflineSites for approval:', equipmentError);
              }
            }

            const photos = action.photo ? (Array.isArray(action.photo) ? action.photo : [action.photo]) : [];
            const supportDocuments = row.__supportDocuments || [];

            // Determine initial status based on action status
            let initialStatus = 'Pending';
            if (isCompleted) {
              initialStatus = 'Approved';
            } else if (isInProgress) {
              const remarksLower = String(remarks || '').toLowerCase();
              if (remarksLower.includes('kept for monitoring')) {
                initialStatus = 'Kept for Monitoring';
              } else {
                initialStatus = 'Recheck Requested';
              }
            }

            // Create new approval document
            approval = await Approval.create({
              actionId: action._id,
              siteCode: approvalSiteCode,
              equipmentOfflineSiteId: equipmentOfflineSiteId,
              approvalType: action.typeOfIssue,
              status: initialStatus,
              submittedByUserId: action.assignedByUserId || currentUser.userId,
              submittedByRole: action.assignedByRole || currentUser.role,
              assignedToUserId: action.assignedToUserId,
              assignedToRole: action.assignedToRole,
              submissionRemarks: action.remarks || '',
              photos: photos,
              supportDocuments: supportDocuments,
              fileId: action.sourceFileId,
              rowKey: row.__siteObservationRowKey || '',
              originalRowData: row || {},
              metadata: {}
            });

            // Set approver info if already approved
            if (isCompleted || (isInProgress && String(remarks || '').toLowerCase().includes('kept for monitoring'))) {
              approval.approvedByUserId = currentUser.userId;
              approval.approvedByRole = currentUser.role;
              approval.approvedAt = new Date();
              if (remarks !== undefined) {
                approval.approvalRemarks = remarks;
              }
              await approval.save();
            }

            console.log('[updateActionStatus] Created new Approval document:', {
              approvalId: approval._id,
              actionId: action._id,
              approvalType: action.typeOfIssue,
              initialStatus: initialStatus
            });
          } else {
            // Approval exists, update it
            // Determine the new status based on action status and remarks
            let newApprovalStatus = approval.status;
            
            if (isCompleted) {
              newApprovalStatus = 'Approved';
              approval.approvedByUserId = currentUser.userId;
              approval.approvedByRole = currentUser.role;
              approval.approvedAt = new Date();
            } else if (isInProgress) {
              const remarksLower = String(remarks || '').toLowerCase();
              if (remarksLower.includes('kept for monitoring')) {
                newApprovalStatus = 'Kept for Monitoring';
                approval.approvedByUserId = currentUser.userId;
                approval.approvedByRole = currentUser.role;
                approval.approvedAt = new Date();
              } else {
                newApprovalStatus = 'Recheck Requested';
              }
            }
            
            approval.status = newApprovalStatus;
            if (remarks !== undefined) {
              approval.approvalRemarks = remarks;
            }
            
            await approval.save();
            
            console.log('[updateActionStatus] Updated Approval document:', {
              approvalId: approval._id,
              actionId: action._id,
              newStatus: newApprovalStatus
            });
          }
        } catch (approvalUpdateError) {
          console.error('[updateActionStatus] Error updating Approval document:', approvalUpdateError);
          // Don't fail the main response
        }
      }
      
      // Update CCR status in EquipmentOfflineSites collection (works even without originalActionId)
      // Handle both "Completed" (Approved) and "In Progress" with "kept for monitoring" remarks (Kept for Monitoring)
      const isKeptForMonitoring = isInProgress && remarks && String(remarks).toLowerCase().includes('kept for monitoring');
      
      if (isCCR && (isCompleted || isKeptForMonitoring) && isCCRApprovalType) {
        try {
          const EquipmentOfflineSites = (await import('../models/EquipmentOfflineSites.js')).default;
          
          // Try multiple strategies to find the EquipmentOfflineSites record
          let equipmentSite = null;
          
          // Get originalAction if it exists (for extracting rowData)
          let originalAction = null;
          if (originalActionId) {
            originalAction = await Action.findById(originalActionId);
          }
          
          // Extract all possible identifiers
          const currentRow = action.rowData || {};
          const originalRow = (originalAction && originalAction.rowData) || {};
          const rowKey = currentRow.__siteObservationRowKey || originalRow.__siteObservationRowKey;
          const fileId = action.sourceFileId || originalAction?.sourceFileId;
              
              // Extract siteCode from multiple possible locations
              const siteCode = (currentRow['Site Code'] || currentRow['SITE CODE'] || currentRow['Code'] || currentRow['CODE'] || 
                                originalRow['Site Code'] || originalRow['SITE CODE'] || originalRow['Code'] || originalRow['CODE'] || '').trim().toUpperCase();
              
              // Extract userId from action or original action
              const userId = (originalAction && (originalAction.assignedByUserId || originalAction.assignedToUserId)) || action.assignedByUserId || action.assignedToUserId;
              
              console.log('[updateActionStatus] CCR Approval - Searching for EquipmentOfflineSites record:', {
                actionId: action._id,
                originalActionId: originalActionId,
                rowKey: rowKey,
                fileId: fileId,
                siteCode: siteCode,
                userId: userId,
                currentRowKeys: Object.keys(currentRow),
                originalRowKeys: Object.keys(originalRow)
              });
              
              // Strategy 1: Try to find by rowKey and fileId (most reliable)
              if (rowKey && fileId) {
                // First try exact match by fileId and rowKey with ccrStatus='Pending' or 'Kept for Monitoring'
                equipmentSite = await EquipmentOfflineSites.findOne({
                  fileId: fileId,
                  rowKey: rowKey,
                  ccrStatus: { $in: ['Pending', 'Kept for Monitoring'] }
                })
                .sort({ createdAt: -1 })
                .lean();
                
                // If not found, try with siteObservations='' (Resolved)
                if (!equipmentSite) {
                  equipmentSite = await EquipmentOfflineSites.findOne({
                    fileId: fileId,
                    rowKey: rowKey,
                    siteObservations: '' // Resolved = empty string
                  })
                  .sort({ createdAt: -1 })
                  .lean();
                }
                
                // If not found, try with "-resolved-" pattern (when new document is created for Resolved)
                if (!equipmentSite) {
                  equipmentSite = await EquipmentOfflineSites.findOne({
                    fileId: fileId,
                    rowKey: { $regex: `^${rowKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-resolved-` },
                    ccrStatus: 'Pending'
                  })
                  .sort({ createdAt: -1 })
                  .lean();
                }
                
                console.log('[updateActionStatus] Strategy 1 - Searching by fileId and rowKey:', {
                  fileId: fileId,
                  rowKey: rowKey,
                  found: !!equipmentSite,
                  foundId: equipmentSite?._id,
                  foundCCRStatus: equipmentSite?.ccrStatus
                });
              }
              
              // Strategy 2: If not found, try by siteCode and userId with ccrStatus='Pending' or 'Kept for Monitoring'
              if (!equipmentSite && siteCode && userId) {
                equipmentSite = await EquipmentOfflineSites.findOne({
                  siteCode: siteCode,
                  userId: userId,
                  ccrStatus: { $in: ['Pending', 'Kept for Monitoring'] }
                })
                .sort({ createdAt: -1 })
                .lean();
                
                console.log('[updateActionStatus] Strategy 2 - Searching by siteCode, userId, and ccrStatus in [Pending, Kept for Monitoring]:', {
                  siteCode: siteCode,
                  userId: userId,
                  found: !!equipmentSite,
                  foundId: equipmentSite?._id,
                  foundCCRStatus: equipmentSite?.ccrStatus
                });
              }
              
              // Strategy 3: If not found, try by siteCode and userId with siteObservations='' (Resolved)
              if (!equipmentSite && siteCode && userId) {
                equipmentSite = await EquipmentOfflineSites.findOne({
                  siteCode: siteCode,
                  userId: userId,
                  siteObservations: '' // Resolved = empty string
                })
                .sort({ createdAt: -1 })
                .lean();
                
                console.log('[updateActionStatus] Strategy 3 - Searching by siteCode, userId, and siteObservations="":', {
                  siteCode: siteCode,
                  userId: userId,
                  found: !!equipmentSite,
                  foundId: equipmentSite?._id,
                  foundCCRStatus: equipmentSite?.ccrStatus
                });
              }
              
              // Strategy 4: If still not found, try by siteCode only with ccrStatus='Pending' or 'Kept for Monitoring'
              if (!equipmentSite && siteCode) {
                equipmentSite = await EquipmentOfflineSites.findOne({
                  siteCode: siteCode,
                  ccrStatus: { $in: ['Pending', 'Kept for Monitoring'] }
                })
                .sort({ createdAt: -1 })
                .lean();
                
                console.log('[updateActionStatus] Strategy 4 - Searching by siteCode and ccrStatus in [Pending, Kept for Monitoring]:', {
                  siteCode: siteCode,
                  found: !!equipmentSite,
                  foundId: equipmentSite?._id,
                  foundCCRStatus: equipmentSite?.ccrStatus
                });
              }
              
              // Strategy 5: Final fallback - try by siteCode only (any status)
              if (!equipmentSite && siteCode) {
                equipmentSite = await EquipmentOfflineSites.findOne({
                  siteCode: siteCode,
                  siteObservations: '' // Resolved = empty string
                })
                .sort({ createdAt: -1 })
                .lean();
                
                console.log('[updateActionStatus] Strategy 5 - Searching by siteCode only:', {
                  siteCode: siteCode,
                  found: !!equipmentSite,
                  foundId: equipmentSite?._id,
                  foundCCRStatus: equipmentSite?.ccrStatus
                });
              }
              
              if (equipmentSite) {
                // Determine the CCR status based on action status and remarks
                let newCCRStatus = 'Approved'; // Default to Approved for Completed
                if (isKeptForMonitoring) {
                  newCCRStatus = 'Kept for Monitoring';
                }
                
                // Update CCR status (FINAL APPROVAL - CCR is the final approval authority)
                // When CCR approves, the record will be hidden from MY OFFLINE SITES tab but remains in database
                const updateResult = await EquipmentOfflineSites.updateOne(
                  { _id: equipmentSite._id },
                  { 
                    $set: { 
                      ccrStatus: newCCRStatus,
                      lastSyncedAt: new Date()
                    } 
                  }
                );
                
                console.log(`[updateActionStatus] ✅ Successfully updated CCR status to ${newCCRStatus} (FINAL APPROVAL):`, {
                  siteCode: equipmentSite.siteCode,
                  equipmentSiteId: equipmentSite._id,
                  userId: equipmentSite.userId,
                  rowKey: equipmentSite.rowKey,
                  fileId: equipmentSite.fileId,
                  previousCCRStatus: equipmentSite.ccrStatus,
                  newCCRStatus: newCCRStatus,
                  willBeHiddenFromMyOfflineSites: newCCRStatus === 'Approved',
                  updateResult: {
                    matchedCount: updateResult.matchedCount,
                    modifiedCount: updateResult.modifiedCount
                  }
                });
                
                // Verify the update
                const verifyRecord = await EquipmentOfflineSites.findById(equipmentSite._id).lean();
                console.log('[updateActionStatus] Verification - Record after update:', {
                  _id: verifyRecord?._id,
                  ccrStatus: verifyRecord?.ccrStatus,
                  siteCode: verifyRecord?.siteCode
                });
              } else {
                console.warn('[updateActionStatus] ❌ EquipmentOfflineSites record not found for CCR approval:', {
                  actionId: action._id,
                  originalActionId: originalActionId,
                  searchedRowKey: rowKey,
                  searchedFileId: fileId,
                  searchedSiteCode: siteCode,
                  searchedUserId: userId,
                  suggestion: 'Check if the record exists with matching siteCode and ccrStatus="Pending"'
                });
              }
            } catch (equipmentUpdateError) {
              console.error('[updateActionStatus] ❌ Error updating EquipmentOfflineSites CCR status:', equipmentUpdateError);
              console.error('[updateActionStatus] Error stack:', equipmentUpdateError.stack);
              // Don't fail the main response because of this secondary update
            }
          }
    } catch (ccrLinkError) {
      console.error(
        'Error updating original action linked to CCR Resolution Approval:',
        ccrLinkError
      );
      // Do not fail the main response because of this secondary update
    }

    res.json({
      success: true,
      message: 'Action updated successfully',
      action: action.toObject()
    });
  } catch (error) {
    console.error('Error updating action:', error);
    next(error);
  }
}

// Reroute action to a different user
export async function rerouteAction(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { actionId } = req.params;
    const { assignedToUserId, assignedToRole, remarks, photo } = req.body;

    // Validate required fields
    if (!assignedToUserId || !assignedToRole) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: assignedToUserId, assignedToRole' 
      });
    }

    // Find the action
    const action = await Action.findById(actionId);

    if (!action) {
      return res.status(404).json({ 
        success: false, 
        error: 'Action not found' 
      });
    }

    // Find the target user
    const targetUser = await User.findOne({ 
      userId: assignedToUserId,
      role: assignedToRole,
      status: 'approved',
      isActive: true
    });

    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        error: `Target user not found or not active. User: ${assignedToUserId}, Role: ${assignedToRole}` 
      });
    }

    // Find the original assigned user for reroute email
    const originalAssignedUser = await User.findOne({
      userId: action.assignedToUserId,
      role: action.assignedToRole
    });

    // Combine existing remarks with reroute remarks if provided
    let updatedRemarks = action.remarks || '';
    if (remarks && remarks.trim()) {
      updatedRemarks = updatedRemarks 
        ? `${updatedRemarks}\n\n[Rerouted] ${remarks}` 
        : `[Rerouted] ${remarks}`;
    }

    // Combine existing photos with reroute photos if provided
    let updatedPhotos = action.photo ? (Array.isArray(action.photo) ? action.photo : [action.photo]) : [];
    if (photo && Array.isArray(photo) && photo.length > 0) {
      updatedPhotos = [...updatedPhotos, ...photo];
    }

    // Update action assignment
    action.assignedToUserId = assignedToUserId;
    action.assignedToRole = assignedToRole;
    // Update vendor information when rerouting to AMC/vendor users
    action.assignedToVendor = targetUser.vendor || null;
    action.status = 'Pending'; // Reset status when rerouted
    action.remarks = updatedRemarks;
    action.photo = updatedPhotos.length > 0 ? updatedPhotos : null;
    await action.save();

    // Extract site code from rowData
    let siteCode = '';
    if (action.rowData) {
      const siteCodeKeys = ['Site Code', 'SITE CODE', 'site_code', 'SiteCode', 'Site_Code'];
      for (const key of siteCodeKeys) {
        if (action.rowData[key]) {
          siteCode = action.rowData[key];
          break;
        }
      }
      if (!siteCode) {
        for (const key in action.rowData) {
          if (key.toLowerCase().includes('site') && key.toLowerCase().includes('code')) {
            siteCode = action.rowData[key];
            break;
          }
        }
      }
    }

    // Create notification for the new assigned user
    try {
      const notificationTitle = 'Action Rerouted to You';
      const notificationMessage = siteCode 
        ? `Site ${siteCode} action has been rerouted to you. Type of Issue: ${action.typeOfIssue}`
        : `An action has been rerouted to you. Type of Issue: ${action.typeOfIssue}`;

      await Notification.create({
        userId: assignedToUserId,
        title: notificationTitle,
        message: notificationMessage,
        type: 'info',
        category: 'maintenance',
        application: 'Equipment Maintenance',
        link: '/dashboard/my-action',
        metadata: {
          actionId: action._id.toString(),
          sourceFileId: action.sourceFileId,
          priority: action.priority,
          routing: action.routing,
          division: action.assignedToDivision
        }
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
    }

    // Send email notification
    try {
      await sendRoutingEmail(targetUser, siteCode, action.typeOfIssue, action.assignedToDivision, action.routing, action.priority, originalAssignedUser);
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    // ===================================================================
    // CORE REQUIREMENT: OWNERSHIP TRANSFER on Re-routing
    // Create Equipment Offline Sites document when rerouting occurs
    // ===================================================================
    if (siteCode && action.sourceFileId && action.rowKey) {
      try {
        console.log('Reroute Ownership Transfer - Starting:', {
          siteCode: siteCode.trim().toUpperCase(),
          actionId: action._id,
          currentUser: {
            userId: currentUser.userId,
            role: currentUser.role
          },
          targetUser: {
            userId: assignedToUserId,
            role: assignedToRole
          }
        });
        
        // Find current user's document (the one being rerouted from)
        let equipmentSite = await EquipmentOfflineSites.findOne({
          fileId: action.sourceFileId,
          userId: currentUser.userId,
          siteCode: siteCode.trim().toUpperCase(),
          siteObservations: { $ne: '' } // Only Pending
        })
        .sort({ createdAt: 1 })
        .lean();
        
        // If not found by userId, try finding any Pending document for this siteCode
        if (!equipmentSite) {
          equipmentSite = await EquipmentOfflineSites.findOne({
            fileId: action.sourceFileId,
            siteCode: siteCode.trim().toUpperCase(),
            siteObservations: { $ne: '' }
          })
          .sort({ createdAt: 1 })
          .lean();
        }
        
        // ENHANCEMENT: Handle missing document on reroute
        if (!equipmentSite) {
          console.log('Equipment Offline Sites document not found for reroute - creating from action data:', {
            siteCode: siteCode.trim().toUpperCase(),
            actionId: action._id,
            sourceFileId: action.sourceFileId
          });
          
          // Create document from action data
          const currentUserDoc = await User.findOne({ userId: currentUser.userId }).lean();
          const rerouteEquipmentSite = new EquipmentOfflineSites({
            fileId: action.sourceFileId,
            rowKey: action.rowKey,
            siteCode: siteCode.trim().toUpperCase(),
            userId: currentUser.userId,
            user: currentUserDoc ? currentUserDoc._id : null,
            originalRowData: action.rowData || {},
            headers: action.headers || [],
            siteObservations: 'Pending',
            ccrStatus: '',
            taskStatus: action.remarks || `Pending at ${currentUser.role} Team`,
            typeOfIssue: action.typeOfIssue || '',
            viewPhotos: [],
            photoMetadata: [],
            remarks: action.remarks || '',
            supportDocuments: [],
            deviceStatus: '',
            noOfDaysOffline: null,
            circle: '',
            division: action.assignedToDivision || '',
            subDivision: '',
            status: 'Pending',
            savedFrom: 'Reroute - initial document',
            lastSyncedAt: new Date(),
            createdAt: new Date(),
          });
          
          await rerouteEquipmentSite.save();
          equipmentSite = rerouteEquipmentSite.toObject();
          
          console.log('✓ Initial Equipment Offline Sites document created for reroute:', {
            siteCode: siteCode.trim().toUpperCase(),
            documentId: rerouteEquipmentSite._id
          });
        }
        
        if (equipmentSite && equipmentSite.userId !== assignedToUserId) {
          // Get target user's ObjectId
          const targetUserDoc = await User.findOne({ userId: assignedToUserId }).lean();
          
          // Extract base rowKey
          let baseRowKey = action.rowKey || equipmentSite.rowKey;
          if (equipmentSite.rowKey && equipmentSite.rowKey.includes('-routed-')) {
            baseRowKey = equipmentSite.rowKey.split('-routed-')[0];
          }
          
          // ENHANCEMENT: Check for existing document (concurrent rerouting protection)
          const existingTargetDoc = await EquipmentOfflineSites.findOne({
            fileId: action.sourceFileId,
            siteCode: siteCode.trim().toUpperCase(),
            userId: assignedToUserId,
            siteObservations: { $ne: '' },
            rowKey: { $regex: new RegExp(`-routed-${assignedToUserId}-`, 'i') }
          }).lean();
          
          if (existingTargetDoc) {
            console.log('Equipment Offline Sites document already exists for rerouted user:', {
              siteCode: siteCode.trim().toUpperCase(),
              existingDocumentId: existingTargetDoc._id,
              targetUserId: assignedToUserId
            });
          } else {
            const timestamp = Date.now();
            const newRowKey = `${baseRowKey}-routed-${assignedToUserId}-${timestamp}`;
            
            // Create new document for rerouted user
            const newEquipmentSite = new EquipmentOfflineSites({
              fileId: action.sourceFileId,
              rowKey: newRowKey,
              siteCode: siteCode.trim().toUpperCase(),
              userId: assignedToUserId, // New owner
              user: targetUserDoc ? targetUserDoc._id : null,
              originalRowData: equipmentSite.originalRowData || action.rowData || {},
              headers: equipmentSite.headers || action.headers || [],
              siteObservations: equipmentSite.siteObservations || 'Pending',
              ccrStatus: equipmentSite.ccrStatus || '',
              taskStatus: `Pending at ${assignedToRole} Team`,
              typeOfIssue: action.typeOfIssue || equipmentSite.typeOfIssue || '',
              viewPhotos: equipmentSite.viewPhotos || [],
              photoMetadata: equipmentSite.photoMetadata || [],
              remarks: action.remarks || equipmentSite.remarks || '',
              supportDocuments: equipmentSite.supportDocuments || [],
              deviceStatus: equipmentSite.deviceStatus || '',
              noOfDaysOffline: equipmentSite.noOfDaysOffline || null,
              circle: equipmentSite.circle || '',
              division: equipmentSite.division || action.assignedToDivision || '',
              subDivision: equipmentSite.subDivision || '',
              status: 'Pending',
              savedFrom: `Rerouted from ${currentUser.role} to ${assignedToRole}`,
              lastSyncedAt: new Date(),
              createdAt: new Date(),
            });
            
            await newEquipmentSite.save();
            
            console.log('✓ Equipment Offline Sites document created for reroute:', {
              siteCode: siteCode.trim().toUpperCase(),
              sourceDocumentId: equipmentSite._id,
              newDocumentId: newEquipmentSite._id,
              previousOwner: equipmentSite.userId,
              newOwner: assignedToUserId,
              routing: action.routing
            });
          }
        } else if (equipmentSite && equipmentSite.userId === assignedToUserId) {
          console.log('Equipment Offline Sites document already owned by rerouted user:', {
            siteCode: siteCode.trim().toUpperCase(),
            userId: assignedToUserId
          });
        }
      } catch (rerouteOwnershipError) {
        // ENHANCEMENT: Enhanced error logging - doesn't fail reroute
        console.error('❌ Error creating Equipment Offline Sites document for reroute:', {
          error: rerouteOwnershipError.message,
          stack: rerouteOwnershipError.stack,
          siteCode: siteCode,
          actionId: action._id,
          message: 'Reroute action was still successful, but ownership document creation failed'
        });
        // Don't throw error - reroute should still succeed
      }
    }

    res.json({
      success: true,
      message: `Action rerouted to ${targetUser.fullName || targetUser.userId} (${assignedToRole})`,
      action: {
        id: action._id,
        assignedToUserId: action.assignedToUserId,
        assignedToRole: action.assignedToRole,
        assignedToDivision: action.assignedToDivision
      }
    });
  } catch (error) {
    console.error('Error rerouting action:', error);
    next(error);
  }
}

// Delete action from database
export async function deleteAction(req, res, next) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { actionId } = req.params;

    // Verify action belongs to current user
    const action = await Action.findOne({ 
      _id: actionId, 
      assignedToUserId: currentUser.userId 
    });

    if (!action) {
      return res.status(404).json({ 
        success: false, 
        error: 'Action not found or not assigned to you' 
      });
    }

    // Delete the action
    await Action.findByIdAndDelete(actionId);

    res.json({
      success: true,
      message: 'Action deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting action:', error);
    next(error);
  }
}

