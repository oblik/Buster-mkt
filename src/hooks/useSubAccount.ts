import { useState, useEffect, useCallback } from "react";
import { provider } from "@/lib/baseAccount";
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
export function useSubAccount(): UseSubAccountReturn {
  const { address: connectedAddress, isConnected } = useAccount();
  const [subAccount, setSubAccount] = useState<string | null>(null);
  const [universalAccount, setUniversalAccount] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeSubAccount = useCallback(async () => {
    if (!isConnected || !connectedAddress) {
      setIsReady(false);
      setSubAccount(null);
      setUniversalAccount(null);
      return;
    }

    try {
      setIsInitializing(true);
      setError(null);

      console.log("🔄 Connecting Base Account SDK to wallet...");

      // Step 1: Connect SDK to the wallet (that's already connected via wagmi)
      // This tells the SDK about the wallet connection
      try {
        await provider.request({
          method: "wallet_connect",
          params: [],
        });
        console.log("✅ SDK connected to wallet");
      } catch (connectError: any) {
        // If already connected, this might throw - that's okay
        if (connectError?.message?.includes("already connected")) {
          console.log("ℹ️ SDK already connected to wallet");
        } else {
          throw connectError;
        }
      }

      // Step 2: Request accounts (triggers sub account creation if needed)
      // With creation: "on-connect" and defaultAccount: "sub", this will:
      // - Auto-create a sub account if it doesn't exist
      // - Return [subAccount, universalAccount]
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];

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
  }, [isConnected, connectedAddress]);

  useEffect(() => {
    if (isConnected && connectedAddress) {
      initializeSubAccount();
    } else {
      setSubAccount(null);
      setUniversalAccount(null);
      setIsReady(false);
    }
  }, [isConnected, connectedAddress, initializeSubAccount]);

  return {
    subAccount,
    universalAccount,
    isReady,
    error,
    isInitializing,
  };
}
