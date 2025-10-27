"use client";

import { useEffect, useState } from "react";
import { MarketCard, Market } from "./marketCard";
import { MarketV2Card } from "./market-v2-card";
import { MarketCardSkeleton } from "./market-card-skeleton";
import {
  MarketV2,
  Market as MarketV1Types,
  MarketType,
  MarketCategory as MarketCategoryEnum,
  MarketOption,
} from "@/types/types";
import {
  V2contractAddress,
  V2contractAbi,
  publicClient,
} from "@/constants/contract";
import { Input } from "./ui/input";
import { Search, Filter, X } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { getTotalMarketCount, fetchMarketData } from "@/lib/market-migration";
import { subgraphClient } from "@/lib/subgraph";
import { gql } from "graphql-request";
import { CATEGORY_LABELS, MarketCategory } from "@/lib/constants";
import { cachedSubgraphRequest } from "@/lib/subgraph-cache";

interface ValidatedMarketListProps {
  filter: "active" | "pending" | "resolved";
  showOnlyValidated?: boolean;
}
//
interface MarketWithVersion {
  id: number;
  version: "v1" | "v2";
  market: Market | MarketV2;
  validated: boolean;
}

// Helper function to convert MarketV1Types to Market (for compatibility)
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

// Subgraph-backed validation check via MarketValidated events
async function getValidatedSet(limit: number): Promise<Set<string>> {
  const QUERY = gql`
    query Validations($first: Int!) {
      marketValidateds(
        first: $first
        orderBy: blockTimestamp
        orderDirection: desc
      ) {
        marketId
      }
    }
  `;
  try {
    const data = (await subgraphClient.request(QUERY, { first: limit })) as any;
    return new Set<string>(
      (data?.marketValidateds || []).map((v: any) => String(v.marketId))
    );
  } catch (e) {
    console.error("Failed to fetch validations from subgraph", e);
    return new Set<string>();
  }
}

