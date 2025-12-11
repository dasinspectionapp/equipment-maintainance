import { useState, useEffect, useRef } from 'react';
import AutocompleteInput from '../components/AutocompleteInput';
import { API_BASE } from '../utils/api';

interface VideoModalProps {
  videoUrl: string;
  onClose: () => void;
}

interface PdfModalProps {
  pdfData: string;
  onClose: () => void;
}

interface InspectionData {
  siteCode: string;
  circle: string;
  division: string;
  subDivision: string;
  om: string;
  dateOfCommission: string;
  feederNumberAndName: string;
  inspectionDate: string;
  rmuMakeType: string;
  locationHRN: string;
  serialNo: string;
  latLong: string;
  warrantyStatus: string;
  coFeederName: string;
  previousAMCDate: string;
  mfmMake: string;
  relayMakeModelNo: string;
  fpiMakeModelNo: string;
  rtuMakeSlno: string;
  rmuStatus: string;
  availability24V: string;
  ptVoltageAvailability: string;
  batteryChargerCondition: string;
  earthingConnection: string;
  commAccessoriesAvailability: string;
  relayGroupChange: string;
  fpiStatus: string;
  availability12V: string;
  overallWiringIssue: string;
  controlCard: string;
  beddingCondition: string;
  batteryStatus: string;
  relayGroupChangeUpdate: string;
  availability230V: string;
  sf6Gas: string;
  rmuLocationSameAsGIS: string;
  doorHydraulics: string;
  controlCabinetDoor: string;
  doorGasket: string;
  dummyLatchCommand: string;
  terminals: any;
  remarks: string;
  images: string[];
  video: string;
  pdfFile: string;
}

