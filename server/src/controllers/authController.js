const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Register new user
 */
const register = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { name, email, password, role = 'student', college = '', department = '' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Create new user
  const user = new User({
    name,
    email,
    passwordHash: password, // Will be hashed by pre-save middleware
    role,
    college: college.trim(),
    department: department.trim()
  });

  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences
      },
      token
    }
  });
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        department: user.department,
        preferences: user.preferences
      },
      token
    }
  });
});

/**
 * Get current user profile
 */
const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

/**
 * Update user profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, preferences, college, department } = req.body;
  const userId = req.user._id;

  const updateData = {};
  if (name) updateData.name = name;
  if (preferences) updateData.preferences = preferences;
  if (college !== undefined) updateData.college = college.trim();
  if (department !== undefined) updateData.department = department.trim();

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-passwordHash');

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user
    }
  });
});

/**
 * Change password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  // Get user with password hash
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.passwordHash = newPassword; // Will be hashed by pre-save middleware
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

/**
 * Logout (client-side token removal)
 */
const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * Get all unique colleges and departments (public endpoint for registration)
 */
const getCollegesAndDepartments = asyncHandler(async (req, res) => {
  try {
    // Get all unique colleges and departments from students
    const students = await User.find({ 
      role: 'student',
      $or: [
        { college: { $exists: true, $ne: '' } },
        { department: { $exists: true, $ne: '' } }
      ]
    }).select('college department');

    const collegesSet = new Set();
    const departmentsSet = new Set();

    students.forEach(student => {
      if (student.college && student.college.trim()) {
        collegesSet.add(student.college.trim());
      }
      if (student.department && student.department.trim()) {
        departmentsSet.add(student.department.trim());
      }
    });

    const colleges = Array.from(collegesSet).sort();
    const departments = Array.from(departmentsSet).sort();

    res.json({
      success: true,
      data: {
        colleges,
        departments
      }
    });
  } catch (error) {
    console.error('Get colleges and departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching colleges and departments'
    });
  }
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  getCollegesAndDepartments
};
