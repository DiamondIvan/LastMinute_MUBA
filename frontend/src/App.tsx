import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit-react';

// --- Temporary Placeholders for Phase 2 & 3 ---
function LoginScreen() {
  const account = useCurrentAccount();
  if (account) return <Navigate to="/dashboard" replace />;
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-10 rounded-3xl shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-4">Login Placeholder</h1>
        <p className="text-gray-500">Waiting for Phase 2 dual-login UI.</p>
      </div>
    </div>
  );
}

function DashboardLayout() {
  return (
    <div className="min-h-screen p-6">
      <div className="bg-white h-[90vh] rounded-4xl shadow-sm flex items-center justify-center">
        <h1 className="text-2xl font-bold">Dashboard Placeholder</h1>
      </div>
    </div>
  );
}

// --- The Authentication Guard ---
function ProtectedRoute() {
  const account = useCurrentAccount();
  
  // If no wallet is connected, redirect to login
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  
  // Otherwise, render the nested dashboard routes
  return <Outlet />;
}

// --- App Root ---
// Note: Keep your existing DAppKitProvider / QueryClient wrappers inside main.tsx
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />} />
        </Route>

        {/* Catch-all redirects */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}