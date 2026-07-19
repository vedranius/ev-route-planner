import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VehicleProvider } from './context/VehicleContext';
import Layout, { ProtectedRoute, PublicRoute } from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RoutePlanPage from './pages/RoutePlan';
import ChargersPage from './pages/ChargersPage';
import ChatPage from './pages/ChatPage';
import ShareLocationPage from './pages/ShareLocationPage';
import ProfilePage from './pages/ProfilePage';
import OVMSPage from './pages/OVMSPage';

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <VehicleProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/plan" element={<ProtectedRoute><RoutePlanPage /></ProtectedRoute>} />
              <Route path="/chargers" element={<ProtectedRoute><ChargersPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/share" element={<ProtectedRoute><ShareLocationPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/ovms" element={<ProtectedRoute><OVMSPage /></ProtectedRoute>} />
              <Route path="/view/:shareId" element={<ShareLocationPage />} />
              <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            </Route>
          </Routes>
        </VehicleProvider>
      </AuthProvider>
    </HashRouter>
  );
}
