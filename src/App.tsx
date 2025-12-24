import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Dashboard } from '@/pages/Dashboard';
import { Inventory } from '@/pages/Inventory';
import { POS } from '@/pages/POS';
import { Reports } from '@/pages/Reports';
import { Users } from '@/pages/Users';
import { AcceptInvite } from '@/pages/AcceptInvite';

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginForm />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute requiredRole="admin">
              <Inventory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pos"
          element={
            <ProtectedRoute requiredRole="seller">
              <POS />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredRole="admin">
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;