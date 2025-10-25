"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { subgraphClient } from "@/lib/subgraph";
import { gql } from "graphql-request";
import { useToast } from "@/components/ui/use-toast";
// No contract reads here; rely on subgraph and API-backed analytics
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Users,
  DollarSign,
  Clock,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

interface MarketAnalytics {
  marketId: number;
  question: string;
  description: string;
  category: number;
  optionCount: number;
  resolved: boolean;
  disputed: boolean;
  winningOptionId?: number;
  endTime: bigint;
  creator: string;

  // Options data
  options: {
    id: number;
    name: string;
    description: string;
    totalShares: bigint;
    totalVolume: bigint;
    currentPrice: bigint;
    isActive: boolean;
  }[];

  // Market stats
  totalVolume: bigint;
  participantCount: number;
  averagePrice: bigint;
  priceVolatility: bigint;
  lastTradePrice: bigint;
  lastTradeTime: bigint;

  // Price history (last 24h/7d data points)
  priceHistory: {
    timestamp: number;
    prices: number[];
    volume: number;
  }[];
}

interface MarketListItem {
  id: number;
  question: string;
  totalVolume: bigint;
  participantCount: number;
  resolved: boolean;
  endTime: bigint;
}

// Local constants (avoid on-chain token metadata lookups)
const DEFAULT_TOKEN_SYMBOL = "Buster";
const DEFAULT_TOKEN_DECIMALS = 18;

