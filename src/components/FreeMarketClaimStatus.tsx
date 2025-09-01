"use client";

import { useAccount, useReadContract } from "wagmi";
import { V2contractAddress, V2contractAbi } from "@/constants/contract";
// import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, Clock } from "lucide-react";

interface FreeMarketClaimStatusProps {
  marketId: number;
  className?: string;
}

// Format price with proper decimals
function formatPrice(price: bigint, decimals: number = 18): string {
  const formatted = Number(price) / Math.pow(10, decimals);
  if (formatted < 0.01) return formatted.toFixed(4);
  if (formatted < 1) return formatted.toFixed(3);
  return formatted.toFixed(2);
}

export function FreeMarketClaimStatus({
  marketId,
  className = "",
}: FreeMarketClaimStatusProps) {
  const { address } = useAccount();

  // Check if user has claimed free tokens
  const { data: claimStatus } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "hasUserClaimedFreeTokens",
    args: [BigInt(marketId), address as `0x${string}`],
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    },
  });

  // Get free market info
  const { data: freeMarketInfo } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getFreeMarketInfo",
    args: [BigInt(marketId)],
    query: {
      refetchInterval: 15000,
    },
  });

  // Check if this is a free market
  const { data: marketInfo } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  });

  if (!address || !freeMarketInfo || !marketInfo) {
    return null;
  }

  // Check if market is free entry (marketType = 1)
  const isFreeMarket =
    marketInfo.length > 6 &&
    typeof marketInfo[6] === "bigint" &&
    marketInfo[6] === 1n;
  if (!isFreeMarket) {
    return null;
  }

  const hasUserClaimed = claimStatus ? claimStatus[0] : false;
  const tokensReceived = claimStatus ? claimStatus[1] : 0n;

  const maxParticipants = freeMarketInfo[0];
  const tokensPerParticipant = freeMarketInfo[1];
  const currentParticipants = freeMarketInfo[2];
  const slotsRemaining = maxParticipants - currentParticipants;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Status Badge */}
      {hasUserClaimed ? (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <Gift className="h-3 w-3 mr-1" />
          Claimed {formatPrice(tokensReceived, 18)} tokens
        </Badge>
      ) : slotsRemaining > 0n ? (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          {formatPrice(tokensPerParticipant, 18)} tokens available
        </Badge>
      ) : (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
          <Users className="h-3 w-3 mr-1" />
          All slots claimed
        </Badge>
      )}

      {/* Detailed Info */}
      {!hasUserClaimed && (
        <div className="text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Slots remaining:</span>
            <span className="font-medium">
              {slotsRemaining.toString()}/{maxParticipants.toString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
