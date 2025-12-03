import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import NotificationBell from './NotificationBell';

type MenuItem = {
  label: string;
  path?: string;
  icon?: string;
  children?: MenuItem[];
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('/bescom-logo.svg');

  useEffect(() => {
    const loadUser = () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const app = localStorage.getItem('selectedApplication') || '';
      
      console.log('Dashboard - Token exists:', !!token);
      console.log('Dashboard - Stored user:', storedUser);
      console.log('Dashboard - Selected application:', app);
      
      if (!token) {
        navigate('/signin');
        return;
      }
      
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('Dashboard - User data loaded:', userData);
          setUser(userData);
          setSelectedApplication(app);
        } catch (error) {
          console.error('Error parsing user data:', error);
          // Set a default user object instead of redirecting
          setUser({ name: 'Admin', email: 'admin@example.com' });
          setSelectedApplication(app);
        }
      } else {
        // If no user data, set a default user object
        console.log('No user data found, setting default');
        setUser({ name: 'Admin', email: 'admin@example.com' });
        setSelectedApplication(app);
      }
    };

    loadUser();
  }, [navigate]);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  // Fetch logo from admin uploads
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('http://localhost:5000/api/admin/uploads/logo', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          // If the API returns the image directly, create a blob URL
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setLogoUrl(imageUrl);
        } else {
          // Fallback to static logo if API fails
          setLogoUrl('/bescom-logo.svg');
        }
      } catch (error) {
        console.error('Error fetching logo:', error);
        // Fallback to static logo on error
        setLogoUrl('/bescom-logo.svg');
      }
    };

    fetchLogo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedApplication');
    navigate('/signin');
  };

  const getInitials = (name: string) => {
    if (!name) return 'A';
    try {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 1);
    } catch {
      return 'A';
    }
  };

  const getUserName = () => {
    if (user?.fullName) return user.fullName;
    if (user?.name) return user.name;
    if (user?.email) return user.email;
    return 'Admin';
  };

  const getUserRole = () => {
    return user?.role || 'User';
  };
  const userRole = getUserRole();

  const isActive = (path: string) => location.pathname === path;

  // Role-based menu items
  const isAdmin = userRole === 'Admin';
  const isCCR = userRole === 'CCR';
  const isEquipmentOnly = userRole === 'Equipment';
  const isEquipment = userRole === 'Equipment' || userRole === 'O&M' || userRole === 'AMC' || userRole === 'RTU/Communication' || userRole === 'Planning';
  const isOM = userRole === 'O&M';
  const isAMC = userRole === 'AMC';
  
  // Determine which application is active
  const isEquipmentMaintenance = selectedApplication === 'equipment-maintenance';
  const isEquipmentSurvey = selectedApplication === 'equipment-survey';
  
  // Equipment Maintenance: only CCR sees Upload and View Data
  const isRTUComm = getUserRole() === 'RTU/Communication';
  
  // Survey menu with dropdown items
  const surveyMenu: MenuItem = {
    label: 'SURVEY',
    icon: '📋',
    children: [
      { label: 'Survey Form', path: '/dashboard/survey-form', icon: '📝' },
      { label: 'Survey Report', path: '/dashboard/equipment-status', icon: '📊' },
    ],
  };

  // Base menu items for Equipment Maintenance
  const baseEquipmentMaintenanceItems = [
    { label: 'MY DATA', path: '/dashboard/my-data-filtered', icon: '📊' },
    { label: 'MY OFFLINE SITES', path: '/dashboard/my-data', icon: '📋' },
    { label: 'MY DIVISION DATA', path: '/dashboard/my-division-data', icon: '🏢' },
    { label: 'MY RTU TRACKER', path: '/dashboard/my-rtu-tracker', icon: '📍' },
    surveyMenu,
    { label: 'View Data', path: '/dashboard/view-data', icon: '👁️' },
    { label: 'MY LOGS', path: '/dashboard/my-logs', icon: '📝' }
  ];

  const approvalsMenuItem = { label: 'MY APPROVALS', path: '/dashboard/my-approvals', icon: '✅' };
  const ccrApprovalsMenuItem = { label: 'APPROVALS', path: '/dashboard/my-approvals', icon: '✅' };

  // Construct Equipment Maintenance menu items based on role
  const equipmentMaintenanceItems = (() => {
    if (isOM || isAMC) {
      return baseEquipmentMaintenanceItems.filter(item => item.label === 'MY OFFLINE SITES');
    }
    if (isEquipmentOnly) {
      // For Equipment role: add Dashboard (MY INFO), remove MY DATA and View Data tabs, and inject MY APPROVALS after MY OFFLINE SITES
      const dashboardItem = { label: 'Dashboard', path: '/dashboard', icon: '📊' };
      const reportsMenuItem = { label: 'Reports', path: '/dashboard/reports', icon: '📋' };
      const items = baseEquipmentMaintenanceItems.filter(item => item.label !== 'MY DATA' && item.label !== 'View Data');

      // Insert Dashboard as the first tab for Equipment Maintenance
      items.unshift(dashboardItem);

      const offlineIndex = items.findIndex(item => item.label === 'MY OFFLINE SITES');
      if (offlineIndex !== -1) {
        items.splice(offlineIndex + 1, 0, approvalsMenuItem);
      } else {
        items.push(approvalsMenuItem);
      }
      
      // Add Reports tab at the end
      items.push(reportsMenuItem);
      return items;
    }
    if (isRTUComm) {
      // For RTU/Communication role: Remove MY DATA and MY RTU TRACKER tabs, add MY RTU LOCAL tab
      const items = baseEquipmentMaintenanceItems.filter(item => item.label !== 'MY DATA' && item.label !== 'MY RTU TRACKER');
      // Add MY RTU LOCAL tab after MY OFFLINE SITES
      const offlineIndex = items.findIndex(item => item.label === 'MY OFFLINE SITES');
      const rtuLocalItem = { label: 'MY RTU LOCAL', path: '/dashboard/my-rtu-local', icon: '🔌' };
      if (offlineIndex !== -1) {
        items.splice(offlineIndex + 1, 0, rtuLocalItem);
      } else {
        items.push(rtuLocalItem);
      }
      return items;
    }
    return baseEquipmentMaintenanceItems;
  })();
  
  const landingPageMenu: MenuItem = {
    label: 'Landing Page',
    icon: '🖥️',
    children: [
      { label: 'Carousel', path: '/dashboard/landing-page/carousel', icon: '🖼️' },
      { label: 'Announcements', path: '/dashboard/landing-page/announcements', icon: '📢' },
    ],
  };

  const adminMenu: MenuItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'User Management', path: '/dashboard/users', icon: '👥' },
    { label: 'Delegation', path: '/dashboard/delegation', icon: '🔄' },
    { label: 'Email Configuration', path: '/dashboard/email-config', icon: '📧' },
    { label: 'Admin Uploads', path: '/dashboard/admin-uploads', icon: '📤' },
    { label: 'Location', path: '/dashboard/location', icon: '📍' },
    { label: 'Approval Reset', path: '/dashboard/approval-reset', icon: '🔄' },
    landingPageMenu,
  ];

  const menuItems: MenuItem[] = isAdmin
    ? adminMenu
    : isCCR
    ? // CCR role sees Uploads tab for Equipment Maintenance, Upload tab otherwise, and Approvals tab
      ((isEquipmentMaintenance
        ? [
            { label: 'Uploads', path: '/dashboard/uploads', icon: '📤' },
            { label: 'View Data', path: '/dashboard/view-data', icon: '👁️' },
            { label: 'Device Status', path: '/dashboard/device-status', icon: '📊' },
            ccrApprovalsMenuItem,
          ]
        : [
            { label: 'Upload', path: '/dashboard/upload', icon: '📤' },
            ccrApprovalsMenuItem,
          ]) as MenuItem[])
    : (isEquipment || isRTUComm) && isEquipmentMaintenance
    ? (equipmentMaintenanceItems as MenuItem[])
    : isEquipmentSurvey && !isAdmin
    ? ([
        { label: 'Survey Form', path: '/dashboard/survey-form', icon: '📋' },
        { label: 'Equipment Status', path: '/dashboard/equipment-status', icon: '📊' },
      ] as MenuItem[])
    : [];

  const isItemActive = (item: MenuItem) => {
    if (item.path && isActive(item.path)) {
      return true;
    }
    if (item.children && item.children.length > 0) {
      return item.children.some((child) => child.path && isActive(child.path));
    }
    return false;
  };

  return (
    <>
      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Left Sidebar Navigation */}
      {((isAdmin || isCCR || ((isEquipment || isRTUComm || isOM || isAMC) && isEquipmentMaintenance) || isEquipmentSurvey) && menuItems.length > 0) && (
        <aside 
          className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} shadow-xl flex flex-col z-30 transition-all duration-300`}
          style={{
            background: 'linear-gradient(135deg, #0D5EA6 0%, #0D5EA6 100%)'
          }}
        >
          {/* Sidebar Header */}
          <div className={`${isSidebarCollapsed ? 'p-4' : 'px-4 pt-4'} flex items-center ${isSidebarCollapsed ? 'justify-center flex-col space-y-3' : 'justify-between'}`}>
            {/* BESCOM Logo */}
            <div className={`${isSidebarCollapsed ? 'w-full flex justify-center' : 'flex-1 flex justify-center'}`}>
              <img
                src={logoUrl}
                alt="BESCOM Logo"
                className={`${isSidebarCollapsed ? 'w-6 h-6' : 'w-12 h-auto'} object-contain`}
                onError={(e) => {
                  // Fallback to static logo if image fails to load
                  e.currentTarget.src = '/bescom-logo.svg';
                }}
              />
            </div>
            {/* Toggle Button */}
            <div className={`${isSidebarCollapsed ? 'w-full flex justify-center' : ''}`}>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`p-2 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors ${isSidebarCollapsed ? 'mt-2' : ''}`}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg
                  className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            {menuItems.map((item) => {
              const active = isItemActive(item);

              if (item.children && item.children.length > 0) {
                // When collapsed, don't show submenus - just navigate to first child or show tooltip
                if (isSidebarCollapsed) {
                  return (
                    <div key={item.label} className="mb-1 relative group">
                      <button
                        onClick={() => {
                          // Navigate to first child when collapsed
                          if (item.children && item.children[0]?.path) {
                            navigate(item.children[0].path);
                          }
                        }}
                        className={`w-full flex items-center justify-center px-4 py-3 transition-all duration-300 rounded-full ${
                          active
                            ? 'bg-white/20 text-white shadow-lg backdrop-blur-md'
                            : 'text-gray-200 hover:bg-white/25 hover:text-white hover:shadow-2xl hover:scale-110 hover:backdrop-blur-md hover:ring-2 hover:ring-white/30 hover:ring-inset'
                        }`}
                        title={item.label.toUpperCase()}
                      >
                        {item.icon && <span className="text-lg">{item.icon}</span>}
                      </button>
                      {/* Tooltip */}
                      <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
                        {item.label.toUpperCase()}
                      </div>
                    </div>
                  );
                }

                const isOpen = openMenu === item.label;
                return (
                  <div key={item.label} className="mb-1">
                    <button
                      onClick={() => setOpenMenu(isOpen ? null : item.label)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-300 rounded-full ${
                        active
                          ? 'bg-white/20 text-white shadow-lg backdrop-blur-md'
                          : 'text-gray-200 hover:bg-white/25 hover:text-white hover:shadow-2xl hover:scale-105 hover:backdrop-blur-md hover:ring-2 hover:ring-white/30 hover:ring-inset'
                      }`}
                    >
                      <span className="flex items-center space-x-3">
                        {item.icon && <span className="text-lg">{item.icon}</span>}
                        <span className="font-medium">{item.label.toUpperCase()}</span>
                      </span>
                      <svg
                        className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="bg-gray-700/50">
                        {item.children.map((child) => (
                          <button
                            key={`${item.label}-${child.label}`}
                            onClick={() => {
                              if (child.path) {
                                navigate(child.path);
                              }
                              setOpenMenu(null);
                            }}
                            className={`w-full flex items-center space-x-3 px-8 py-2.5 text-left text-sm transition-all duration-300 rounded-full ${
                              child.path && isActive(child.path)
                                ? 'bg-white/20 text-white font-semibold backdrop-blur-md'
                                : 'text-gray-300 hover:bg-white/25 hover:text-white hover:shadow-2xl hover:scale-105 hover:backdrop-blur-md hover:ring-2 hover:ring-white/30 hover:ring-inset'
                            }`}
                          >
                            {child.icon && <span>{child.icon}</span>}
                            <span>{child.label.toUpperCase()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.path || item.label} className="mb-1 relative group">
                  <button
                    onClick={() => {
                      if (item.path) {
                        navigate(item.path);
                      }
                    }}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 text-left transition-all duration-300 rounded-full ${
                      active
                        ? 'bg-white/20 text-white shadow-lg border-l-4 border-white backdrop-blur-md'
                        : 'text-gray-200 hover:bg-white/25 hover:text-white hover:shadow-2xl hover:scale-105 hover:backdrop-blur-md hover:ring-2 hover:ring-white/30 hover:ring-inset'
                    }`}
                    title={isSidebarCollapsed ? item.label.toUpperCase() : ''}
                  >
                    {item.icon && <span className="text-lg">{item.icon}</span>}
                    {!isSidebarCollapsed && <span className="font-medium">{item.label.toUpperCase()}</span>}
                  </button>
                  {/* Tooltip for collapsed state */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
                      {item.label.toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header 
          className="shadow-lg border-b border-slate-800/50 relative z-40 backdrop-blur-md"
          style={{
            background: 'linear-gradient(135deg, #0D5EA6 0%, #0D5EA6 100%)',
            backdropFilter: 'blur(10px) saturate(180%)',
            WebkitBackdropFilter: 'blur(10px) saturate(180%)',
            animation: 'fadeInDown 0.6s ease-out',
            boxShadow: '0 8px 32px 0 rgba(13, 94, 166, 0.37)'
          }}
        >
          <div className="flex items-center justify-between px-8 py-1.5">
            {/* Left Side - Welcome Message */}
            <div className="flex items-center space-x-4">
              {/* Toggle Sidebar Button (shown when sidebar is hidden or for mobile) */}
              {!((isAdmin || isCCR || ((isEquipment || isRTUComm || isOM || isAMC) && isEquipmentMaintenance) || isEquipmentSurvey) && menuItems.length > 0) && (
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-2 rounded-lg hover:bg-slate-800/50 text-white transition-colors"
                  title="Toggle sidebar"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <h1 className="text-2xl font-bold text-white">
                Welcome, {getUserName()} - {getUserRole()}
              </h1>
            </div>

            {/* Right Side - Notifications, Profile and Logout */}
            <div className="flex items-center space-x-4">
              {/* Notification Bell */}
              <NotificationBell 
                selectedApplication={selectedApplication || localStorage.getItem('selectedApplication') || ''} 
              />

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-3 p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 font-bold text-lg">
                    {getInitials(getUserName())}
                  </div>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <button 
                      onClick={() => {
                        navigate('/dashboard/profile');
                        setIsProfileDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>View Profile</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => {
                        navigate('/dashboard/settings');
                        setIsProfileDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Settings</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 rounded-lg transition-colors border border-red-400 bg-red-500/20 backdrop-blur-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-auto overflow-y-auto w-full">
          <div className="container mx-auto px-8 py-6 max-w-full w-full min-w-[1000px]">
            {/* Main content area - show appropriate content based on application */}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={() => setIsLogoutModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-2xl p-6 w-[90%] max-w-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-3 justify-end items-center w-full">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-6 py-2.5 text-base font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors border-2 border-green-700 min-w-[100px] shadow-md"
                style={{ 
                  display: 'block', 
                  visibility: 'visible',
                  backgroundColor: '#16a34a'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleLogout();
                  setIsLogoutModalOpen(false);
                }}
                className="px-6 py-2.5 text-base font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors min-w-[100px] shadow-lg"
                style={{ 
                  display: 'block', 
                  visibility: 'visible',
                  backgroundColor: '#dc2626'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