export function MarketAnalyticsV2() {
  const { toast } = useToast();

  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null);
  const [marketAnalytics, setMarketAnalytics] =
    useState<MarketAnalytics | null>(null);
  const [marketsList, setMarketsList] = useState<MarketListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [tokenSymbol] = useState<string>(DEFAULT_TOKEN_SYMBOL);
  const [tokenDecimals] = useState<number>(DEFAULT_TOKEN_DECIMALS);

  // Market listings come from the subgraph; no on-chain marketCount reads.

  // Fetch markets list from subgraph (recent by blockTimestamp)
  const {
    data: marketsData,
    isLoading: isLoadingMarkets,
    refetch: refetchMarkets,
  } = useQuery({
    queryKey: ["marketsList"],
    queryFn: async () => {
      const QUERY = gql`
        query RecentMarkets($first: Int!) {
          marketCreateds(
            first: $first
            orderBy: blockTimestamp
            orderDirection: desc
          ) {
            marketId
            question
            endTime
            creator
          }
          marketResolveds(
            first: $first
            orderBy: blockTimestamp
            orderDirection: desc
          ) {
            marketId
          }
        }
      `;
      const resp = (await subgraphClient.request(QUERY, { first: 50 })) as any;
      const resolvedSet = new Set(
        (resp?.marketResolveds || []).map((r: any) => String(r.marketId))
      );
      return (resp?.marketCreateds || []).map((m: any) => ({
        id: Number(m.marketId),
        question: String(m.question || ""),
        endTime: BigInt(m.endTime || 0),
        resolved: resolvedSet.has(String(m.marketId)),
      }));
    },
    enabled: true,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (marketsData && marketsData.length > 0) {
      const items = marketsData.map((m: any) => ({
        id: Number(m.id),
        question: String(m.question || ""),
        totalVolume: 0n as bigint,
        participantCount: 0,
        resolved: Boolean(m.resolved),
        endTime: BigInt(m.endTime || 0),
      }));
      setMarketsList(items);
      if (items.length > 0 && !selectedMarketId)
        setSelectedMarketId(items[0].id);
    }
    setIsLoading(isLoadingMarkets);
  }, [marketsData, isLoadingMarkets]);

  // Selected market details (from subgraph)
  const { data: selectedMarketData, refetch: refetchSelectedMarket } = useQuery(
    {
      queryKey: ["market", selectedMarketId],
      queryFn: async () => {
        if (!selectedMarketId) return null;
        const QUERY = gql`
          query MarketById($marketId: String!) {
            marketCreateds(where: { marketId: $marketId }) {
              marketId
              question
              description
              options
              endTime
              category
              creator
            }
            marketResolveds(where: { marketId: $marketId }) {
              winningOptionId
            }
          }
        `;
        const resp = (await subgraphClient.request(QUERY, {
          marketId: String(selectedMarketId),
        })) as any;
        const created = Array.isArray(resp?.marketCreateds)
          ? resp.marketCreateds[0]
          : null;
        const resolved = Array.isArray(resp?.marketResolveds)
          ? resp.marketResolveds[0]
          : null;
        if (!created) return null;
        return {
          id: created.marketId,
          question: created.question,
          description: created.description || "",
          options: created.options || [],
          endTime: created.endTime,
          category: created.category,
          creator: created.creator,
          resolved: !!resolved,
          winningOptionId: resolved ? resolved.winningOptionId : null,
        } as any;
      },
      enabled: !!selectedMarketId,
      refetchInterval: 30000,
    }
  );

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!selectedMarketData) return;
      setIsLoadingAnalytics(true);
      try {
        const resp = await fetch(
          `/api/market/analytics?marketId=${selectedMarketId}&timeRange=7d`
        );
        const analyticsJson = resp.ok ? await resp.json() : null;
        const options = (selectedMarketData.options || []).map(
          (o: string, idx: number) => ({
            id: idx,
            name: o,
            description: "",
            totalShares: 0n,
            totalVolume: 0n,
            currentPrice: 0n,
            isActive: !selectedMarketData.resolved,
          })
        );
        const analytics: MarketAnalytics = {
          marketId: Number(selectedMarketData.id),
          question: selectedMarketData.question,
          description: selectedMarketData.description || "",
          category: Number(selectedMarketData.category || 0),
          optionCount: options.length,
          resolved: !!selectedMarketData.resolved,
          disputed: false,
          winningOptionId: selectedMarketData.winningOptionId
            ? Number(selectedMarketData.winningOptionId)
            : undefined,
          endTime: BigInt(Number(selectedMarketData.endTime || 0)),
          creator: selectedMarketData.creator,
          options,
          totalVolume: BigInt((analyticsJson?.totalVolume ?? 0) as number),
          participantCount: (analyticsJson?.totalTrades ?? 0) as number,
          averagePrice: 0n,
          priceVolatility: BigInt(
            Math.round(((analyticsJson?.priceChange24h ?? 0) as number) * 1e18)
          ),
          lastTradePrice: 0n,
          lastTradeTime: 0n,
          priceHistory: analyticsJson?.priceHistory ?? [],
        };
        setMarketAnalytics(analytics);
      } catch (e) {
        console.error("Failed to load analytics data", e);
        setMarketAnalytics(null);
      } finally {
        setIsLoadingAnalytics(false);
      }
    };
    loadAnalytics();
  }, [selectedMarketData, selectedMarketId]);

  // market list and selected market data are fetched via React Query (see above)

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 10 ** tokenDecimals).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  };

  const formatPrice = (price: bigint) => {
    // Price is now in token format (0-100 range), format with 2 decimals
    const tokenPrice = Number(price) / 10 ** 18;
    return tokenPrice.toFixed(2);
  };

  const calculateProbability = (tokenPrice: bigint): number => {
    // Convert token price (0-100) to probability percentage (0-100)
    const price = Number(tokenPrice) / 10 ** 18;
    return Math.max(0, Math.min(100, price)); // Clamp to 0-100 range
  };

  const getCategoryName = (category: number) => {
    const categories = [
      "Politics",
      "Sports",
      "Entertainment",
      "Crypto",
      "Other",
    ];
    return categories[category] || "Unknown";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            V2 Market Analytics
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchMarkets();
              if (selectedMarketId !== null) refetchSelectedMarket();
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Markets</p>
              <p className="text-2xl font-bold">{marketsList.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Volume</p>
              <p className="text-2xl font-bold">
                {formatAmount(
                  marketsList.reduce(
                    (sum, market) => sum + market.totalVolume,
                    0n
                  )
                )}{" "}
                {tokenSymbol}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Markets</p>
              <p className="text-2xl font-bold">
                {marketsList.filter((m) => !m.resolved).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Markets List */}
        <Card className="lg:col-span-1">
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {marketsList.map((market) => (
                <div
                  key={market.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedMarketId === market.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedMarketId(market.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm line-clamp-2 flex-1">
                      {market.question}
                    </p>
                    {market.resolved && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatAmount(market.totalVolume)} {tokenSymbol}
                    </span>
                    <span>{market.participantCount} traders</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Analytics Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {marketAnalytics
                ? `Market #${marketAnalytics.marketId}`
                : "Select a Market"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAnalytics ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ) : marketAnalytics ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold line-clamp-2">
                      {marketAnalytics.question}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <Badge variant="outline">
                        {getCategoryName(marketAnalytics.category)}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {marketAnalytics.resolved
                          ? "Resolved"
                          : new Date(
                              Number(marketAnalytics.endTime) * 1000
                            ).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {marketAnalytics.participantCount} traders
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Total Volume
                      </p>
                      <p className="text-lg font-semibold">
                        {formatAmount(marketAnalytics.totalVolume)}{" "}
                        {tokenSymbol}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Last Price
                      </p>
                      <p className="text-lg font-semibold">
                        {formatPrice(marketAnalytics.lastTradePrice)}{" "}
                        {tokenSymbol}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-4 w-4" />
                        Volatility
                      </p>
                      <p className="text-lg font-semibold">
                        {formatPrice(marketAnalytics.priceVolatility)}%
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Options</p>
                      <p className="text-lg font-semibold">
                        {marketAnalytics.optionCount}
                      </p>
                    </div>
                  </div>

                  {marketAnalytics.resolved && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        🎉 Market Resolved - Winner:{" "}
                        {
                          marketAnalytics.options[
                            marketAnalytics.winningOptionId!
                          ]?.name
                        }
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="options" className="space-y-4">
                  <div className="space-y-3">
                    {marketAnalytics.options.map((option) => (
                      <div key={option.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{option.name}</h4>
                              {marketAnalytics.resolved &&
                                marketAnalytics.winningOptionId ===
                                  option.id && (
                                  <Badge variant="default" className="text-xs">
                                    Winner
                                  </Badge>
                                )}
                              {!option.isActive && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            {option.description && (
                              <p className="text-sm text-muted-foreground">
                                {option.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold">
                              {formatPrice(option.currentPrice)} {tokenSymbol}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Current Price
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">
                              Total Shares
                            </p>
                            <p className="font-medium">
                              {formatAmount(option.totalShares)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Volume</p>
                            <p className="font-medium">
                              {formatAmount(option.totalVolume)} {tokenSymbol}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Recent Activity</h4>
                    {marketAnalytics.lastTradeTime > 0n ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                            <span className="text-sm">Last Trade</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatPrice(marketAnalytics.lastTradePrice)}{" "}
                              {tokenSymbol}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(
                                Number(marketAnalytics.lastTradeTime) * 1000
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No trading activity yet.
                      </p>
                    )}

                    {/* Price History Chart Placeholder */}
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-3">Price History (24h)</h5>
                      <div className="h-32 bg-muted/20 rounded flex items-center justify-center">
                        <p className="text-muted-foreground text-sm">
                          Chart visualization would go here
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Select a market from the list to view detailed analytics.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
