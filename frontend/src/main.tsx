import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from './dapp-kit';
import { registerEnoki } from './lib/enoki';

import './index.css';

import App from './App';

// Register Enoki (zkLogin) social wallets — Google/Twitch — into dapp-kit so
// the ConnectButton offers seed-phrase-free login with Enoki gas sponsorship.
const unregisterEnoki = registerEnoki();

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <App />
      </DAppKitProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// Cleanup subscription on hot reload (dev convenience).
if (import.meta.hot) {
  import.meta.hot.dispose(() => unregisterEnoki?.unregister?.());
}