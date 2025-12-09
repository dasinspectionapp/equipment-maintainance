import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardLayout from './components/DashboardLayout'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import UserManagement from './pages/UserManagement'
import Delegation from './pages/Delegation'
import Dashboard from './pages/Dashboard'
import EquipmentDashboard from './pages/EquipmentDashboard'
import Upload from './pages/Upload'
import Uploads from './pages/Uploads'
import ViewData from './pages/ViewData'
import MyData from './pages/MyData'
import MyDataFiltered from './pages/MyDataFiltered'
import MyDivisionData from './pages/MyDivisionData'
import MyRTUTracker from './pages/MyRTUTracker'
import MyRTULocal from './pages/MyRTULocal'
import MyLogs from './pages/MyLogs'
import MyApprovals from './pages/MyApprovals'
import Reports from './pages/Reports'
import SurveyForm from './pages/SurveyForm'
import EquipmentStatus from './pages/EquipmentStatus'
import DeviceStatusTable from './pages/DeviceStatusTable'
import DeviceStatus from './pages/DeviceStatus'
import Profile from './pages/Profile'
import EmailConfiguration from './pages/EmailConfiguration'
import AdminUploads from './pages/AdminUploads'
import Settings from './pages/Settings'
import LocationManagement from './pages/LocationManagement'
import LandingPageCarousel from './pages/LandingPageCarousel'
import LandingPageAnnouncements from './pages/LandingPageAnnouncements'
import ApprovalReset from './pages/ApprovalReset'
import ELibraryAdmin from './pages/ELibraryAdmin'
import ResourcesPage from './pages/Resources'
import SurveyMassUpload from './pages/SurveyMassUpload'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="signin" element={<SignIn />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="resources" element={<ResourcesPage />} />
      </Route>
      <Route path="/dashboard" element={<DashboardLayout />}>
        {/* Admin-only routes */}
        <Route path="users" element={<UserManagement />} />
        <Route path="delegation" element={<Delegation />} />
        <Route path="email-config" element={<EmailConfiguration />} />
        <Route path="admin-uploads" element={<AdminUploads />} />
        <Route path="location" element={<LocationManagement />} />
        <Route path="approval-reset" element={<ApprovalReset />} />
        <Route path="survey-mass-upload" element={<SurveyMassUpload />} />
        <Route path="landing-page/carousel" element={<LandingPageCarousel />} />
        <Route path="landing-page/announcements" element={<LandingPageAnnouncements />} />
        <Route path="elibrary-admin" element={<ELibraryAdmin />} />
        {/* CCR-only routes */}
        <Route path="uploads" element={<Uploads />} />
        <Route path="upload" element={<Upload />} />
        <Route path="device-status-upload" element={<Upload />} />
        <Route path="view-data" element={<ViewData />} />
        <Route path="device-status" element={<DeviceStatus />} />
        {/* Equipment and RTU/Communication routes */}
        <Route path="my-data-filtered" element={<MyDataFiltered />} />
        <Route path="my-data" element={<MyData />} />
        <Route path="my-division-data" element={<MyDivisionData />} />
        <Route path="my-rtu-tracker" element={<MyRTUTracker />} />
        <Route path="my-rtu-local" element={<MyRTULocal />} />
        <Route path="my-approvals" element={<MyApprovals />} />
        <Route path="my-logs" element={<MyLogs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="equipment-dashboard" element={<EquipmentDashboard />} />
        <Route path="device-status-table" element={<DeviceStatusTable />} />
        {/* Equipment Survey routes */}
        <Route path="survey-form" element={<SurveyForm />} />
        <Route path="equipment-status" element={<EquipmentStatus />} />
        {/* Profile and Settings routes */}
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        {/* Default route - show based on role */}
        <Route index element={<Dashboard />} />
      </Route>
    </Routes>
  )
}

export default App