export function ValidatedMarketList({
  filter,
  showOnlyValidated = true,
}: ValidatedMarketListProps) {
  const [markets, setMarkets] = useState<MarketWithVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch a subgraph slice of recent V2 markets and their validation/resolve/invalidated status
        const first = 80;
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
            marketValidateds(
              first: $first
              orderBy: blockTimestamp
              orderDirection: desc
            ) {
              marketId
            }
          }
        `;

        let v2Items: MarketWithVersion[] = [];
        try {
          // Use cached request with 60 second TTL to prevent rate limiting
          // Cache key includes filter to avoid stale data
          const data = await cachedSubgraphRequest(
            `validated-markets-v2-${filter}-${first}`,
            () => subgraphClient.request(QUERY, { first }) as Promise<any>,
            60000 // 60 seconds - longer cache to reduce API calls
          );

          const resolvedMap = new Map<string, string | null>();
          for (const r of data?.marketResolveds || []) {
            resolvedMap.set(String(r.marketId), r.winningOptionId ?? null);
          }
          const invalidatedSet = new Set<string>(
            (data?.marketInvalidateds || []).map((i: any) => String(i.marketId))
          );
          const validatedSet = new Set<string>(
            (data?.marketValidateds || []).map((i: any) => String(i.marketId))
          );

          v2Items = (data?.marketCreateds || []).map((m: any) => {
            const idNum = Number(m.marketId);
            const optionNames: string[] = Array.isArray(m.options)
              ? m.options
              : [];
            const resolvedWinning = resolvedMap.get(String(m.marketId));

            // Convert string[] from subgraph to MarketOption[] expected by components
            const marketOptions: MarketOption[] = optionNames.map((name) => ({
              name: String(name),
              description: "",
              totalShares: 0n, // Will be fetched by market-v2-card via API
              totalVolume: 0n,
              currentPrice: 0n,
              isActive: !resolvedMap.has(String(m.marketId)),
            }));

            console.log(`[ValidatedMarketList] Market ${m.marketId}:`, {
              optionNames,
              marketOptionsCount: marketOptions.length,
              rawOptions: m.options,
            });

            const v2: MarketV2 = {
              question: String(m.question || ""),
              description: "",
              endTime: BigInt(m.endTime || 0),
              category: Number(m.category || 0) as MarketCategoryEnum,
              marketType: Number(m.marketType || 0) as MarketType,
              optionCount: BigInt(optionNames.length),
              options: marketOptions,
              resolved: resolvedMap.has(String(m.marketId)),
              disputed: false,
              validated: validatedSet.has(String(m.marketId)),
              invalidated: invalidatedSet.has(String(m.marketId)),
              winningOptionId: resolvedWinning ? BigInt(resolvedWinning) : 0n,
              creator: String(
                m.creator || "0x0000000000000000000000000000000000000000"
              ),
              createdAt: BigInt(m.blockTimestamp || 0),
              adminInitialLiquidity: 0n,
              userLiquidity: 0n,
              totalVolume: 0n,
              platformFeesCollected: 0n,
              ammFeesCollected: 0n,
              adminLiquidityClaimed: false,
              ammLiquidityPool: 0n,
              payoutIndex: 0n,
              freeConfig: undefined,
              ammConfig: undefined,
              earlyResolutionAllowed: false,
            };
            return {
              id: idNum,
              version: "v2",
              market: v2,
              validated: v2.validated,
            };
          });
        } catch (e) {
          console.error("Subgraph V2 fetch failed in ValidatedMarketList", e);
        }

        // Now include a small slice of V1 markets using on-chain util (always validated)
        const counts = await getTotalMarketCount();
        const v1MarketsToFetch = Math.min(counts.v1Count, 20);
        const v1Promises: Promise<MarketWithVersion>[] = [];
        for (
          let i = Math.max(0, counts.v1Count - v1MarketsToFetch);
          i < counts.v1Count;
          i++
        ) {
          v1Promises.push(
            fetchMarketData(i).then(({ version, market }) => ({
              id: i,
              version,
              validated: true,
              market:
                version === "v2"
                  ? (market as MarketV2)
                  : convertV1Market(market as MarketV1Types),
            }))
          );
        }
        const v1Settled = await Promise.allSettled(v1Promises);
        const v1Successful = v1Settled
          .filter(
            (r): r is PromiseFulfilledResult<MarketWithVersion> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value);

        const merged = [...v2Items, ...v1Successful];
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

  // Filter and search markets
  const filteredMarkets = markets
    .filter(({ market, validated }) => {
      const status = getMarketStatus(market);
      const statusMatch = status === filter;
      const validationMatch = showOnlyValidated ? validated : true;

      // Search filter
      const searchMatch = searchQuery
        ? market.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ("description" in market &&
            market.description
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()))
        : true;

      // Category filter for V2 markets
      const categoryMatch =
        categoryFilter === "all" ||
        ("category" in market &&
          market.category?.toString() === categoryFilter);

      return statusMatch && validationMatch && searchMatch && categoryMatch;
    })
    .sort((a, b) => {
      // Sorting logic
      switch (sortBy) {
        case "newest":
          return b.id - a.id;
        case "oldest":
          return a.id - b.id;
        case "ending-soon":
          const aEndTime =
            typeof a.market.endTime === "string"
              ? parseInt(a.market.endTime)
              : Number(a.market.endTime);
          const bEndTime =
            typeof b.market.endTime === "string"
              ? parseInt(b.market.endTime)
              : Number(b.market.endTime);
          return aEndTime - bEndTime;
        case "most-volume":
          const aVolume =
            "totalVolume" in a.market ? Number(a.market.totalVolume || 0) : 0;
          const bVolume =
            "totalVolume" in b.market ? Number(b.market.totalVolume || 0) : 0;
          return bVolume - aVolume;
        default:
          return b.id - a.id;
      }
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

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSortBy("newest");
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2 md:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto flex-nowrap">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-sm pl-8 md:pl-10 pr-8 md:pr-10 min-w-[160px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="block">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[120px] md:w-[180px] h-9 text-sm">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value={MarketCategory.POLITICS.toString()}>
                  {CATEGORY_LABELS[MarketCategory.POLITICS]}
                </SelectItem>
                <SelectItem value={MarketCategory.SPORTS.toString()}>
                  {CATEGORY_LABELS[MarketCategory.SPORTS]}
                </SelectItem>
                <SelectItem value={MarketCategory.ENTERTAINMENT.toString()}>
                  {CATEGORY_LABELS[MarketCategory.ENTERTAINMENT]}
                </SelectItem>
                <SelectItem value={MarketCategory.TECHNOLOGY.toString()}>
                  {CATEGORY_LABELS[MarketCategory.TECHNOLOGY]}
                </SelectItem>
                <SelectItem value={MarketCategory.ECONOMICS.toString()}>
                  {CATEGORY_LABELS[MarketCategory.ECONOMICS]}
                </SelectItem>
                <SelectItem value={MarketCategory.SCIENCE.toString()}>
                  {CATEGORY_LABELS[MarketCategory.SCIENCE]}
                </SelectItem>
                <SelectItem value={MarketCategory.WEATHER.toString()}>
                  {CATEGORY_LABELS[MarketCategory.WEATHER]}
                </SelectItem>
                <SelectItem value={MarketCategory.OTHER.toString()}>
                  {CATEGORY_LABELS[MarketCategory.OTHER]}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="block">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px] md:w-[180px] h-9 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="ending-soon">Ending Soon</SelectItem>
                <SelectItem value="most-volume">Most Volume</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          <div className="block">
            {(searchQuery ||
              categoryFilter !== "all" ||
              sortBy !== "newest") && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="whitespace-nowrap h-9"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="hidden md:block mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredMarkets.length} of{" "}
          {
            markets.filter(({ market, validated }) => {
              const status = getMarketStatus(market);
              const validationMatch = showOnlyValidated ? validated : true;
              return status === filter && validationMatch;
            }).length
          }{" "}
          markets
        </div>
      </div>

      {/* Markets Grid */}
      {filteredMarkets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500">
            {searchQuery || categoryFilter !== "all"
              ? "No markets match your filters."
              : `No ${
                  showOnlyValidated ? "validated " : ""
                }${filter} markets found.`}
          </p>
          {showOnlyValidated && !searchQuery && categoryFilter === "all" && (
            <p className="text-sm text-gray-400 mt-2">
              Markets must be validated by an admin before appearing here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMarkets.map(({ id, version, market, validated }) => {
            if (version === "v2") {
              return (
                <div key={`v2-${id}`} className="relative">
                  <MarketV2Card index={id} market={market as MarketV2} />
                  {!validated && (
                    <div className="absolute top-2 right-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded">
                      Pending Validation
                    </div>
                  )}
                </div>
              );
            } else {
              return (
                <div key={`v1-${id}`} className="relative">
                  <MarketCard index={id} market={market as Market} />
                  {!validated && (
                    <div className="absolute top-2 right-2 bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded">
                      Pending Validation
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
