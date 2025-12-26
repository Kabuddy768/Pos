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
import { ErrorBoundary, RouteErrorBoundary } from '@/components/common/ErrorBoundary';

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    // Top-level error boundary catches any unhandled errors in the entire app
    <ErrorBoundary
      context={{ component: 'App', level: 'root' }}
      onError={(error) => {
        // You can add error reporting service here
        console.error('Root error boundary caught error:', error);
      }}
    >
      <Router>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              <RouteErrorBoundary routeName="Login">
                <LoginForm />
              </RouteErrorBoundary>
            } 
          />
          <Route 
            path="/invite/:token" 
            element={
              <RouteErrorBoundary routeName="AcceptInvite">
                <AcceptInvite />
              </RouteErrorBoundary>
            } 
          />

          {/* Protected routes - each wrapped in its own error boundary */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RouteErrorBoundary routeName="Dashboard">
                  <Dashboard />
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route
            path="/inventory"
            element={
              <ProtectedRoute requiredRole="admin">
                <RouteErrorBoundary routeName="Inventory">
                  <Inventory />
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route
            path="/pos"
            element={
              <ProtectedRoute requiredRole="seller">
                <RouteErrorBoundary routeName="POS">
                  <POS />
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <RouteErrorBoundary routeName="Users">
                  <Users />
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRole="admin">
                <RouteErrorBoundary routeName="Reports">
                  <Reports />
                </RouteErrorBoundary>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;


// ## What changed:

// 1. **Added imports**:
//    - `ErrorBoundary` - Top-level error boundary
//    - `RouteErrorBoundary` - Route-specific error boundaries

// 2. **Wrapped entire app**:
//    - Root `ErrorBoundary` catches any unhandled errors
//    - Includes context for debugging
//    - Optional `onError` callback for error reporting

// 3. **Wrapped each route**:
//    - Each route has its own `RouteErrorBoundary`
//    - If one page crashes, others remain functional
//    - Route name is included in error context

// 4. **Error isolation**:
//    - Login page error won't crash Dashboard
//    - POS error won't crash Reports
//    - Better user experience

// ---

// ## Error Boundary Hierarchy:
// ```
// App (Root ErrorBoundary)
// ├── Router
//     ├── Login (RouteErrorBoundary)
//     ├── AcceptInvite (RouteErrorBoundary)
//     ├── Dashboard (RouteErrorBoundary)
//     ├── Inventory (RouteErrorBoundary)
//     ├── POS (RouteErrorBoundary)
//     ├── Users (RouteErrorBoundary)
//     └── Reports (RouteErrorBoundary)