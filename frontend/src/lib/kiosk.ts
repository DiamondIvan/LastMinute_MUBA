import { KioskClient, KioskTransaction } from '@mysten/kiosk';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { RESEARCH_REPORT_TYPE, REPORT_PRICE_MIST } from '../contracts/constants';

/**
 * Sui Kiosk + Transfer Policy (royalty resales).
 *
 * Wraps the @mysten/kiosk SDK so AI report objects are managed through the
 * platform Kiosk. A TransferPolicy (with a royalty rule) ensures that whenever
 * a report is resold on any secondary market, a royalty is routed back to the
 * original creator.
 *
 * This module provides:
 *   - a shared KioskClient (read/list kiosks, transfer policies)
 *   - a helper to build the PTB that purchases a report via the Kiosk,
 *     resolving the transfer policy (royalty) in the same transaction.
 */

const TESTNET_GRPC_URL = 'https://fullnode.testnet.sui.io:443';

let _client: SuiGrpcClient | null = null;
let _kioskClient: KioskClient | null = null;

function suiClient(): SuiGrpcClient {
  if (!_client) {
    _client = new SuiGrpcClient({
      network: 'testnet' as const,
      baseUrl: TESTNET_GRPC_URL,
    });
  }
  return _client;
}

export function kioskClient(): KioskClient {
  if (!_kioskClient) {
    _kioskClient = new KioskClient({
      client: suiClient() as any,
      network: 'testnet' as const,
    });
  }
  return _kioskClient;
}

/**
 * Builds a Kiosk purchase-and-resolve transaction: buys `reportObjectId` from
 * the seller (platform) kiosk, resolving the transfer policy so the royalty
 * rule pays the creator. This replaces the simple `purchase_report` PTB with a
 * Kiosk-mediated (resale-aware) purchase.
 *
 * NOTE: For buy-now without listing, the seller kiosk must contain the item.
 * The buyer's PTB resolves policies (royalty) automatically.
 */
export function buildPurchaseReportViaKioskTx(
  reportObjectId: string,
  sellerKioskId: string,
): Transaction {
  const tx = new Transaction();
  const kiosk = new KioskTransaction({
    transaction: tx,
    kioskClient: kioskClient(),
  });

  kiosk.purchaseAndResolve({
    itemType: RESEARCH_REPORT_TYPE,
    itemId: reportObjectId,
    price: BigInt(REPORT_PRICE_MIST),
    sellerKiosk: sellerKioskId,
  });

  kiosk.finalize();
  return tx;
}