import { useState, useCallback, useEffect } from "react";
import {
  requestSpendPermission,
  prepareSpendCallData,
} from "@base-org/account/spend-permission";
import { provider } from "@/lib/baseAccount";
import { tokenAddress } from "@/constants/contract";
import { base } from "viem/chains";

// Type from @base-org/account internal types
type SpendPermission = {
  createdAt?: number;
  permissionHash?: string;
  signature: string;
  chainId?: number;
  permission: {
    account: string;
    spender: string;
    token: string;
    allowance: string;
    period: number;
    start: number;
    end: number;
    salt: string;
    extraData: string;
  };
};

interface UseSpendPermissionReturn {
  permission: SpendPermission | null;
  isActive: boolean;
  remainingSpend: bigint;
  requestPermission: (params: {
    allowance: bigint;
    periodInDays?: number;
  }) => Promise<SpendPermission>;
  checkPermission: () => Promise<void>;
  prepareSpendCalls: (amount: bigint) => Promise<any[]>;
  loading: boolean;
  error: string | null;
}

export function useSpendPermission(
  account: string | undefined,
  spender: string | undefined
): UseSpendPermissionReturn {
  const [permission, setPermission] = useState<SpendPermission | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [remainingSpend, setRemainingSpend] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check existing permission status
  const checkPermission = useCallback(async () => {
    if (!account || !spender || !permission) {
      setIsActive(false);
      setRemainingSpend(0n);
      return;
    }

    try {
      setError(null);

      // Check if permission is still valid
      const now = Math.floor(Date.now() / 1000);
      const isValid =
        permission.permission.start <= now &&
        permission.permission.end > now &&
        remainingSpend > 0n;

      setIsActive(isValid);
    } catch (err) {
      console.error("Error checking permission:", err);
      setError(
        err instanceof Error ? err.message : "Failed to check permission"
      );
      setIsActive(false);
    }
  }, [account, spender, permission, remainingSpend]);

  // Request new permission
  const requestPermission = useCallback(
    async ({
      allowance,
      periodInDays = 30,
    }: {
      allowance: bigint;
      periodInDays?: number;
    }) => {
      if (!account) {
        throw new Error("Account not connected");
      }
      if (!spender) {
        throw new Error("Spender account not ready");
      }

      try {
        setLoading(true);
        setError(null);

        const newPermission = await requestSpendPermission({
          account: account as `0x${string}`,
          spender: spender as `0x${string}`,
          token: tokenAddress as `0x${string}`,
          chainId: base.id,
          allowance,
          periodInDays,
          provider,
        });

        setPermission(newPermission);
        setIsActive(true);
        setRemainingSpend(allowance);

        return newPermission;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to request permission";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [account, spender]
  );

  // Prepare spend calls for a transaction
  const prepareSpendCalls = useCallback(
    async (amount: bigint) => {
      if (!permission) {
        throw new Error("No permission available");
      }

      try {
        const spendCalls = await prepareSpendCallData(permission, amount);

        // Update remaining spend estimate
        if (remainingSpend >= amount) {
          setRemainingSpend(remainingSpend - amount);
        }

        return spendCalls;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to prepare spend calls";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [permission, remainingSpend]
  );

  // Check permission status periodically
  useEffect(() => {
    if (permission) {
      checkPermission();
      const interval = setInterval(checkPermission, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [permission, checkPermission]);

  return {
    permission,
    isActive,
    remainingSpend,
    requestPermission,
    checkPermission,
    prepareSpendCalls,
    loading,
    error,
  };
}
