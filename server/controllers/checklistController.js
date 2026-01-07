import Checklist from '../models/Checklist.js';
import mongoose from 'mongoose';

// @desc    Create a new checklist with parameters
// @route   POST /api/admin/checklists
// @access  Admin
export const createChecklist = async (req, res) => {
  try {
    const { checklistName, maintenanceType, equipmentType, status, parameters } = req.body;

    // Validate required fields
    if (!checklistName || !maintenanceType || !parameters || parameters.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Checklist name, maintenance type, and at least one parameter are required'
      });
    }

    // Check if checklist name already exists
    const existingChecklist = await Checklist.findOne({ checklistName });
    if (existingChecklist) {
      return res.status(400).json({
        success: false,
        error: 'A checklist with this name already exists'
      });
    }

    // Validate parameter keys are unique
    const keys = parameters.map(p => p.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      return res.status(400).json({
        success: false,
        error: 'Parameter keys must be unique within a checklist'
      });
    }

    // Validate ENUM parameters have at least 2 options
    for (const param of parameters) {
      if (param.inputType === 'ENUM') {
        if (!param.options || param.options.length < 2) {
          return res.status(400).json({
            success: false,
            error: `Parameter "${param.label}" with ENUM type must have at least 2 options`
          });
        }
      }
    }

    // Create checklist
    const checklist = await Checklist.create({
      checklistName,
      maintenanceType,
      equipmentType: equipmentType || 'RMU',
      status: status || 'ACTIVE',
      parameters
    });

    res.status(201).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('Error creating checklist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checklist'
    });
  }
};

// @desc    Get all checklists
// @route   GET /api/admin/checklists
// @access  Admin
export const getAllChecklists = async (req, res) => {
  try {
    const { maintenanceType, equipmentType, status } = req.query;

    // Build filter
    const filter = {};
    if (maintenanceType) filter.maintenanceType = maintenanceType;
    if (equipmentType) filter.equipmentType = equipmentType;
    if (status) filter.status = status;

    const checklists = await Checklist.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: checklists.length,
      data: checklists
    });
  } catch (error) {
    console.error('Error fetching checklists:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch checklists'
    });
  }
};

// @desc    Get single checklist by ID
// @route   GET /api/admin/checklists/:id
// @access  Admin
export const getChecklistById = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    res.status(200).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch checklist'
    });
  }
};

// @desc    Update checklist (name and status only)
// @route   PUT /api/admin/checklists/:id
// @access  Admin
export const updateChecklist = async (req, res) => {
  try {
    const { checklistName, maintenanceType, equipmentType, status } = req.body;

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    // Check if new name conflicts with existing checklist
    if (checklistName && checklistName !== checklist.checklistName) {
      const existingChecklist = await Checklist.findOne({ 
        checklistName, 
        _id: { $ne: req.params.id } 
      });
      if (existingChecklist) {
        return res.status(400).json({
          success: false,
          error: 'A checklist with this name already exists'
        });
      }
      checklist.checklistName = checklistName;
    }

    // Update other fields
    if (maintenanceType) checklist.maintenanceType = maintenanceType;
    if (equipmentType) checklist.equipmentType = equipmentType;
    if (status) checklist.status = status;

    await checklist.save();

    res.status(200).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('Error updating checklist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update checklist'
    });
  }
};

// @desc    Delete checklist (only if unused)
// @route   DELETE /api/admin/checklists/:id
// @access  Admin
export const deleteChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    // Check if checklist is in use
    const inUse = await checklist.isInUse();
    if (inUse) {
      // Soft delete - mark as INACTIVE
      checklist.status = 'INACTIVE';
      await checklist.save();
      
      return res.status(200).json({
        success: true,
        message: 'Checklist is in use and has been marked as INACTIVE',
        data: checklist
      });
    }

    // Hard delete if not in use
    await Checklist.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Checklist deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete checklist'
    });
  }
};

// @desc    Add parameter to checklist
// @route   POST /api/admin/checklists/:id/parameters
// @access  Admin
export const addParameter = async (req, res) => {
  try {
    const { label, key, inputType, options, photoRequired, critical } = req.body;

    // Validate required fields
    if (!label || !key || !inputType) {
      return res.status(400).json({
        success: false,
        error: 'Label, key, and input type are required'
      });
    }

    // Validate ENUM has options
    if (inputType === 'ENUM' && (!options || options.length < 2)) {
      return res.status(400).json({
        success: false,
        error: 'ENUM type must have at least 2 options'
      });
    }

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    // Check if parameter key already exists
    const existingParam = checklist.parameters.find(p => p.key === key);
    if (existingParam) {
      return res.status(400).json({
        success: false,
        error: 'A parameter with this key already exists in this checklist'
      });
    }

    // Add parameter
    checklist.parameters.push({
      label,
      key,
      inputType,
      options: inputType === 'ENUM' ? options : [],
      photoRequired: photoRequired || false,
      critical: critical || false,
      active: true
    });

    await checklist.save();

    res.status(201).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('Error adding parameter:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add parameter'
    });
  }
};

// @desc    Update parameter (except key)
// @route   PUT /api/admin/checklists/:id/parameters/:paramId
// @access  Admin
export const updateParameter = async (req, res) => {
  try {
    const { label, inputType, options, photoRequired, critical, active } = req.body;

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    const parameter = checklist.parameters.id(req.params.paramId);

    if (!parameter) {
      return res.status(404).json({
        success: false,
        error: 'Parameter not found'
      });
    }

    // Update allowed fields (key cannot be changed)
    if (label) parameter.label = label;
    if (inputType) {
      parameter.inputType = inputType;
      // Validate ENUM has options
      if (inputType === 'ENUM' && (!options || options.length < 2)) {
        return res.status(400).json({
          success: false,
          error: 'ENUM type must have at least 2 options'
        });
      }
    }
    if (options !== undefined) parameter.options = options;
    if (photoRequired !== undefined) parameter.photoRequired = photoRequired;
    if (critical !== undefined) parameter.critical = critical;
    if (active !== undefined) parameter.active = active;

    await checklist.save();

    res.status(200).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('Error updating parameter:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update parameter'
    });
  }
};

// @desc    Delete parameter (soft delete if used)
// @route   DELETE /api/admin/checklists/:id/parameters/:paramId
// @access  Admin
export const deleteParameter = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        error: 'Checklist not found'
      });
    }

    const parameter = checklist.parameters.id(req.params.paramId);

    if (!parameter) {
      return res.status(404).json({
        success: false,
        error: 'Parameter not found'
      });
    }

    // Check if checklist is in use
    const inUse = await checklist.isInUse();
    
    if (inUse) {
      // Soft delete - mark as inactive
      parameter.active = false;
      await checklist.save();
      
      return res.status(200).json({
        success: true,
        message: 'Parameter has been marked as inactive',
        data: checklist
      });
    }

    // Hard delete if checklist not in use
    checklist.parameters.pull(req.params.paramId);
    
    // Ensure at least one parameter remains
    if (checklist.parameters.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the last parameter. Checklist must have at least one parameter.'
      });
    }
    
    await checklist.save();

    res.status(200).json({
      success: true,
      message: 'Parameter deleted successfully',
      data: checklist
    });
  } catch (error) {
    console.error('Error deleting parameter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete parameter'
    });
  }
};