export default function EquipmentStatus() {
  const [siteCode, setSiteCode] = useState('');
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Handle ESC key and arrow keys for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (videoModalOpen) {
          setVideoModalOpen(false);
        }
        if (pdfModalOpen) {
          setPdfModalOpen(false);
        }
        if (selectedImageIndex !== null) {
          setSelectedImageIndex(null);
        }
      }
      
      // Arrow key navigation for images
      if (selectedImageIndex !== null && inspectionData?.images) {
        if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
          setSelectedImageIndex(selectedImageIndex - 1);
        } else if (e.key === 'ArrowRight' && selectedImageIndex < inspectionData.images.length - 1) {
          setSelectedImageIndex(selectedImageIndex + 1);
        }
      }
    };

    if (videoModalOpen || pdfModalOpen || selectedImageIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [videoModalOpen, pdfModalOpen, selectedImageIndex, inspectionData]);

  const handleSearch = async () => {
    if (!siteCode.trim()) {
      setError('Please enter a Site Code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInspectionData(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }

      const response = await fetch(`${API_BASE}/api/inspection/sitecode/${encodeURIComponent(siteCode)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No inspection found for this Site Code');
        }
        throw new Error(data.error || 'Failed to load inspection data');
      }

      if (data.success && data.data) {
        setInspectionData(data.data);
      }
    } catch (error: any) {
      console.error('Load inspection error:', error);
      setError(error.message || 'Failed to load inspection data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString || dateString === '' || dateString === 'N/A') return null;
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const downloadPDF = () => {
    if (!inspectionData) return;

    // Create a printable version of the inspection report
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const terminalKeys = ['od1', 'od2', 'vl1', 'vl2', 'vl3'];
    const terminalFields = [
      { label: 'Cables Connected', key: 'cablesConnected' },
      { label: 'Connected To', key: 'connectedTo' },
      { label: 'Load Amps (R)', key: 'loadAmpsR' },
      { label: 'Load Amps (Y)', key: 'loadAmpsY' },
      { label: 'Load Amps (B)', key: 'loadAmpsB' },
      { label: 'Switch Position', key: 'switchPosition' },
      { label: 'ON/OFF Motors', key: 'onOffMotors' },
      { label: 'Healthiness Switch', key: 'healthinessSwitch' },
      { label: 'Breaker Status', key: 'breakerStatus' },
      { label: 'Cable Entry Doors', key: 'cableEntryDoors' },
      { label: 'Cable Clamped', key: 'cableClamped' },
      { label: 'Local/Remote Switch', key: 'localRemoteSwitch' },
      { label: 'VPIS Indication', key: 'vpisIndication' },
      { label: 'MFM Working', key: 'mfmWorking' },
      { label: 'Relay Working', key: 'relayWorking' },
      { label: 'RMU Side 24 Pin', key: 'rmuSide24Pin' },
      { label: 'Cable Size', key: 'cableSize' },
      { label: 'Electrical Operation', key: 'electricalOperation' },
      { label: 'Remote Operation', key: 'remoteOperation' }
    ];

    // Helper function to check if value exists
    const hasValue = (val: any) => val && val.toString().trim() !== '' && val !== 'N/A';
    
    let terminalTables = '';
    terminalKeys.forEach(prefix => {
      const terminalData = inspectionData.terminals?.[prefix];
      if (terminalData) {
        const validFields = terminalFields.filter(field => hasValue(terminalData[field.key]));
        if (validFields.length > 0) {
          terminalTables += `
            <h3 style="margin-top: 20px; color: #1e40af;">${prefix.toUpperCase()} Terminal Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          `;
          validFields.forEach(field => {
            const value = terminalData[field.key];
            terminalTables += `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; width: 40%; font-weight: bold; background-color: #f3f4f6;">${field.label}</td>
                <td style="padding: 8px; border: 1px solid #ddd; width: 60%;">${value}</td>
              </tr>
            `;
          });
          terminalTables += `</table>`;
        }
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>RMU Inspection Report - ${inspectionData.siteCode}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
          .header h1 { color: #1e40af; margin: 0; }
          .section { margin-bottom: 25px; }
          .section-title { background-color: #1e40af; color: white; padding: 10px; font-weight: bold; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .label { font-weight: bold; color: #374151; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>RMU INSPECTION REPORT</h1>
          <p>BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED</p>
          <p style="font-size: 12px;">O/o. The General Manager (Ele.), DAS & Smart Grid, BESCOM, BICC-1 Bldg, 2nd Sector, 24th Main, 17th Cross, HSR layout, Bangalore – 560102</p>
        </div>

        ${(hasValue(inspectionData.siteCode) || hasValue(inspectionData.circle) || hasValue(inspectionData.division) || 
           hasValue(inspectionData.subDivision) || hasValue(inspectionData.om) || formatDate(inspectionData.dateOfCommission) || 
           hasValue(inspectionData.feederNumberAndName) || formatDate(inspectionData.inspectionDate) || 
           hasValue(inspectionData.rmuMakeType) || hasValue(inspectionData.locationHRN) || hasValue(inspectionData.serialNo) || 
           hasValue(inspectionData.latLong) || hasValue(inspectionData.warrantyStatus) || hasValue(inspectionData.coFeederName)) ? `
        <div class="section">
          <div class="section-title">Basic Information</div>
          <table>
            ${(() => {
              const rows = [];
              const basicFields = [
                { label: 'Site Code', value: inspectionData.siteCode },
                { label: 'Circle', value: inspectionData.circle },
                { label: 'Division', value: inspectionData.division },
                { label: 'Sub-Division', value: inspectionData.subDivision },
                { label: 'O&M', value: inspectionData.om },
                { label: 'Date of Commission', value: formatDate(inspectionData.dateOfCommission) },
                { label: 'Feeder Number & Name', value: inspectionData.feederNumberAndName },
                { label: 'Inspection Date', value: formatDate(inspectionData.inspectionDate) },
                { label: 'RMU Make/Type', value: inspectionData.rmuMakeType },
                { label: 'Location/HRN', value: inspectionData.locationHRN },
                { label: 'Serial No', value: inspectionData.serialNo },
                { label: 'Lat & Long', value: inspectionData.latLong },
                { label: 'Warranty Status', value: inspectionData.warrantyStatus },
                { label: 'C/o Feeder Name', value: inspectionData.coFeederName }
              ].filter(f => hasValue(f.value));
              
              for (let i = 0; i < basicFields.length; i += 2) {
                const field1 = basicFields[i];
                const field2 = basicFields[i + 1];
                if (field2) {
                  rows.push(`<tr><td class="label">${field1.label}</td><td>${field1.value}</td><td class="label">${field2.label}</td><td>${field2.value}</td></tr>`);
                } else {
                  rows.push(`<tr><td class="label">${field1.label}</td><td colspan="3">${field1.value}</td></tr>`);
                }
              }
              return rows.join('');
            })()}
          </table>
        </div>
        ` : ''}

        ${(formatDate(inspectionData.previousAMCDate) || hasValue(inspectionData.mfmMake) || hasValue(inspectionData.relayMakeModelNo) || 
           hasValue(inspectionData.fpiMakeModelNo) || hasValue(inspectionData.rtuMakeSlno)) ? `
        <div class="section">
          <div class="section-title">Additional Details</div>
          <table>
            ${(() => {
              const rows = [];
              const additionalFields = [
                { label: 'Previous AMC Date', value: formatDate(inspectionData.previousAMCDate) },
                { label: 'MFM Make', value: inspectionData.mfmMake },
                { label: 'Relay Make & Model No', value: inspectionData.relayMakeModelNo },
                { label: 'FPI Make & Model No', value: inspectionData.fpiMakeModelNo },
                { label: 'RTU Make & Slno', value: inspectionData.rtuMakeSlno }
              ].filter(f => hasValue(f.value));
              
              for (let i = 0; i < additionalFields.length; i += 2) {
                const field1 = additionalFields[i];
                const field2 = additionalFields[i + 1];
                if (field2) {
                  rows.push(`<tr><td class="label">${field1.label}</td><td>${field1.value}</td><td class="label">${field2.label}</td><td>${field2.value}</td></tr>`);
                } else {
                  rows.push(`<tr><td class="label">${field1.label}</td><td colspan="3">${field1.value}</td></tr>`);
                }
              }
              return rows.join('');
            })()}
          </table>
        </div>
        ` : ''}

        ${(hasValue(inspectionData.rmuStatus) || hasValue(inspectionData.availability24V) || hasValue(inspectionData.ptVoltageAvailability) || 
           hasValue(inspectionData.batteryChargerCondition) || hasValue(inspectionData.earthingConnection) || hasValue(inspectionData.commAccessoriesAvailability) || 
           hasValue(inspectionData.relayGroupChange) || hasValue(inspectionData.fpiStatus) || hasValue(inspectionData.availability12V) || 
           hasValue(inspectionData.overallWiringIssue) || hasValue(inspectionData.controlCard) || hasValue(inspectionData.beddingCondition) || 
           hasValue(inspectionData.batteryStatus) || hasValue(inspectionData.relayGroupChangeUpdate) || hasValue(inspectionData.availability230V) || 
           hasValue(inspectionData.sf6Gas) || hasValue(inspectionData.rmuLocationSameAsGIS) || hasValue(inspectionData.doorHydraulics) || 
           hasValue(inspectionData.controlCabinetDoor) || hasValue(inspectionData.doorGasket) || hasValue(inspectionData.dummyLatchCommand)) ? `
        <div class="section">
          <div class="section-title">RMU Status & Conditions</div>
          <table>
            ${(() => {
              const rows = [];
              const statusFields = [
                { label: 'RMU Status', value: inspectionData.rmuStatus },
                { label: '24V Availability', value: inspectionData.availability24V },
                { label: 'PT Voltage (110V) Availability', value: inspectionData.ptVoltageAvailability },
                { label: 'Battery Charger Condition', value: inspectionData.batteryChargerCondition },
                { label: 'Earthing Connection', value: inspectionData.earthingConnection },
                { label: 'Comm. Accessories Availability', value: inspectionData.commAccessoriesAvailability },
                { label: 'Relay Group Change', value: inspectionData.relayGroupChange, fullWidth: true },
                { label: 'FPI Status', value: inspectionData.fpiStatus },
                { label: '12V Availability', value: inspectionData.availability12V },
                { label: 'Overall Wiring Issue', value: inspectionData.overallWiringIssue },
                { label: 'Control Card', value: inspectionData.controlCard },
                { label: 'Bedding Condition', value: inspectionData.beddingCondition },
                { label: 'Battery Status', value: inspectionData.batteryStatus },
                { label: 'Relay Group Change Update', value: inspectionData.relayGroupChangeUpdate, fullWidth: true },
                { label: '230V Availability', value: inspectionData.availability230V },
                { label: 'SF6 Gas', value: inspectionData.sf6Gas },
                { label: 'RMU Location Same as GIS', value: inspectionData.rmuLocationSameAsGIS },
                { label: 'Door Hydraulics', value: inspectionData.doorHydraulics },
                { label: 'Control Cabinet Door', value: inspectionData.controlCabinetDoor },
                { label: 'Door Gasket', value: inspectionData.doorGasket },
                { label: 'Dummy Latch Command', value: inspectionData.dummyLatchCommand, fullWidth: true }
              ].filter(f => hasValue(f.value));
              
              for (let i = 0; i < statusFields.length; i++) {
                const field = statusFields[i];
                if (field.fullWidth) {
                  rows.push(`<tr><td class="label">${field.label}</td><td colspan="3">${field.value}</td></tr>`);
                } else {
                  const field2 = statusFields[i + 1];
                  if (field2 && !field2.fullWidth) {
                    rows.push(`<tr><td class="label">${field.label}</td><td>${field.value}</td><td class="label">${field2.label}</td><td>${field2.value}</td></tr>`);
                    i++; // Skip next field as we used it
                  } else {
                    rows.push(`<tr><td class="label">${field.label}</td><td colspan="3">${field.value}</td></tr>`);
                  }
                }
              }
              return rows.join('');
            })()}
          </table>
        </div>
        ` : ''}

        ${terminalTables}

        ${hasValue(inspectionData.remarks) ? `
        <div class="section">
          <div class="section-title">Additional Information</div>
          <table>
            ${hasValue(inspectionData.remarks) ? `<tr><td class="label">Remarks/Issues</td><td colspan="3" style="height: 80px; vertical-align: top;">${inspectionData.remarks}</td></tr>` : ''}
          </table>
        </div>
        ` : ''}

        ${inspectionData.images && inspectionData.images.length > 0 ? `
        <div class="section">
          <div class="section-title">Images (${inspectionData.images.length})</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">
            ${inspectionData.images.map((img, idx) => {
              const imgSrc = img.startsWith('data:') || img.startsWith('blob:') || img.startsWith('http') 
                ? img 
                : `data:image/jpeg;base64,${img}`;
              return `<img src="${imgSrc}" alt="Image ${idx + 1}" style="width: 100%; height: 200px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px;" />`;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${inspectionData.video ? `
        <div class="section">
          <div class="section-title">Video Recording</div>
          <p>Video recording is available in the system. Please view it in the web application.</p>
        </div>
        ` : ''}

        ${inspectionData.pdfFile ? `
        <div class="section">
          <div class="section-title">Hard Copy PDF</div>
          <p>Hard copy PDF is available in the system</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          <p>BESCOM - Distribution Automation System</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Equipment Status</h1>
          <p className="text-gray-600">Search and view RMU Inspection Reports by Site Code</p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Site Code
              </label>
              <AutocompleteInput
                name="siteCode"
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value)}
                onSuggestionSelected={() => {
                  // Auto-search when a suggestion is selected
                  setTimeout(() => {
                    handleSearch();
                  }, 100);
                }}
                fieldName="siteCode"
                placeholder="Enter Site Code to search..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-8 py-3 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg min-w-[140px] whitespace-nowrap"
              style={{ 
                backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                minHeight: '48px'
              }}
            >
              {isLoading ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border-2 border-red-300 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {inspectionData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b-2 border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                Inspection Report - {inspectionData.siteCode}
              </h2>
              <button
                onClick={downloadPDF}
                className="px-8 py-4 bg-green-600 text-white font-bold text-lg rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors shadow-lg flex items-center justify-center gap-3 min-w-[200px] whitespace-nowrap"
                style={{ 
                  backgroundColor: '#16a34a',
                  minHeight: '56px'
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                📥 Download PDF
              </button>
            </div>

            {/* Basic Information */}
            {(inspectionData.siteCode || inspectionData.circle || inspectionData.division || inspectionData.subDivision || 
              inspectionData.om || inspectionData.dateOfCommission || inspectionData.feederNumberAndName || 
              inspectionData.inspectionDate || inspectionData.rmuMakeType || inspectionData.locationHRN || 
              inspectionData.serialNo || inspectionData.latLong || inspectionData.warrantyStatus || inspectionData.coFeederName) && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  1. Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoCard label="Site Code" value={inspectionData.siteCode} />
                  <InfoCard label="Circle" value={inspectionData.circle} />
                  <InfoCard label="Division" value={inspectionData.division} />
                  <InfoCard label="Sub-Division" value={inspectionData.subDivision} />
                  <InfoCard label="O&M" value={inspectionData.om} />
                  <InfoCard label="Date of Commission" value={formatDate(inspectionData.dateOfCommission)} />
                  <InfoCard label="Feeder Number & Name" value={inspectionData.feederNumberAndName} />
                  <InfoCard label="Inspection Date" value={formatDate(inspectionData.inspectionDate)} />
                  <InfoCard label="RMU Make/Type" value={inspectionData.rmuMakeType} />
                  <InfoCard label="Location/HRN" value={inspectionData.locationHRN} />
                  <InfoCard label="Serial No" value={inspectionData.serialNo} />
                  <InfoCard label="Lat & Long" value={inspectionData.latLong} />
                  <InfoCard label="Warranty Status" value={inspectionData.warrantyStatus} />
                  <InfoCard label="C/o Feeder Name" value={inspectionData.coFeederName} />
                </div>
              </div>
            )}

            {/* Additional Details */}
            {(inspectionData.previousAMCDate || inspectionData.mfmMake || inspectionData.relayMakeModelNo || 
              inspectionData.fpiMakeModelNo || inspectionData.rtuMakeSlno) && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  2. Additional Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoCard label="Previous AMC Date" value={formatDate(inspectionData.previousAMCDate)} />
                  <InfoCard label="MFM Make" value={inspectionData.mfmMake} />
                  <InfoCard label="Relay Make & Model No" value={inspectionData.relayMakeModelNo} />
                  <InfoCard label="FPI Make & Model No" value={inspectionData.fpiMakeModelNo} />
                  <InfoCard label="RTU Make & Slno" value={inspectionData.rtuMakeSlno} />
                </div>
              </div>
            )}

            {/* RMU Status & Conditions */}
            {(inspectionData.rmuStatus || inspectionData.availability24V || inspectionData.ptVoltageAvailability || 
              inspectionData.batteryChargerCondition || inspectionData.earthingConnection || inspectionData.commAccessoriesAvailability || 
              inspectionData.relayGroupChange || inspectionData.fpiStatus || inspectionData.availability12V || 
              inspectionData.overallWiringIssue || inspectionData.controlCard || inspectionData.beddingCondition || 
              inspectionData.batteryStatus || inspectionData.relayGroupChangeUpdate || inspectionData.availability230V || 
              inspectionData.sf6Gas || inspectionData.rmuLocationSameAsGIS || inspectionData.doorHydraulics || 
              inspectionData.controlCabinetDoor || inspectionData.doorGasket || inspectionData.dummyLatchCommand) && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  3. RMU Status & Conditions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoCard label="RMU Status" value={inspectionData.rmuStatus} />
                  <InfoCard label="24V Availability" value={inspectionData.availability24V} />
                  <InfoCard label="PT Voltage (110V) Availability" value={inspectionData.ptVoltageAvailability} />
                  <InfoCard label="Battery Charger Condition" value={inspectionData.batteryChargerCondition} />
                  <InfoCard label="Earthing Connection" value={inspectionData.earthingConnection} />
                  <InfoCard label="Comm. Accessories Availability" value={inspectionData.commAccessoriesAvailability} />
                  <InfoCard label="Relay Group Change" value={inspectionData.relayGroupChange} />
                  <InfoCard label="FPI Status" value={inspectionData.fpiStatus} />
                  <InfoCard label="12V Availability" value={inspectionData.availability12V} />
                  <InfoCard label="Overall Wiring Issue" value={inspectionData.overallWiringIssue} />
                  <InfoCard label="Control Card" value={inspectionData.controlCard} />
                  <InfoCard label="Bedding Condition" value={inspectionData.beddingCondition} />
                  <InfoCard label="Battery Status" value={inspectionData.batteryStatus} />
                  <InfoCard label="Relay Group Change Update" value={inspectionData.relayGroupChangeUpdate} />
                  <InfoCard label="230V Availability" value={inspectionData.availability230V} />
                  <InfoCard label="SF6 Gas" value={inspectionData.sf6Gas} />
                  <InfoCard label="RMU Location Same as GIS" value={inspectionData.rmuLocationSameAsGIS} />
                  <InfoCard label="Door Hydraulics" value={inspectionData.doorHydraulics} />
                  <InfoCard label="Control Cabinet Door" value={inspectionData.controlCabinetDoor} />
                  <InfoCard label="Door Gasket" value={inspectionData.doorGasket} />
                  <InfoCard label="Dummy Latch Command" value={inspectionData.dummyLatchCommand} />
                </div>
              </div>
            )}

            {/* Terminal Details - Table Format (Fields 21-61) */}
            {inspectionData.terminals && Object.keys(inspectionData.terminals).length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  4. Terminal Details (Fields 21-61)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white shadow-sm border-2 border-gray-400">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr className="bg-gray-100">
                        <th className="border-2 border-gray-400 px-4 py-3 text-left font-semibold text-sm" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>Parameter</th>
                        <th className="border-2 border-gray-400 px-4 py-3 text-center font-semibold text-sm" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>OD1</th>
                        <th className="border-2 border-gray-400 px-4 py-3 text-center font-semibold text-sm" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>OD2</th>
                        <th className="border-2 border-gray-400 px-4 py-3 text-center font-semibold text-sm" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>VL1</th>
                        <th className="border-2 border-gray-400 px-4 py-3 text-center font-semibold text-sm" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>VL2</th>
                        <th className="border-2 border-gray-400 px-4 py-3 text-center font-semibold text-sm" style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>VL3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Cables Connected', key: 'cablesConnected' },
                        { label: 'Connected To', key: 'connectedTo' },
                        { label: 'Load Amps (R)', key: 'loadAmpsR' },
                        { label: 'Load Amps (Y)', key: 'loadAmpsY' },
                        { label: 'Load Amps (B)', key: 'loadAmpsB' },
                        { label: 'Switch Position', key: 'switchPosition' },
                        { label: 'ON/OFF Motors', key: 'onOffMotors' },
                        { label: 'Healthiness Switch', key: 'healthinessSwitch' },
                        { label: 'Breaker Status', key: 'breakerStatus' },
                        { label: 'Cable Entry Doors', key: 'cableEntryDoors' },
                        { label: 'Cable Clamped', key: 'cableClamped' },
                        { label: 'Local/Remote Switch', key: 'localRemoteSwitch' },
                        { label: 'VPIS Indication', key: 'vpisIndication' },
                        { label: 'MFM Working', key: 'mfmWorking' },
                        { label: 'Relay Working', key: 'relayWorking' },
                        { label: 'RMU Side 24 Pin', key: 'rmuSide24Pin' },
                        { label: 'Cable Size', key: 'cableSize' },
                        { label: 'Electrical Operation', key: 'electricalOperation' },
                        { label: 'Remote Operation', key: 'remoteOperation' },
                        { label: 'Cable IC From or OG To', key: 'cableICFromOrOGTo' }
                      ].map((field) => {
                        const terminalKeys = ['od1', 'od2', 'vl1', 'vl2', 'vl3'];
                        const hasAnyValue = terminalKeys.some(prefix => {
                          const terminalData = inspectionData.terminals[prefix];
                          const value = terminalData?.[field.key];
                          return value && value.toString().trim() !== '' && value !== 'N/A';
                        });

                        // Only show rows that have at least one value
                        if (!hasAnyValue) return null;

                        return (
                          <tr key={field.key} className="hover:bg-gray-50">
                            <td className="border-2 border-gray-400 px-4 py-2 font-medium text-sm bg-gray-50">{field.label}</td>
                            {terminalKeys.map(prefix => {
                              const terminalData = inspectionData.terminals[prefix];
                              const value = terminalData?.[field.key];
                              const displayValue = value && value.toString().trim() !== '' && value !== 'N/A' ? value : '';
                              return (
                                <td key={prefix} className="border-2 border-gray-400 px-4 py-2 text-center text-sm">
                                  {displayValue}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Additional Information */}
            {inspectionData.remarks && inspectionData.remarks.trim() !== '' && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  5. Additional Information
                </h3>
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Remarks/Issues</label>
                    <p className="text-gray-800 whitespace-pre-wrap">{inspectionData.remarks}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Attachments - Images */}
            {inspectionData.images && inspectionData.images.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  6. Images ({inspectionData.images.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {inspectionData.images.map((image, index) => {
                    // Handle base64 images or blob URLs
                    const imageSrc = image.startsWith('data:') || image.startsWith('blob:') 
                      ? image 
                      : image.startsWith('http') 
                        ? image 
                        : `data:image/jpeg;base64,${image}`;
                    
                    return (
                      <div 
                        key={index} 
                        className="relative group cursor-pointer bg-gray-100 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                        onClick={() => setSelectedImageIndex(index)}
                      >
                        <img
                          src={imageSrc}
                          alt={`Inspection Image ${index + 1}`}
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            console.error('Error loading image:', image.substring(0, 50));
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage%3C/text%3E%3C/svg%3E';
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-sm">
                            Click to view
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                          Image {index + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments - Video */}
            {inspectionData.video && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  7. Video Recording
                </h3>
                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">Video Recording Available</p>
                      <p className="text-sm text-gray-600">Play in browser or download the video file</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setVideoModalOpen(true)}
                        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                        Play Video
                      </button>
                      <VideoDownloadLink videoData={inspectionData.video} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attachments - PDF */}
            {inspectionData.pdfFile && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-blue-700 mb-4 pb-2 border-b-2 border-blue-700">
                  8. Hard Copy PDF
                </h3>
                <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-700 mb-1">PDF File Available</p>
                      <p className="text-sm text-gray-600">View in browser or download the PDF file</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setPdfModalOpen(true)}
                        className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-lg flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View PDF
                      </button>
                      <PdfDownloadLink pdfData={inspectionData.pdfFile} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image Modal */}
            {selectedImageIndex !== null && inspectionData.images && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedImageIndex(null)}
              >
                <div className="relative max-w-7xl max-h-full">
                  <button
                    onClick={() => setSelectedImageIndex(null)}
                    className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 z-10"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <img
                    src={inspectionData.images[selectedImageIndex].startsWith('data:') || inspectionData.images[selectedImageIndex].startsWith('blob:')
                      ? inspectionData.images[selectedImageIndex]
                      : inspectionData.images[selectedImageIndex].startsWith('http')
                        ? inspectionData.images[selectedImageIndex]
                        : `data:image/jpeg;base64,${inspectionData.images[selectedImageIndex]}`}
                    alt={`Inspection Image ${selectedImageIndex + 1}`}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg">
                    Image {selectedImageIndex + 1} of {inspectionData.images.length}
                  </div>
                  {selectedImageIndex > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(selectedImageIndex - 1);
                      }}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {selectedImageIndex < inspectionData.images.length - 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(selectedImageIndex + 1);
                      }}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Video Modal */}
            {videoModalOpen && inspectionData.video && (
              <VideoModal
                videoUrl={inspectionData.video}
                onClose={() => setVideoModalOpen(false)}
              />
            )}

            {/* PDF Modal */}
            {pdfModalOpen && inspectionData.pdfFile && (
              <PdfModal
                pdfData={inspectionData.pdfFile}
                onClose={() => setPdfModalOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, fullWidth }: { label: string; value: string | null | undefined; fullWidth?: boolean }) {
  // Only render if value exists and is not empty
  if (!value || value.trim() === '' || value === 'N/A') {
    return null;
  }
  
  return (
    <div className={`bg-gray-50 p-4 rounded-lg ${fullWidth ? 'col-span-2' : ''}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <p className="text-gray-800 font-semibold">{value}</p>
    </div>
  );
}

function VideoDownloadLink({ videoData }: { videoData: string }) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const processVideo = async () => {
      if (!videoData) return;

      setIsProcessing(true);
      try {
        let base64Data = '';
        let mimeType = 'video/webm';

        if (videoData.startsWith('data:')) {
          const parts = videoData.split(',');
          if (parts.length === 2) {
            const mimeMatch = parts[0].match(/data:([^;]+)/);
            if (mimeMatch) {
              mimeType = mimeMatch[1];
            }
            base64Data = parts[1];
          }
        } else if (videoData.includes('base64,')) {
          const parts = videoData.split('base64,');
          if (parts.length === 2) {
            base64Data = parts[1];
          }
        } else if (videoData.startsWith('blob:') || videoData.startsWith('http')) {
          // Use blob or HTTP URL directly
          setDownloadUrl(videoData);
          setIsProcessing(false);
          return;
        } else {
          base64Data = videoData;
        }

        const cleanBase64 = base64Data.trim().replace(/\s/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setDownloadUrl(blobUrl);
      } catch (error) {
        console.error('Error processing video for download:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    processVideo();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [videoData]);

  if (isProcessing) {
    return (
      <button
        disabled
        className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed flex items-center gap-2 opacity-50"
      >
        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Processing...
      </button>
    );
  }

  if (!downloadUrl) return null;

  return (
    <a
      href={downloadUrl}
      download={`inspection-video-${Date.now()}.webm`}
      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Download Video
    </a>
  );
}

function PdfDownloadLink({ pdfData }: { pdfData: string }) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const processPdf = async () => {
      if (!pdfData) return;

      setIsProcessing(true);
      try {
        let base64Data = '';

        if (pdfData.startsWith('data:')) {
          const parts = pdfData.split(',');
          if (parts.length === 2) {
            base64Data = parts[1];
          }
        } else if (pdfData.includes('base64,')) {
          const parts = pdfData.split('base64,');
          if (parts.length === 2) {
            base64Data = parts[1];
          }
        } else if (pdfData.startsWith('http://') || pdfData.startsWith('https://')) {
          setDownloadUrl(pdfData);
          setIsProcessing(false);
          return;
        } else {
          base64Data = pdfData;
        }

        const cleanBase64 = base64Data.trim().replace(/\s/g, '');
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setDownloadUrl(blobUrl);
      } catch (error) {
        console.error('Error processing PDF for download:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    processPdf();

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pdfData]);

  if (isProcessing) {
    return (
      <button
        disabled
        className="px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed flex items-center gap-2 opacity-50"
      >
        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Processing...
      </button>
    );
  }

  if (!downloadUrl) return null;

  return (
    <a
      href={downloadUrl}
      download={`inspection-report-${Date.now()}.pdf`}
      className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-lg flex items-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Download PDF
    </a>
  );
}

function PdfModal({ pdfData, onClose }: PdfModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const processPdf = async () => {
      if (!pdfData || pdfData.trim() === '') {
        setPdfError('No PDF data available');
        return;
      }

      try {
        let pdfSource = '';
        
        // If it's already a data URL, use it directly
        if (pdfData.startsWith('data:')) {
          pdfSource = pdfData;
          setPdfUrl(pdfSource);
          return;
        }
        
        // If it's an HTTP URL, use it as is
        if (pdfData.startsWith('http://') || pdfData.startsWith('https://')) {
          pdfSource = pdfData;
          setPdfUrl(pdfSource);
          return;
        }

        // Handle base64 PDF data
        let base64Data = '';
        
        if (pdfData.includes('base64,')) {
          // Extract base64 from data URL
          const parts = pdfData.split('base64,');
          if (parts.length === 2) {
            base64Data = parts[1];
          }
        } else {
          // Assume it's raw base64
          base64Data = pdfData;
        }

        // Clean base64 string
        const cleanBase64 = base64Data.trim().replace(/\s/g, '');

        // Convert base64 to blob and create blob URL
        try {
          const binaryString = atob(cleanBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          pdfSource = blobUrl;
          setPdfUrl(pdfSource);
        } catch (blobError: any) {
          console.error('Error creating PDF blob:', blobError);
          // Fallback to data URL
          pdfSource = `data:application/pdf;base64,${cleanBase64}`;
          setPdfUrl(pdfSource);
        }
      } catch (error: any) {
        console.error('Error processing PDF:', error);
        setPdfError('Failed to process PDF data. The PDF file may be corrupted.');
      }
    };

    processPdf();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pdfData]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-6xl w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
          {pdfError ? (
            <div className="p-8 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-800 text-lg font-semibold mb-2">PDF Viewing Error</p>
              <p className="text-red-600 text-sm mb-4">{pdfError}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Close
              </button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full"
              style={{ height: '90vh', minHeight: '600px' }}
              title="PDF Preview"
            />
          ) : (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mb-4"></div>
              <p className="text-gray-800 text-sm">Loading PDF...</p>
            </div>
          )}
        </div>
        
        {!pdfError && pdfUrl && (
          <div className="mt-4 text-center">
            <p className="text-white text-sm">Click outside the PDF or press ESC to close</p>
            <a
              href={pdfUrl}
              download="inspection-report.pdf"
              className="mt-2 inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Download PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoModal({ videoUrl, onClose }: VideoModalProps) {
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Convert base64 to blob URL for better browser compatibility
  useEffect(() => {
    const processVideo = async () => {
      if (!videoUrl || videoUrl.trim() === '') {
        setVideoError('No video data available');
        setIsLoading(false);
        return;
      }

      try {
        let finalVideoSrc = '';
        
        // If it's already a blob URL, use it directly
        if (videoUrl.startsWith('blob:')) {
          finalVideoSrc = videoUrl;
          setVideoSrc(finalVideoSrc);
          return;
        }
        
        // If it's an HTTP URL, use it as is
        if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
          finalVideoSrc = videoUrl;
          setVideoSrc(finalVideoSrc);
          return;
        }

        // Handle data URLs or base64
        let base64Data = '';
        let mimeType = 'video/webm'; // Default to webm

        if (videoUrl.startsWith('data:')) {
          // Extract mime type and base64 data from data URL
          const parts = videoUrl.split(',');
          if (parts.length === 2) {
            const mimeMatch = parts[0].match(/data:([^;]+)/);
            if (mimeMatch) {
              mimeType = mimeMatch[1];
            }
            base64Data = parts[1];
          } else {
            base64Data = videoUrl;
          }
        } else if (videoUrl.includes('base64,')) {
          // Has base64 prefix but not data: prefix
          const parts = videoUrl.split('base64,');
          if (parts.length === 2) {
            const mimeMatch = parts[0].match(/([^;]+)/);
            if (mimeMatch) {
              mimeType = mimeMatch[1].trim();
            }
            base64Data = parts[1];
          }
        } else {
          // Raw base64 - will detect format after cleaning
          base64Data = videoUrl;
          // Default to webm for MediaRecorder, will be detected from bytes
          mimeType = 'video/webm';
        }

        // Clean base64 string first
        let cleanBase64 = base64Data.trim().replace(/\s/g, '');
        
        // Now try to detect format from raw base64 if we didn't already set it
        if (mimeType === 'video/webm' && !videoUrl.startsWith('data:') && !videoUrl.includes('base64,')) {
          // Try to detect video format from magic bytes (first few decoded bytes)
          try {
            const sample = cleanBase64.substring(0, Math.min(100, cleanBase64.length));
            const binarySample = atob(sample);
            const bytes = new Uint8Array(binarySample.length);
            for (let i = 0; i < binarySample.length; i++) {
              bytes[i] = binarySample.charCodeAt(i);
            }
            
            // Check for WebM (starts with 0x1A 0x45 0xDF 0xA3)
            if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
              mimeType = 'video/webm';
            }
            // Check for MP4 (starts with various ftyp boxes)
            else if ((bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) ||
                     (bytes.length >= 8 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x00 && bytes[3] === 0x20 && 
                      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)) {
              mimeType = 'video/mp4';
            }
            // Default to webm for MediaRecorder
            else {
              mimeType = 'video/webm';
            }
          } catch {
            // If detection fails, default to webm
            mimeType = 'video/webm';
          }
        }

        // Convert base64 to blob and create blob URL (more compatible than data URLs for videos)
        try {
          const binaryString = atob(cleanBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Create blob with detected or default mime type
          const blob = new Blob([bytes], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          finalVideoSrc = blobUrl;
          
          console.log('Video blob created with type:', mimeType);
          setVideoSrc(finalVideoSrc);
        } catch (blobError: any) {
          console.error('Error creating blob:', blobError);
          console.error('Base64 length:', cleanBase64.length);
          
          // If it's an invalid base64 error, try to fix it
          if (blobError.message && blobError.message.includes('base64')) {
            // Try removing invalid characters
            const fixedBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '');
            try {
              const binaryString = atob(fixedBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: mimeType });
              const blobUrl = URL.createObjectURL(blob);
              blobUrlRef.current = blobUrl;
              finalVideoSrc = blobUrl;
              setVideoSrc(finalVideoSrc);
              return;
            } catch (retryError) {
              console.error('Retry failed:', retryError);
            }
          }
          
          // Final fallback to data URL if blob creation fails
          finalVideoSrc = `data:${mimeType};base64,${cleanBase64}`;
          setVideoSrc(finalVideoSrc);
        }
      } catch (error: any) {
        console.error('Error processing video:', error);
        setVideoError('Failed to process video data. The video file may be corrupted.');
        setIsLoading(false);
      }
    };

    processVideo();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [videoUrl]);

  const handleVideoLoad = () => {
    setIsLoading(false);
    setVideoError(null);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    setIsLoading(false);
    const video = e.currentTarget;
    console.error('Video error:', video.error);
    
    let errorMessage = 'Error loading video. ';
    if (video.error) {
      switch (video.error.code) {
        case video.error.MEDIA_ERR_ABORTED:
          errorMessage += 'The video playback was aborted.';
          break;
        case video.error.MEDIA_ERR_NETWORK:
          errorMessage += 'A network error occurred while loading the video.';
          break;
        case video.error.MEDIA_ERR_DECODE:
          errorMessage += 'The video could not be decoded or is in an unsupported format.';
          break;
        case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage += 'The video format is not supported by your browser.';
          break;
        default:
          errorMessage += 'The video file may be corrupted or in an unsupported format.';
      }
    } else {
      errorMessage += 'The video file may be corrupted or in an unsupported format.';
    }
    
    setVideoError(errorMessage);
  };

  const handleVideoCanPlay = () => {
    setIsLoading(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-6xl w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="bg-black rounded-lg overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <p className="text-white text-sm">Loading video...</p>
              </div>
            </div>
          )}
          
          {videoError ? (
            <div className="p-8 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-white text-lg font-semibold mb-2">Video Playback Error</p>
              <p className="text-red-300 text-sm mb-4">{videoError}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Close
              </button>
            </div>
          ) : videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              autoPlay
              preload="metadata"
              playsInline
              className="w-full max-h-[90vh]"
              style={{ maxHeight: '90vh' }}
              onLoadedMetadata={handleVideoLoad}
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
              onLoadStart={() => setIsLoading(true)}
            >
              <source src={videoSrc} type="video/webm" />
              <source src={videoSrc} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
              <p className="text-white text-sm">Preparing video...</p>
            </div>
          )}
        </div>
        
        {!videoError && (
          <div className="mt-4 text-center">
            <p className="text-white text-sm">Click outside the video or press ESC to close</p>
          </div>
        )}
      </div>
    </div>
  );
}

