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

      // Get accounts from provider (with auto sub account creation enabled via SDK config)
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];

      console.log("Accounts from Base Account provider:", accounts);

      if (accounts.length >= 2) {
        // With defaultAccount: 'sub', sub account is first
        setSubAccount(accounts[0]);
        setUniversalAccount(accounts[1]);
        setIsReady(true);
        console.log("Sub account initialized:", accounts[0]);
        console.log("Universal account:", accounts[1]);
      } else if (accounts.length === 1) {
        // Only universal account available
        // Sub account creation is handled automatically by the SDK
        // For now, use the universal account as fallback
        setSubAccount(accounts[0]);
        setUniversalAccount(accounts[0]);
        setIsReady(true);
        console.log("Using universal account (sub account pending):", accounts[0]);
      } else {
        throw new Error("No accounts available");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to initialize sub account";
      setError(errorMessage);
      console.error("Sub account initialization error:", err);
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

