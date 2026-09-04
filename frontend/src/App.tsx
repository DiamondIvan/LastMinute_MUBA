import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LatestForecastScreen } from './screens/LatestForecastScreen';
import { NewsDeepDiveScreen } from './screens/NewsDeepDiveScreen';
import { TransactionScreen } from './screens/TransactionScreen';
import { CoinAnalysisScreen } from './screens/CoinAnalysisScreen';

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
          <Route path="/forecast/news" element={<NewsDeepDiveScreen />} />
          <Route path="/coin/:symbol" element={<CoinAnalysisScreen />} />
          <Route path="/transaction" element={<TransactionScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}