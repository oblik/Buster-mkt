"use client";

import { useEffect, useState } from "react";
import { MarketCard, Market } from "./marketCard";
import { MarketV2Card } from "./market-v2-card";
import { MarketCardSkeleton } from "./market-card-skeleton";
import {
  MarketV2,
  Market as MarketV1Types,
  MarketType,
  MarketCategory,
} from "@/types/types";
import { getTotalMarketCount, fetchMarketData } from "@/lib/market-migration";
import { subgraphClient } from "@/lib/subgraph";
import { gql } from "graphql-request";
import { cachedSubgraphRequest } from "@/lib/subgraph-cache";

interface UnifiedMarketListProps {
  filter: "active" | "pending" | "resolved";
}

interface MarketWithVersion {
  id: number;
  version: "v1" | "v2";
  market: Market | MarketV2;
}

// Helper function to convert MarketV1Types to Market (for compatibility)//
function convertV1Market(market: MarketV1Types): Market {
  return {
    question: market.question,
    optionA: market.optionA,
    optionB: market.optionB,
    endTime: BigInt(market.endTime),
    outcome: parseInt(market.outcome),
    totalOptionAShares: BigInt(market.totalOptionAShares),
    totalOptionBShares: BigInt(market.totalOptionBShares),
    resolved: market.resolved,
  };
}

function getMarketStatus(
  market: Market | MarketV2
): "active" | "pending" | "resolved" {
  const now = Math.floor(Date.now() / 1000);
  // Handle both bigint and string endTime types
  const endTime =
    typeof market.endTime === "string"
      ? parseInt(market.endTime)
      : Number(market.endTime);
  const isExpired = endTime < now;
  const isResolved = market.resolved;

  if (isResolved) {
    return "resolved";
  } else if (isExpired) {
    return "pending";
  } else {
    return "active";
  }
}

export function UnifiedMarketList({ filter }: UnifiedMarketListProps) {
  const [markets, setMarkets] = useState<MarketWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);

        // We will fetch V2 markets from the subgraph (fast, no RPC), and keep a small slice of V1 via on-chain.
        const v2FromSubgraph: MarketWithVersion[] = await (async () => {
          try {
            const QUERY = gql`
              query RecentMarkets($first: Int!) {
                marketCreateds(
                  first: $first
                  orderBy: blockTimestamp
                  orderDirection: desc
                ) {
                  marketId
                  question
                  options
                  endTime
                  category
                  marketType
                  creator
                  blockTimestamp
                }
                marketResolveds(
                  first: $first
                  orderBy: blockTimestamp
                  orderDirection: desc
                ) {
                  marketId
                  winningOptionId
                }
                marketInvalidateds(
                  first: $first
                  orderBy: blockTimestamp
                  orderDirection: desc
                ) {
                  marketId
                }
              }
            `;

            const first = 60; // number of latest markets to list
            const data = await cachedSubgraphRequest(
              `unified-markets-v2-${first}`,
              () => subgraphClient.request(QUERY, { first }) as Promise<any>,
              60000 // 60 seconds
            );

            const resolvedMap = new Map<string, string | null>();
            for (const r of data?.marketResolveds || []) {
              resolvedMap.set(String(r.marketId), r.winningOptionId ?? null);
            }

            const invalidatedSet = new Set<string>(
              (data?.marketInvalidateds || []).map((i: any) =>
                String(i.marketId)
              )
            );

            const items: MarketWithVersion[] = (data?.marketCreateds || []).map(
              (m: any) => {
                const idNum = Number(m.marketId);
                const options: any[] = Array.isArray(m.options)
                  ? m.options
                  : [];
                const resolvedWinning = resolvedMap.get(String(m.marketId));
                const v2: MarketV2 = {
                  question: String(m.question || ""),
                  description: "",
                  endTime: BigInt(m.endTime || 0),
                  category: Number(m.category || 0) as MarketCategory,
                  marketType: Number(m.marketType || 0) as MarketType,
                  optionCount: BigInt(options.length),
                  // MarketV2Card can work with string[] fallback; cast to any to satisfy type
                  options: options as unknown as any,
                  resolved: resolvedMap.has(String(m.marketId)),
                  disputed: false,
                  validated: true,
                  invalidated: invalidatedSet.has(String(m.marketId)),
                  winningOptionId: resolvedWinning
                    ? BigInt(resolvedWinning)
                    : 0n,
                  creator: String(
                    m.creator || "0x0000000000000000000000000000000000000000"
                  ),
                  createdAt: BigInt(m.blockTimestamp || 0),
                  // Financials and pools (not needed for listing UI)
                  adminInitialLiquidity: 0n,
                  userLiquidity: 0n,
                  totalVolume: 0n,
                  platformFeesCollected: 0n,
                  ammFeesCollected: 0n,
                  adminLiquidityClaimed: false,
                  ammLiquidityPool: 0n,
                  payoutIndex: 0n,
                  // Configs
                  freeConfig: undefined,
                  ammConfig: undefined,
                  earlyResolutionAllowed: false,
                };
                return { id: idNum, version: "v2", market: v2 };
              }
            );

            return items;
          } catch (e) {
            console.error(
              "Subgraph fetch for V2 markets failed, falling back:",
              e
            );
            return [];
          }
        })();

        // Get V1 count and fetch a small recent window from on-chain
        const counts = await getTotalMarketCount();
        console.log("Market counts:", counts);

        const marketPromises: Promise<MarketWithVersion>[] = [];
        const v1MarketsToFetch = Math.min(counts.v1Count, 20);
        for (
          let i = Math.max(0, counts.v1Count - v1MarketsToFetch);
          i < counts.v1Count;
          i++
        ) {
          marketPromises.push(
            fetchMarketData(i).then(({ version, market }) => ({
              id: i,
              version,
              market:
                version === "v2"
                  ? (market as MarketV2)
                  : convertV1Market(market as MarketV1Types),
            }))
          );
        }

        const v1Results = await Promise.allSettled(marketPromises);
        const v1Successful = v1Results
          .filter(
            (r): r is PromiseFulfilledResult<MarketWithVersion> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value);

        const merged = [...v2FromSubgraph, ...v1Successful];
        merged.sort((a, b) => b.id - a.id);

        setMarkets(merged);
      } catch (err) {
        console.error("Error fetching markets:", err);
        setError("Failed to load markets");
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  // Filter markets based on status
  const filteredMarkets = markets.filter(({ market }) => {
    const status = getMarketStatus(market);
    return status === filter;
  });

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MarketCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (filteredMarkets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No {filter} markets found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {filteredMarkets.map(({ id, version, market }) => {
        if (version === "v2") {
          return (
            <MarketV2Card
              key={`v2-${id}`}
              index={id}
              market={market as MarketV2}
            />
          );
        } else {
          return (
            <MarketCard key={`v1-${id}`} index={id} market={market as Market} />
          );
        }
      })}
    </div>
  );
}
