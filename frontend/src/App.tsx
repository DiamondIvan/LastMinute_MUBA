import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LatestForecastScreen } from './screens/LatestForecastScreen';

function ProtectedRoute() {
  const account = useCurrentAccount();
  if (!account) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/forecast" element={<LatestForecastScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}