import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional('PORT', '8787')),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),

  sui: {
    network: optional('SUI_NETWORK', 'testnet') as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
    grpcUrl: optional('SUI_GRPC_URL', 'https://fullnode.testnet.sui.io:443'),
  },

  contracts: {
    packageId: process.env.PACKAGE_ID ?? '',
    configId: process.env.CONFIG_ID ?? '',
    adminCapId: process.env.ADMIN_CAP_ID ?? '',
  },

  // A registered ResearchReport object id for the demo flow. Set after
  // `register_report` (see repo README).
  demoReportObjectId: process.env.DEMO_REPORT_OBJECT_ID ?? '',

  walrus: {
    publisherUrl: optional('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
    aggregatorUrl: optional('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
    epochs: Number(optional('WALRUS_EPOCHS', '5')),
  },

  // Seal (KMS) — encrypt premium reports; policy-gated decryption.
  seal: {
    // Key server object IDs on the current network. Leave empty on testnet to
    // use the demo/placeholder servers handled by the Seal SDK defaults.
    keyServer0: process.env.SEAL_KEY_SERVER_0 ?? '',
    keyServer1: process.env.SEAL_KEY_SERVER_1 ?? '',
  },

  // Enoki (zkLogin) — social login + gas sponsorship.
  enoki: {
    apiKey: process.env.ENOKI_API_KEY ?? '',
    clientId: process.env.ENOKI_CLIENT_ID ?? '',
  },

  authSessionSecret: optional('AUTH_SESSION_SECRET', 'dev-only-change-me'),
};

/** Throws if the vars needed to actually touch the chain are missing. */
export function assertChainConfig(): void {
  required('ADMIN_SECRET_KEY');
  if (!config.contracts.packageId) throw new Error('Missing required env var: PACKAGE_ID');
  if (!config.contracts.configId) throw new Error('Missing required env var: CONFIG_ID');
  if (!config.contracts.adminCapId) throw new Error('Missing required env var: ADMIN_CAP_ID');
}

export function chainConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_SECRET_KEY &&
      config.contracts.packageId &&
      config.contracts.configId &&
      config.contracts.adminCapId,
  );
}