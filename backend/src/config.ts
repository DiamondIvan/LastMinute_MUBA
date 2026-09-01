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

  walrus: {
    publisherUrl: optional('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
    aggregatorUrl: optional('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
    epochs: Number(optional('WALRUS_EPOCHS', '5')),
  },

  // Read directly by the Anthropic SDK; kept here only for a startup readiness check.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
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
