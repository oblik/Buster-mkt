"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  type BaseError,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Loader2, Gift, Users } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { V2contractAddress, V2contractAbi } from "@/constants/contract";
import { formatPrice } from "@/lib/utils";

interface FreeTokenClaimButtonProps {
  marketId: number;
  onClaimComplete?: () => void;
  className?: string;
}

export function FreeTokenClaimButton({
  marketId,
  onClaimComplete,
  className,
}: FreeTokenClaimButtonProps) {
  const { address } = useAccount();
  const { toast } = useToast();

  const {
    data: hash,
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
  } = (useWriteContract as any)();

  const {
    isLoading: isConfirming,
    isSuccess: isTxConfirmed,
    error: txError,
  } = useWaitForTransactionReceipt({ hash });

  const [hasClaimed, setHasClaimed] = useState(false);

  // Check if user has already claimed free tokens
  const { data: claimStatus, refetch: refetchClaimStatus } = (
    useReadContract as any
  )({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "hasUserClaimedFreeTokens",
    args: [BigInt(marketId), address as `0x${string}`],
    query: {
      enabled: !!address,
      refetchInterval: 5000, // Check every 5 seconds
    },
  });

  // Fetch free market info (expanded tuple per ABI: 6 values)
  // getFreeMarketInfo returns:
  // [0] maxFreeParticipants (uint256)
  // [1] tokensPerParticipant (uint256)
  // [2] currentFreeParticipants (uint256)
  // [3] totalPrizePool (uint256)
  // [4] remainingPrizePool (uint256)
  // [5] isActive (bool)
  const { data: freeMarketInfo } = (useReadContract as any)({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getFreeMarketInfo",
    args: [BigInt(marketId)],
    query: {
      refetchInterval: 10000, // Refresh every 10 seconds
    },
  });

  // Fetch basic info to reliably determine marketType (avoid brittle indexing of legacy getMarketInfo)
  const { data: marketBasic } = (useReadContract as any)({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getMarketBasicInfo",
    args: [BigInt(marketId)],
    query: {
      refetchInterval: 30000, // Check every 30 seconds for market type
    },
  });

  const isLoading = isWritePending || isConfirming;
  const _claimStatus = claimStatus as [boolean, bigint] | undefined;
  const hasUserClaimed = _claimStatus ? _claimStatus[0] : false;
  const tokensReceived = _claimStatus ? _claimStatus[1] : 0n;

  // Parse free market info with new shape
  type FreeMarketInfoTuple =
    | [
        bigint, // maxFreeParticipants
        bigint, // tokensPerParticipant
        bigint, // currentFreeParticipants
        bigint, // totalPrizePool
        bigint, // remainingPrizePool
        boolean // isActive
      ]
    | undefined;
  const _freeMarketInfo = freeMarketInfo as FreeMarketInfoTuple;
  const maxParticipants = _freeMarketInfo ? _freeMarketInfo[0] : 0n;
  const tokensPerParticipant = _freeMarketInfo ? _freeMarketInfo[1] : 0n;
  const currentParticipants = _freeMarketInfo ? _freeMarketInfo[2] : 0n;
  const totalPrizePool = _freeMarketInfo ? _freeMarketInfo[3] : 0n;
  const remainingPrizePool = _freeMarketInfo ? _freeMarketInfo[4] : 0n;
  const freeIsActive = _freeMarketInfo ? _freeMarketInfo[5] : false;
  const slotsRemaining = maxParticipants - currentParticipants;

  // getMarketBasicInfo returns tuple: (question, description, endTime, category, optionCount, resolved, marketType, invalidated, totalVolume)
  const _basic = marketBasic as
    | [string, string, bigint, number, bigint, boolean, number, boolean, bigint]
    | undefined;
  const marketType = _basic ? _basic[6] : undefined;
  const isFreeMarket = marketType === 1;

  // Debug visibility reasoning
  useEffect(() => {
    if (!address) {
      console.debug("[FreeTokenClaimButton] Hidden: no connected address");
      return;
    }
    if (marketType !== undefined && marketType !== 1) {
      console.debug(
        `[FreeTokenClaimButton] Hidden: marketType=${marketType} (not free)`
      );
    }
    if (_freeMarketInfo && !freeIsActive) {
      console.debug(
        `[FreeTokenClaimButton] Hidden: free market inactive isActive=${freeIsActive}`
      );
    }
    if (hasUserClaimed) {
      console.debug("[FreeTokenClaimButton] Hidden: user already claimed");
    }
    if (_freeMarketInfo && slotsRemaining <= 0n) {
      console.debug(
        `[FreeTokenClaimButton] Slots exhausted: ${currentParticipants.toString()}/${maxParticipants.toString()}`
      );
    }
  }, [
    address,
    marketType,
    _freeMarketInfo,
    freeIsActive,
    hasUserClaimed,
    slotsRemaining,
    currentParticipants,
    maxParticipants,
  ]);

  const handleClaimFreeTokens = async () => {
    if (!address) {
      toast({
        title: "Error",
        description: "Please connect your wallet.",
        variant: "destructive",
      });
      return;
    }

    if (hasUserClaimed) {
      toast({
        title: "Already Claimed",
        description:
          "You have already claimed your free tokens for this market.",
        variant: "destructive",
      });
      return;
    }

    if (slotsRemaining <= 0n) {
      toast({
        title: "No Slots Available",
        description: "All free token slots have been claimed for this market.",
        variant: "destructive",
      });
      return;
    }

    try {
      await writeContractAsync({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "claimFreeTokens",
        args: [BigInt(marketId)],
      });
    } catch (error: unknown) {
      console.error("Free token claim error:", error);
      let errorMessage = "An unexpected error occurred.";

      if (error instanceof Error) {
        const baseError = error as BaseError;
        errorMessage = baseError?.shortMessage || error.message;

        // Handle specific contract errors
        if (errorMessage.includes("AlreadyClaimedFree")) {
          errorMessage =
            "You have already claimed free tokens for this market.";
        } else if (errorMessage.includes("FreeSlotseFull")) {
          errorMessage = "All free token slots have been claimed.";
        } else if (errorMessage.includes("FreeEntryInactive")) {
          errorMessage = "Free token claiming is not active for this market.";
        } else if (errorMessage.includes("NotFreeMarket")) {
          errorMessage = "This is not a free entry market.";
        }
      }

      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isTxConfirmed) {
      toast({
        title: "Free Tokens Claimed!",
        description: `You've claimed ${formatPrice(
          tokensPerParticipant,
          18
        )} free tokens for this market.`,
      });
      setHasClaimed(true);
      refetchClaimStatus();
      onClaimComplete?.();
    }

    if (txError || writeError) {
      const errorToShow = txError || writeError;
      let message =
        (errorToShow as BaseError)?.shortMessage || "Transaction failed.";

      if (message.toLowerCase().includes("already claimed")) {
        message = "Already claimed free tokens for this market.";
        setHasClaimed(true);
      }

      toast({
        title: "Claim Failed",
        description: message,
        variant: "destructive",
      });
    }
  }, [
    isTxConfirmed,
    txError,
    writeError,
    toast,
    onClaimComplete,
    tokensPerParticipant,
    refetchClaimStatus,
  ]);

  // Update local state when contract data changes
  useEffect(() => {
    setHasClaimed(hasUserClaimed);
  }, [hasUserClaimed]);

  // Don't show if not connected, not a free market, or already claimed
  if (!address || !isFreeMarket || hasUserClaimed || !freeIsActive) {
    return null;
  }

  // Don't show if no slots remaining
  if (slotsRemaining <= 0n) {
    return (
      <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
        <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
          <Users className="h-4 w-4" />
          <span className="text-sm">
            All free token slots have been claimed
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Free Market Info */}
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Free Entry Market
          </span>
        </div>
        <div className="space-y-1 text-xs text-green-700 dark:text-green-300">
          <div className="flex justify-between">
            <span>Free tokens per user:</span>
            <span className="font-medium">
              {formatPrice(tokensPerParticipant, 18)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Slots remaining:</span>
            <span className="font-medium">
              {slotsRemaining.toString()}/{maxParticipants.toString()}
            </span>
          </div>
        </div>
      </div>

      {/* Claim Button */}
      <Button
        onClick={handleClaimFreeTokens}
        disabled={isLoading || hasUserClaimed || slotsRemaining <= 0n}
        className={`w-full bg-green-600 hover:bg-green-700 text-white ${
          className || ""
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Claiming...
          </>
        ) : (
          <>
            <Gift className="mr-2 h-4 w-4" />
            Claim {formatPrice(tokensPerParticipant, 18)} Free Tokens
          </>
        )}
      </Button>
    </div>
  );
}
