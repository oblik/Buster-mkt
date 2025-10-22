import { useState, useEffect, useCallback } from "react";
import { provider, ensureBaseWalletLinked } from "@/lib/baseAccount";
import { useAccount } from "wagmi";

interface UseSubAccountReturn {
  subAccount: string | null;
  universalAccount: string | null;
  isReady: boolean;
  error: string | null;
  isInitializing: boolean;
}

/**
 * Hook to initialize and manage Sub Accounts
 *
 * Following the Base team demo pattern:
 * 1. Wait for wagmi wallet connection
 * 2. Call wallet_connect on Base Account provider (links to connected wallet)
 * 3. Call eth_requestAccounts to get sub account (auto-created via SDK config)
 * 4. Sub account is index 0, universal account is index 1 (because defaultAccount: 'sub')
 */
export function useSubAccount(options?: {
  enabled?: boolean;
}): UseSubAccountReturn {
  const enabled = options?.enabled ?? false;
  const { address: connectedAddress, isConnected } = useAccount();
  const [subAccount, setSubAccount] = useState<string | null>(null);
  const [universalAccount, setUniversalAccount] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeSubAccount = useCallback(async () => {
    if (!enabled || !isConnected || !connectedAddress) {
      setIsReady(false);
      setSubAccount(null);
      setUniversalAccount(null);
      return;
    }

    try {
      setIsInitializing(true);
      setError(null);

      console.log("🔄 Connecting Base Account SDK to wallet...");

      // Step 1: Link Base provider once per session to avoid repeated popups
      await ensureBaseWalletLinked();
      console.log("✅ SDK connected to wallet");

      // Step 2: Get accounts
      // Prefer eth_accounts to avoid any popup; fallback to eth_requestAccounts if empty
      let accounts = (await provider.request({
        method: "eth_accounts",
        params: [],
      })) as string[];

      if (!accounts || accounts.length === 0) {
        accounts = (await provider.request({
          method: "eth_requestAccounts",
          params: [],
        })) as string[];
      }

      console.log("✅ Accounts from Base Account provider:", accounts);

      if (accounts.length >= 2) {
        // With defaultAccount: 'sub', sub account is first
        setSubAccount(accounts[0]);
        setUniversalAccount(accounts[1]);
        setIsReady(true);
        console.log("✅ Sub account ready:", accounts[0]);
        console.log("✅ Universal account:", accounts[1]);
      } else if (accounts.length === 1) {
        // Only universal account available
        // Use it as fallback
        setSubAccount(accounts[0]);
        setUniversalAccount(accounts[0]);
        setIsReady(true);
        console.log("⚠️ Using universal account only:", accounts[0]);
      } else {
        throw new Error("No accounts available");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to initialize sub account";
      setError(errorMessage);
      console.error("❌ Sub account initialization error:", err);
      setIsReady(false);
    } finally {
      setIsInitializing(false);
    }
  }, [enabled, isConnected, connectedAddress]);

  useEffect(() => {
    if (enabled && isConnected && connectedAddress) {
      initializeSubAccount();
    } else {
      setSubAccount(null);
      setUniversalAccount(null);
      setIsReady(false);
    }
  }, [enabled, isConnected, connectedAddress, initializeSubAccount]);

  return {
    subAccount,
    universalAccount,
    isReady,
    error,
    isInitializing,
  };
}
