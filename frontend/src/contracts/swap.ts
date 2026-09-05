import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { SWAP_PACKAGE_ID, SWAP_CONFIG_ID, SWAP_TESTUSD_TYPE } from './constants';

/**
 * PTB for `swap::swap_sui_to_testusd_and_transfer(config, payment)`.
 * Spends `suiMist` of SUI at the contract's current oracle price and sends
 * the minted TestUSD to the sender.
 */
export function buildSwapSuiToTestUsdTx(suiMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SWAP_PACKAGE_ID}::swap::swap_sui_to_testusd_and_transfer`,
    arguments: [tx.object(SWAP_CONFIG_ID), coinWithBalance({ balance: suiMist })],
  });
  return tx;
}

/**
 * PTB for `swap::swap_testusd_to_sui_and_transfer(config, payment)`.
 * Burns `testUsdRaw` (6-decimal) TestUSD and sends the SUI payout to the
 * sender. Aborts on-chain if the contract's SUI reserve can't cover it.
 */
export function buildSwapTestUsdToSuiTx(testUsdRaw: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SWAP_PACKAGE_ID}::swap::swap_testusd_to_sui_and_transfer`,
    arguments: [
      tx.object(SWAP_CONFIG_ID),
      coinWithBalance({ balance: testUsdRaw, type: SWAP_TESTUSD_TYPE }),
    ],
  });
  return tx;
}
