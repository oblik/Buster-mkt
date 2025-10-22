import { createBaseAccountSDK } from "@base-org/account";
import { base } from "viem/chains";

/**
 * Base Account SDK Configuration & Initialization
 *
 * Following the official Base team demo pattern:
 * - SDK is initialized immediately (not waiting for wallet connection)
 * - Provider is created once and reused
 * - SDK handles its own wallet connection when triggered
 * - This works seamlessly with wallets already connected via wagmi
 */

/**
 * Initialize Base Account SDK globally
 *
 * This creates the SDK instance immediately, following the pattern from
 * the official Base Account demo. The SDK will connect to the wallet
 * when wallet_connect is called, even if the wallet was connected via wagmi.
 */
export const sdk = createBaseAccountSDK({
  appName: "Policast",
  appLogoUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/icon.jpg`
    : "https://buster-mkt.vercel.app/banner2.avif",
  appChainIds: [base.id],
  subAccounts: {
    creation: "on-connect", // Auto-create sub account on wallet connect
    defaultAccount: "sub", // Use sub account as default for transactions
    // Enable automatic spend-permissions based funding when needed
    funding: "spend-permissions",
  },
  // Optional: Enable gas sponsorship if you have a paymaster
  paymasterUrls: process.env.NEXT_PUBLIC_PAYMASTER_URL
    ? {
        [base.id]: process.env.NEXT_PUBLIC_PAYMASTER_URL,
      }
    : undefined,
});

/**
 * Get provider from SDK
 *
 * This provider wraps window.ethereum and adds Base Account functionality.
 * It can be used for all transactions, including sub account operations.
 */
export const provider = sdk.getProvider();
