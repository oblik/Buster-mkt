import { useState, useCallback, useEffect } from "react";
import {
  requestSpendPermission,
  prepareSpendCallData,
  fetchPermissions,
  getPermissionStatus,
} from "@base-org/account/spend-permission/browser";
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
  refreshPermission: () => Promise<void>;
  ensurePermissionFor: (minAmount: bigint) => Promise<SpendPermission>;
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

  // Internal: load latest permission from chain for this account/spender/token
  const refreshPermission = useCallback(async () => {
    if (!account || !spender) {
      setPermission(null);
      setIsActive(false);
      setRemainingSpend(0n);
      return;
    }
    try {
      setError(null);
      const perms = (await fetchPermissions({
        account: account as `0x${string}`,
        chainId: base.id,
        spender: spender as `0x${string}`,
        provider,
      })) as any[];

      // Filter by our token and choose the most recent permission if multiple exist
      const filtered = (perms || []).filter(
        (p: any) =>
          (p?.permission?.token || "").toLowerCase() ===
          tokenAddress.toLowerCase()
      );
      const latest = filtered?.[0] || null;
      if (!latest) {
        setPermission(null);
        setIsActive(false);
        setRemainingSpend(0n);
        return;
      }

      setPermission(latest as unknown as SpendPermission);

      // Compute status using SDK helper
      try {
        const status = (await getPermissionStatus(latest)) as any;
        const rem: bigint = BigInt(
          status?.remaining || status?.remainingSpend || 0
        );
        const active: boolean = Boolean(status?.isActive ?? rem > 0);
        setRemainingSpend(rem);
        setIsActive(active);
      } catch (e) {
        // Fallback: basic time-window check if helper unavailable
        const now = Math.floor(Date.now() / 1000);
        const isValid =
          latest.permission?.start <= now && latest.permission?.end > now;
        setIsActive(isValid);
        // unknown remaining; keep previous
      }
    } catch (err) {
      console.error("Error refreshing permission:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh permission"
      );
      setPermission(null);
      setIsActive(false);
      setRemainingSpend(0n);
    }
  }, [account, spender]);

  // Check existing permission status
  const checkPermission = useCallback(async () => {
    if (!account || !spender) {
      setIsActive(false);
      setRemainingSpend(0n);
      return;
    }
    try {
      setError(null);
      if (!permission) {
        await refreshPermission();
        return;
      }
      // Prefer SDK status
      try {
        const status = (await getPermissionStatus(permission)) as any;
        const rem: bigint = BigInt(
          status?.remaining || status?.remainingSpend || 0
        );
        const active: boolean = Boolean(status?.isActive ?? rem > 0);
        setRemainingSpend(rem);
        setIsActive(active);
      } catch {
        const now = Math.floor(Date.now() / 1000);
        const isValid =
          permission.permission.start <= now &&
          permission.permission.end > now &&
          remainingSpend > 0n;
        setIsActive(isValid);
      }
    } catch (err) {
      console.error("Error checking permission:", err);
      setError(
        err instanceof Error ? err.message : "Failed to check permission"
      );
      setIsActive(false);
    }
  }, [account, spender, permission, remainingSpend, refreshPermission]);

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

        console.log("🔐 Requesting spend permission:", {
          account,
          spender,
          token: tokenAddress,
          allowance: allowance.toString(),
          periodInDays,
        });

        const newPermission = await requestSpendPermission({
          account: account as `0x${string}`,
          spender: spender as `0x${string}`,
          token: tokenAddress as `0x${string}`,
          chainId: base.id,
          allowance,
          periodInDays,
          provider,
        });

        console.log("✅ Spend permission granted:", newPermission);

        setPermission(newPermission);
        // Compute status accurately
        try {
          const status = (await getPermissionStatus(newPermission)) as any;
          const rem: bigint = BigInt(
            status?.remaining || status?.remainingSpend || allowance
          );
          const active: boolean = Boolean(status?.isActive ?? rem > 0);
          setRemainingSpend(rem);
          setIsActive(active);
        } catch {
          setIsActive(true);
          setRemainingSpend(allowance);
        }

        return newPermission;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to request permission";
        console.error("❌ Permission request failed:", err);
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [account, spender]
  );

  // Ensure there is an active permission with at least minAmount remaining.
  const ensurePermissionFor = useCallback(
    async (minAmount: bigint): Promise<SpendPermission> => {
      // Refresh to get the latest on first
      await refreshPermission();

      if (permission && isActive && remainingSpend >= minAmount) {
        return permission;
      }

      const allowanceNeeded = minAmount * 10n; // cushion for multiple trades
      const newPerm = await requestPermission({
        allowance: allowanceNeeded,
        periodInDays: 30,
      });
      return newPerm;
    },
    [permission, isActive, remainingSpend, requestPermission, refreshPermission]
  );

  // Prepare spend calls for a transaction
  const prepareSpendCalls = useCallback(
    async (amount: bigint) => {
      if (!permission) {
        throw new Error("No permission available");
      }

      try {
        // Support both SDK signatures: object form and positional
        const prepareFn: any = prepareSpendCallData as unknown as any;
        let spendCalls: any[];
        try {
          spendCalls = await prepareFn({ permission, amount });
        } catch (_objSigErr) {
          // Fallback to positional signature for older SDK typings
          spendCalls = await prepareFn(permission, amount);
        }

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
    // Attempt to load permission and monitor status
    refreshPermission();
    const interval = setInterval(checkPermission, 30000);
    return () => clearInterval(interval);
  }, [refreshPermission, checkPermission]);

  return {
    permission,
    isActive,
    remainingSpend,
    requestPermission,
    checkPermission,
    refreshPermission,
    ensurePermissionFor,
    prepareSpendCalls,
    loading,
    error,
  };
}
