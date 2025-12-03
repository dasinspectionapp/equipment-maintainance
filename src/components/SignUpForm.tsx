
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SignUpForm() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fullName: '',
    userId: '',
    email: '',
    mobile: '',
    designation: '',
    role: '',
    circle: [] as string[],
    division: [] as string[],
    subDivision: [] as string[],
    sectionName: '',
    vendor: '',
    password: '',
    retypePassword: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRetypePassword, setShowRetypePassword] = useState(false);

  const designations = [
    'System Admin',
    'Junior Engineer (J.E)',
    'Assistant Engineer (A.E)',
    'Assistant Executive Engineer (AEE)',
    'Executive Engineer (EE)',
    'Superintendent Engineer (SE)',
  ];

  const roles = [
    'Admin',
    'Equipment',
    'CCR',
    'AMC',
    'RTU/Communication',
    'Planning',
    'O&M',
  ];

  const circles = ['NORTH', 'SOUTH', 'EAST', 'WEST'];

  const divisions = [
    'HSR',
    'JAYANAGARA',
    'KORAMANGALA',
    'KENGERI',
    'RAJAJINAGAR',
    'RAJRAJESHWARANAGARA',
    'INDIRANAGAR',
    'PEENYA',
    'JALHALLI',
    'MALLESHWARAM',
    'VIDHANASOUDHA',
    'WHITEFIELD',
    'SHIVAJINAGAR',
    'HEBBAL',
  ];

  const subDivisions = [
    'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7',
    'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
    'W1', 'W2', 'W3',
  ];

  const vendors = [
    'Shrishaila Electricals(India Pvt ltd)',
    'Spectrum Consultants',
    'Jyothi Electricals',
    'Vendor1',
    'Vendor2',
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Clear vendor field if role changes away from AMC
      if (name === 'role' && value !== 'AMC') {
        updated.vendor = '';
      }
      return updated;
    });
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) {
      setFormData(prev => ({ ...prev, mobile: value }));
      if (errors.mobile) {
        setErrors(prev => ({ ...prev, mobile: '' }));
      }
    }
  };

  const handleMultiSelect = (name: string, value: string) => {
    setFormData(prev => {
      const currentValues = prev[name as keyof typeof prev] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [name]: newValues };
    });
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!minLength) return 'Password must be at least 8 characters';
    if (!hasUpperCase) return 'Password must contain at least one uppercase letter';
    if (!hasNumber) return 'Password must contain at least one number';
    if (!hasSpecialChar) return 'Password must contain at least one special character';
    return '';
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!formData.userId.trim()) newErrors.userId = 'User ID is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!validateEmail(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.mobile) newErrors.mobile = 'Mobile number is required';
    if (formData.mobile.length !== 10) newErrors.mobile = 'Mobile must be exactly 10 digits';
    if (!formData.designation) newErrors.designation = 'Designation is required';
    if (!formData.role) newErrors.role = 'Role is required';
    // Circle is not required for Admin and CCR roles
    const requiresCircle = formData.role !== 'Admin' && formData.role !== 'CCR';
    if (requiresCircle && formData.circle.length === 0) {
      newErrors.circle = 'Please select at least one Circle';
    }
    // Division is only required for J.E and A.E, but not for Admin and CCR roles
    const requiresDivision = (formData.designation === 'Junior Engineer (J.E)' || formData.designation === 'Assistant Engineer (A.E)') && formData.role !== 'Admin' && formData.role !== 'CCR';
    if (requiresDivision && formData.division.length === 0) {
      newErrors.division = 'Please select at least one Division';
    }
    
    // SubDivision is only required for J.E and A.E with O&M role
    const requiresSubDivision = (formData.designation === 'Junior Engineer (J.E)' || formData.designation === 'Assistant Engineer (A.E)') && formData.role === 'O&M';
    if (requiresSubDivision && formData.subDivision.length === 0) {
      newErrors.subDivision = 'Please select at least one SubDivision';
    }

    // Vendor is required for AMC role
    if (formData.role === 'AMC' && !formData.vendor.trim()) {
      newErrors.vendor = 'Vendor is required for AMC role';
    }

    const passwordError = validatePassword(formData.password);
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (passwordError) {
      newErrors.password = passwordError;
    }

    if (!formData.retypePassword) {
      newErrors.retypePassword = 'Please retype your password';
    } else if (formData.password !== formData.retypePassword) {
      newErrors.retypePassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          userId: formData.userId,
          email: formData.email,
          mobile: formData.mobile,
          designation: formData.designation,
          role: formData.role,
          circle: formData.circle,
          division: formData.division,
          subDivision: formData.subDivision,
          sectionName: formData.sectionName,
          vendor: formData.vendor,
          password: formData.password,
          retypePassword: formData.retypePassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      console.log('Sign up successful:', data);
      
      // Show success message
      alert('Successfully submitted! Please wait for Admin Approval.');
      
      // Clear form
      handleReset();
      
      // Redirect to sign in page
      setTimeout(() => {
        navigate('/signin');
      }, 1000);
    } catch (error: any) {
      console.error('Sign up error:', error);
      alert(error.message || 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      userId: '',
      email: '',
      mobile: '',
      designation: '',
      role: '',
      circle: [],
      division: [],
      subDivision: [],
      sectionName: '',
      vendor: '',
      password: '',
      retypePassword: '',
    });
    setErrors({});
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Sign Up Header */}
      <div className="mb-6 text-center animate-in fade-in duration-500">
        <h1 className="text-3xl font-bold text-white">Sign Up</h1>
        <p className="text-white/80 mt-2">Distribution Automation System</p>
      </div>

      {/* Sign Up Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent ${
                  errors.fullName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your full name"
              />
              {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
            </div>

            {/* User ID */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                User ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent ${
                  errors.userId ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Choose a unique user ID"
              />
              {errors.userId && <p className="mt-1 text-sm text-red-600">{errors.userId}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="user@domain.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Mobile */}
            <div>
              <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
                Mobile <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="mobile"
                name="mobile"
                value={formData.mobile}
                onChange={handleMobileChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent ${
                  errors.mobile ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
              {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Designation */}
            <div>
              <label htmlFor="designation" className="block text-sm font-medium text-gray-700 mb-2">
                Designation <span className="text-red-500">*</span>
              </label>
              <select
                id="designation"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent bg-white ${
                  errors.designation ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Designation</option>
                {designations.map(des => (
                  <option key={des} value={des}>{des}</option>
                ))}
              </select>
              {errors.designation && <p className="mt-1 text-sm text-red-600">{errors.designation}</p>}
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent bg-white ${
                  errors.role ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Role</option>
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
            </div>
          </div>

          {/* Circle Multi-Select */}
          <MultiSelectField
            label="Circle"
            name="circle"
            options={circles}
            selectedValues={formData.circle}
            onChange={handleMultiSelect}
            error={errors.circle}
            required={formData.role !== 'Admin' && formData.role !== 'CCR'}
          />

          {/* Division Multi-Select */}
          <MultiSelectField
            label="Division"
            name="division"
            options={divisions}
            selectedValues={formData.division}
            onChange={handleMultiSelect}
            error={errors.division}
            required={(formData.designation === 'Junior Engineer (J.E)' || formData.designation === 'Assistant Engineer (A.E)') && formData.role !== 'Admin' && formData.role !== 'CCR'}
          />

          {/* SubDivision Multi-Select */}
          <MultiSelectField
            label="SubDivision"
            name="subDivision"
            options={subDivisions}
            selectedValues={formData.subDivision}
            onChange={handleMultiSelect}
            error={errors.subDivision}
            required={(formData.designation === 'Junior Engineer (J.E)' || formData.designation === 'Assistant Engineer (A.E)') && formData.role === 'O&M'}
            disabled={formData.role === 'Admin' || formData.role === 'Equipment' || formData.role === 'CCR' || formData.role === 'AMC' || formData.role === 'RTU/Communication' || formData.role === 'Planning'}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section Name */}
            <div>
              <label htmlFor="sectionName" className="block text-sm font-medium text-gray-700 mb-2">
                Section Name (O&M)
              </label>
              <input
                type="text"
                id="sectionName"
                name="sectionName"
                value={formData.sectionName}
                onChange={handleChange}
                disabled={formData.role === 'Admin' || formData.role === 'Equipment' || formData.role === 'CCR' || formData.role === 'AMC' || formData.role === 'RTU/Communication' || formData.role === 'Planning'}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent ${
                  (formData.role === 'Admin' || formData.role === 'Equipment' || formData.role === 'CCR' || formData.role === 'AMC' || formData.role === 'RTU/Communication' || formData.role === 'Planning')
                    ? 'bg-gray-100 cursor-not-allowed text-gray-500'
                    : 'border-gray-300'
                }`}
                placeholder="Enter section name"
              />
            </div>

            {/* Vendor - Only enabled for AMC role */}
            <div>
              <label htmlFor="vendor" className={`block text-sm font-medium mb-2 ${formData.role !== 'AMC' ? 'text-gray-500' : 'text-gray-700'}`}>
                Vendor {formData.role === 'AMC' && <span className="text-red-500">*</span>}
              </label>
              <select
                id="vendor"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                disabled={formData.role !== 'AMC'}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent ${
                  formData.role !== 'AMC'
                    ? 'bg-gray-100 cursor-not-allowed text-gray-500 border-gray-300'
                    : errors.vendor
                    ? 'border-red-500 bg-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <option value="">Select Vendor</option>
                {vendors.map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
              {errors.vendor && <p className="mt-1 text-sm text-red-600">{errors.vendor}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Set Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Set Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent pr-12 ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-electrical-blue"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Min 8 chars, 1 uppercase, 1 number, 1 special char
              </p>
            </div>

            {/* Retype Password */}
            <div>
              <label htmlFor="retypePassword" className="block text-sm font-medium text-gray-700 mb-2">
                Retype Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showRetypePassword ? 'text' : 'password'}
                  id="retypePassword"
                  name="retypePassword"
                  value={formData.retypePassword}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-electrical-blue focus:border-transparent pr-12 ${
                    errors.retypePassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Retype password"
                />
                <button
                  type="button"
                  onClick={() => setShowRetypePassword(!showRetypePassword)}
                  className="absolute right-หนัก top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-electrical-blue"
                >
                  {showRetypePassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.retypePassword && <p className="mt-1 text-sm text-red-600">{errors.retypePassword}</p>}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-electrical-blue hover:bg-electrical-blue-dark text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Submit / Sign Up'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="sm:w-auto w-full border-2 border-electrical-blue text-electrical-blue hover:bg-electrical-blue hover:text-white font-bold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Reset / Clear
            </button>
          </div>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a onClick={(e) => { e.preventDefault(); navigate('/signin'); }} href="/signin" className="text-electrical-blue hover:text-electrical-blue-dark font-medium cursor-pointer">
              Back to Sign In
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

function MultiSelectField({ 
  label, 
  name, 
  options, 
  selectedValues, 
  onChange, 
  error, 
  required = false,
  disabled = false
}: { 
  label: string; 
  name: string; 
  options: string[]; 
  selectedValues: string[]; 
  onChange: (name: string, value: string) => void; 
  error?: string; 
  required?: boolean;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className={`block text-sm font-medium mb-2 ${disabled ? 'text-gray-500' : 'text-gray-700'}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-3 border rounded-lg text-left flex justify-between items-center transition-all ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed text-gray-500 border-gray-300'
            : error
            ? 'border-red-500 bg-white'
            : 'border-gray-300 bg-white'
        }`}
      >
        <span className={selectedValues.length === 0 ? 'text-gray-400' : ''}>
          {selectedValues.length === 0 ? `Select ${label}` : `${selectedValues.length} selected`}
        </span>
        <span className="text-gray-400">▼</span>
      </button>
      
      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map(option => (
            <label
              key={option}
              className="flex items-center px-4 py-2 hover:bg-electrical-blue/10 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={() => onChange(name, option)}
                disabled={disabled}
                className="mr-2 h-4 w-4 text-electrical-blue focus:ring-electrical-blue border-gray-300 rounded"
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      )}
      
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
