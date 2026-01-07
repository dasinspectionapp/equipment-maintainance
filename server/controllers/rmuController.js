import ExcelJS from 'exceljs';
import RMUMaster from '../models/RMUMaster.js';
import AgencyMaster from '../models/AgencyMaster.js';
import { v4 as uuidv4 } from 'uuid';

// Circle-Division mapping for validation
const CIRCLE_DIVISIONS = {
  'NORTH': ['HEBBAL', 'JALHALLI', 'MALLESHWARAM', 'VIDHANASOUDHA'],
  'SOUTH': ['HSR', 'JAYANAGARA', 'KORAMANGALA'],
  'EAST': ['INDIRANAGAR', 'WHITEFIELD'],
  'WEST': ['KENGERI', 'RAJAJINAGAR', 'RAJRAJESHWARANAGARA', 'PEENYA', 'SHIVAJINAGAR']
};

// @desc    Generate and download Excel template
// @route   GET /api/masters/rmu/template
// @access  Private/Admin
export const downloadTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('RMU_MASTER');

    // Define columns
    worksheet.columns = [
      { header: 'Circle *', key: 'circle', width: 15 },
      { header: 'Division *', key: 'division', width: 20 },
      { header: 'SubDivision', key: 'subDivision', width: 15 },
      { header: 'SiteCode *', key: 'siteCode', width: 20 },
      { header: 'HRN *', key: 'hrn', width: 20 },
      { header: 'RMU_Make', key: 'rmuMake', width: 20 },
      { header: 'Equipment Type *', key: 'equipmentType', width: 20 },
      { header: 'InstallationDate', key: 'installationDate', width: 18 },
      { header: 'CommissioningDate', key: 'commissioningDate', width: 20 },
      { header: 'MaintenanceFrequency', key: 'maintenanceFrequency', width: 22 },
      { header: 'MaintenanceStartingDate', key: 'maintenanceStartingDate', width: 22 },
      { header: 'Latitude', key: 'latitude', width: 15 },
      { header: 'Longitude', key: 'longitude', width: 15 },
      { header: 'AgencyCode', key: 'agencyCode', width: 15 }
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Add instruction row
    worksheet.insertRow(1, [
      'Instructions: * = Mandatory fields. Do not modify headers. Use dropdowns where provided. Date format: YYYY-MM-DD or DD/MM/YYYY'
    ]);
    worksheet.mergeCells('A1:N1');
    const instructionRow = worksheet.getRow(1);
    instructionRow.font = { italic: true, color: { argb: 'FFFF0000' } };
    instructionRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB9C' }
    };
    instructionRow.alignment = { vertical: 'middle', horizontal: 'left' };

    // Add sample data row
    worksheet.addRow({
      circle: 'NORTH',
      division: 'HEBBAL',
      subDivision: 'S1',
      siteCode: 'SITE001',
      hrn: 'HRN12345',
      rmuMake: 'ABB',
      equipmentType: 'RMU',
      installationDate: '2024-01-15',
      commissioningDate: '2024-02-01',
      maintenanceFrequency: 'Quarterly',
      maintenanceStartingDate: '2024-03-01',
      latitude: 12.9716,
      longitude: 77.5946,
      agencyCode: 'AMC001'
    });

    // Add data validations for dropdowns (starting from row 3)
    const dataStartRow = 3;
    const maxRows = 1000;

    // Circle dropdown
    for (let i = dataStartRow; i <= maxRows; i++) {
      worksheet.getCell(`A${i}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"NORTH,SOUTH,EAST,WEST"']
      };
    }

    // Equipment Type dropdown
    for (let i = dataStartRow; i <= maxRows; i++) {
      worksheet.getCell(`G${i}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"RMU,SPB,LRC & LBS"']
      };
    }

    // Maintenance Frequency dropdown
    for (let i = dataStartRow; i <= maxRows; i++) {
      worksheet.getCell(`J${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Monthly,Quarterly,Half-Yearly,Yearly,2 Months,4 Months,5 Months,7 Months,8 Months,9 Months,10 Months,11 Months,15 Days"']
      };
    }

    // Maintenance Frequency dropdown
    for (let i = dataStartRow; i <= maxRows; i++) {
      worksheet.getCell(`J${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Monthly,Quarterly,Half-Yearly,Yearly,2 Months,4 Months,5 Months,7 Months,8 Months,9 Months,10 Months,11 Months,15 Days"']
      };
    }

    // Set response headers for download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=RMU_MASTER_IMPORT_TEMPLATE.xlsx'
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate template'
    });
  }
};

