"use client";

import { useSpendPermission } from "@/hooks/useSpendPermission";
import { useSubAccount } from "@/hooks/useSubAccount";
import { useWallet } from "./WagmiProvider";
import { useAccount, useReadContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseUnits, formatUnits } from "viem";
import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { tokenAddress, tokenAbi } from "@/constants/contract";

export function SpendPermissionManager() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { seamlessMode, setSeamlessMode } = useWallet();
  const {
    subAccount,
    universalAccount,
    isReady: subAccountReady,
    isInitializing,
    error: subAccountError,
  } = useSubAccount({ enabled: seamlessMode });

  const [allowanceAmount, setAllowanceAmount] = useState("1000000");
  const [periodDays, setPeriodDays] = useState("30");

  // Fetch token decimals to format/parse correctly
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: tokenAbi,
    functionName: "decimals",
  });

  const {
    permission,
    isActive,
    remainingSpend,
    requestPermission,
    loading: permissionLoading,
    error: permissionError,
  } = useSpendPermission(
    universalAccount || undefined,
    subAccount || undefined
  );

  const handleRequestPermission = async () => {
    try {
      const allowance = parseUnits(
        allowanceAmount,
        typeof tokenDecimals === "number" ? tokenDecimals : 18
      );
      const periodInDays = Number(periodDays);

      await requestPermission({
        allowance,
        periodInDays,
      });

      toast({
        title: "Spend Permission Granted",
        description: `You can now trade up to ${allowanceAmount} tokens without wallet popups for ${periodDays} days.`,
      });
    } catch (err) {
      console.error("Failed to request permission:", err);
      toast({
        title: "Permission Request Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (!isConnected || !address) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Seamless Trading Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to enable seamless trading without popups.
          </p>
        </CardContent>
      </Card>
    );
  }

  // If user has not enabled seamless mode, offer to enable it
  if (!seamlessMode) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Seamless Trading (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enable Sub Accounts + Spend Permissions to trade without wallet
            popups. You can switch this off anytime.
          </p>
          <Button onClick={() => setSeamlessMode(true)} className="w-full">
            Enable Seamless Trading
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isInitializing) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Initializing Sub Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Setting up your trading account...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (subAccountError) {
    return (
      <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
            <AlertCircle className="h-5 w-5" />
            Sub Account Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-800 dark:text-red-200">
            {subAccountError}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Seamless Trading
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sub Account Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {subAccountReady ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
            )}
            <span className="text-sm font-medium">
              {subAccountReady ? "Sub Account Active" : "Setting up..."}
            </span>
          </div>
          {subAccount && (
            <p className="text-xs text-muted-foreground font-mono">
              {subAccount.slice(0, 6)}...{subAccount.slice(-4)}
            </p>
          )}
        </div>

        {/* Spend Permission Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {isActive ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
            <span className="text-sm font-medium">
              {isActive
                ? "Spend Permission Active"
                : "No Active Spend Permission"}
            </span>
          </div>

          {isActive && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900">
              <p className="text-sm text-green-900 dark:text-green-100">
                <span className="font-medium">Remaining Balance:</span>{" "}
                {formatUnits(
                  remainingSpend,
                  typeof tokenDecimals === "number" ? tokenDecimals : 18
                )}{" "}
                tokens
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                You can trade without wallet popups!
              </p>
            </div>
          )}

          {!isActive && subAccountReady && (
            <div className="space-y-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <p className="text-sm text-muted-foreground">
                Grant spend permission to enable seamless trading without wallet
                popups.
              </p>

              <div className="space-y-2">
                <Label htmlFor="allowance">Allowance Amount (tokens)</Label>
                <Input
                  id="allowance"
                  type="number"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  placeholder="1000"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period (days)</Label>
                <Input
                  id="period"
                  type="number"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(e.target.value)}
                  placeholder="30"
                  min="1"
                />
              </div>

              <Button
                onClick={handleRequestPermission}
                disabled={permissionLoading || !subAccountReady}
                className="w-full"
              >
                {permissionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Requesting Permission...
                  </>
                ) : (
                  "Grant Spend Permission"
                )}
              </Button>

              {permissionError && (
                <p className="text-sm text-red-600">{permissionError}</p>
              )}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            <strong>How it works:</strong> Once you grant spend permission, your
            sub account can spend tokens from your main account up to the
            allowance limit. All buy/sell transactions will execute instantly
            without wallet popups.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
