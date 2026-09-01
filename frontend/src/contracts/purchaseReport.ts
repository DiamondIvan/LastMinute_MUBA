import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { PACKAGE_ID, CONFIG_ID, CLOCK_ID, REPORT_PRICE_MIST, SUBSCRIPTION_PRICE_MIST } from './constants';

/**
 * PTB for `news_platform::purchase_report(config, report, payment, clock)`.
 * The contract asserts `coin.value == report_price` exactly, so we split an
 * exact-balance coin with `coinWithBalance`.
 */
export function buildPurchaseReportTx(reportObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::news_platform::purchase_report`,
    arguments: [
      tx.object(CONFIG_ID),
      tx.object(reportObjectId),
      coinWithBalance({ balance: REPORT_PRICE_MIST }),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/** PTB for `news_platform::subscribe(config, payment, clock)`. */
export function buildSubscribeTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::news_platform::subscribe`,
    arguments: [
      tx.object(CONFIG_ID),
      coinWithBalance({ balance: SUBSCRIPTION_PRICE_MIST }),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}