// @desc    Upload and validate Excel file
// @route   POST /api/masters/rmu/upload
// @access  Private/Admin
export const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check file type
    if (!req.file.originalname.match(/\.(xlsx)$/)) {
      return res.status(400).json({
        success: false,
        error: 'Only .xlsx files are allowed'
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    const worksheet = workbook.getWorksheet('RMU_MASTER');
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        error: 'Sheet "RMU_MASTER" not found in Excel file'
      });
    }

    const validRows = [];
    const invalidRows = [];
    let rowNumber = 0;

    // Get all agencies for validation
    const agencies = await AgencyMaster.find({ isDeleted: false }).select('agencyCode status');
    const agencyMap = {};
    agencies.forEach(agency => {
      agencyMap[agency.agencyCode] = agency.status;
    });

    // Get existing site codes for duplicate check
    const existingSites = await RMUMaster.find({ isDeleted: false }).select('siteCode');
    const existingSiteCodes = new Set(existingSites.map(s => s.siteCode.toUpperCase()));

    // Parse rows (skip instruction row at index 0 and header row at index 1)
    worksheet.eachRow((row, index) => {
      // Skip first two rows (instruction + header)
      if (index <= 2) return;

      rowNumber = index;
      const rowData = {
        circle: row.getCell(1).value ? String(row.getCell(1).value).trim().toUpperCase() : '',
        division: row.getCell(2).value ? String(row.getCell(2).value).trim().toUpperCase() : '',
        subDivision: row.getCell(3).value ? String(row.getCell(3).value).trim().toUpperCase() : '',
        siteCode: row.getCell(4).value ? String(row.getCell(4).value).trim().toUpperCase() : '',
        hrn: row.getCell(5).value ? String(row.getCell(5).value).trim().toUpperCase() : '',
        rmuMake: row.getCell(6).value ? String(row.getCell(6).value).trim() : '',
        equipmentType: row.getCell(7).value ? String(row.getCell(7).value).trim() : '',
        installationDate: row.getCell(8).value,
        commissioningDate: row.getCell(9).value,
        maintenanceFrequency: row.getCell(10).value ? String(row.getCell(10).value).trim() : '',
        maintenanceStartingDate: row.getCell(11).value,
        latitude: row.getCell(12).value ? parseFloat(row.getCell(12).value) : null,
        longitude: row.getCell(13).value ? parseFloat(row.getCell(13).value) : null,
        agencyCode: row.getCell(14).value ? String(row.getCell(14).value).trim().toUpperCase() : ''
      };

      // Skip empty rows
      if (!rowData.circle && !rowData.division && !rowData.siteCode) {
        return;
      }

      const errors = [];

      // Validate mandatory fields
      if (!rowData.circle) errors.push('Circle is required');
      if (!rowData.division) errors.push('Division is required');
      if (!rowData.siteCode) errors.push('SiteCode is required');
      if (!rowData.hrn) errors.push('HRN is required');
      if (!rowData.equipmentType) errors.push('Equipment Type is required');

      // Validate circle
      if (rowData.circle && !['NORTH', 'SOUTH', 'EAST', 'WEST'].includes(rowData.circle)) {
        errors.push('Invalid Circle (must be NORTH, SOUTH, EAST, or WEST)');
      }

      // Validate division belongs to circle
      if (rowData.circle && rowData.division) {
        const validDivisions = CIRCLE_DIVISIONS[rowData.circle] || [];
        if (!validDivisions.includes(rowData.division)) {
          errors.push(`Division ${rowData.division} does not belong to Circle ${rowData.circle}`);
        }
      }

      // Validate Equipment Type
      if (rowData.equipmentType && !['RMU', 'SPB', 'LRC & LBS'].includes(rowData.equipmentType)) {
        errors.push('Invalid Equipment Type (must be RMU, SPB, or LRC & LBS)');
      }

      // Validate Maintenance Frequency
      const validFrequencies = [
        'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly',
        '2 Months', '4 Months', '5 Months', '7 Months',
        '8 Months', '9 Months', '10 Months', '11 Months',
        '15 Days', ''
      ];
      if (rowData.maintenanceFrequency && !validFrequencies.includes(rowData.maintenanceFrequency)) {
        errors.push('Invalid Maintenance Frequency');
      }

      // Validate duplicate SiteCode
      if (rowData.siteCode && existingSiteCodes.has(rowData.siteCode)) {
        errors.push('Duplicate SiteCode - already exists in database');
      }

      // Validate AgencyCode if provided
      if (rowData.agencyCode) {
        if (!agencyMap[rowData.agencyCode]) {
          errors.push('AgencyCode does not exist');
        } else if (agencyMap[rowData.agencyCode] !== 'Active') {
          errors.push('AgencyCode is not Active');
        }
      }

      if (errors.length > 0) {
        invalidRows.push({
          row: rowNumber,
          data: rowData,
          errors: errors
        });
      } else {
        validRows.push(rowData);
      }
    });

    // Generate batch ID for this upload session
    const batchId = uuidv4();

    res.status(200).json({
      success: true,
      batchId: batchId,
      totalRows: validRows.length + invalidRows.length,
      validRows: validRows.length,
      invalidRowsCount: invalidRows.length,
      validData: validRows,
      invalidRows: invalidRows,
      message: `Parsed ${validRows.length + invalidRows.length} rows. ${validRows.length} valid, ${invalidRows.length} invalid.`
    });
  } catch (error) {
    console.error('Error uploading Excel:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload Excel'
    });
  }
};

// @desc    Confirm and save validated data
// @route   POST /api/masters/rmu/upload/confirm
// @access  Private/Admin
export const confirmUpload = async (req, res) => {
  try {
    const { validData, batchId } = req.body;
    const userId = req.user.userId;

    if (!validData || !Array.isArray(validData) || validData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid data to save'
      });
    }

    // Prepare documents for insertion
    const documents = validData.map(row => ({
      ...row,
      siteCode: row.siteCode.toUpperCase(),
      hrn: row.hrn.toUpperCase(),
      circle: row.circle.toUpperCase(),
      division: row.division.toUpperCase(),
      subDivision: row.subDivision ? row.subDivision.toUpperCase() : '',
      agencyCode: row.agencyCode ? row.agencyCode.toUpperCase() : '',
      uploadedBy: userId,
      uploadedAt: new Date(),
      uploadBatchId: batchId || uuidv4(),
      isDeleted: false
    }));

    // Insert all documents (no transaction needed for standalone MongoDB)
    const result = await RMUMaster.insertMany(documents, { ordered: false });

    res.status(201).json({
      success: true,
      count: result.length,
      batchId: batchId,
      message: `Successfully saved ${result.length} RMU records`
    });
  } catch (error) {
    console.error('Error confirming upload:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save RMU data'
    });
  }
};

// @desc    Get all RMU records with pagination
// @route   GET /api/masters/rmu
// @access  Private/Admin
export const getAllRMU = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      circle = '',
      division = '',
      status = ''
    } = req.query;

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { siteCode: { $regex: search, $options: 'i' } },
        { hrn: { $regex: search, $options: 'i' } },
        { siteName: { $regex: search, $options: 'i' } }
      ];
    }

    if (circle) query.circle = circle;
    if (division) query.division = division;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const rmuRecords = await RMUMaster.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RMUMaster.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rmuRecords,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching RMU records:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch RMU records'
    });
  }
};

// @desc    Delete RMU record
// @route   DELETE /api/masters/rmu/:id
// @access  Private/Admin
export const deleteRMU = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const rmu = await RMUMaster.findOne({ _id: id, isDeleted: false });

    if (!rmu) {
      return res.status(404).json({
        success: false,
        error: 'RMU record not found'
      });
    }

    rmu.isDeleted = true;
    rmu.deletedAt = new Date();
    rmu.deletedBy = userId;
    await rmu.save();

    res.status(200).json({
      success: true,
      message: 'RMU record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting RMU:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete RMU record'
    });
  }
};
