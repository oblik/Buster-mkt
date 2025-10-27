"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { type Address } from "viem";
import { useToast } from "@/components/ui/use-toast";
import {
  publicClient,
  V2contractAddress,
  V2contractAbi,
  tokenAddress as defaultTokenAddress,
  tokenAbi as defaultTokenAbi,
  PolicastViews,
  PolicastViewsAbi,
} from "@/constants/contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  PieChart,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { subgraphPortfolio } from "@/lib/subgraph-portfolio";
import { subgraphClient } from "@/lib/subgraph";
import { gql } from "graphql-request";

interface UserPortfolio {
  totalInvested: string;
  totalWinnings: string;
  unrealizedPnL: string;
  realizedPnL: string;
  tradeCount: number;
}

interface MarketPosition {
  marketId: number;
  marketName: string;
  options: string[];
  userShares: bigint[];
  currentPrices: bigint[];
  totalValue: bigint;
  invested: bigint;
  pnl: bigint;
  resolved: boolean;
  winningOption?: number;
}

interface Trade {
  marketId: number;
  optionId: number;
  isBuy: boolean;
  quantity: bigint;
  price: bigint;
  timestamp: bigint;
  marketName?: string;
  optionName?: string;
}

const CACHE_KEY = "user_portfolio_v2_cache";
const CACHE_TTL = 300; // 5 minutes

export function UserPortfolioV2() {
  const { address: accountAddress, isConnected } = useAccount();
  const { toast } = useToast();

  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [positions, setPositions] = useState<MarketPosition[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenSymbol, setTokenSymbol] = useState<string>("buster");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);

  // Get betting token info (casted to any to avoid deep ABI typing issues)
  const { data: bettingTokenAddr } = (useReadContract as any)({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getBettingToken",
  });

  const tokenAddress = (bettingTokenAddr as Address) || defaultTokenAddress;

  // Get token metadata
  const { data: symbolData } = (useReadContract as any)({
    address: tokenAddress,
    abi: defaultTokenAbi,
    functionName: "symbol",
    query: { enabled: !!tokenAddress },
  });

  const { data: decimalsData } = (useReadContract as any)({
    address: tokenAddress,
    abi: defaultTokenAbi,
    functionName: "decimals",
    query: { enabled: !!tokenAddress },
  });

  // Get user portfolio from subgraph
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);

  useEffect(() => {
    const fetchPortfolioFromSubgraph = async () => {
      if (!accountAddress) {
        setIsLoadingPortfolio(false);
        return;
      }

      setIsLoadingPortfolio(true);
      try {
        const data = await subgraphPortfolio.getUserPortfolio(accountAddress);
        setPortfolioData(data);
      } catch (error) {
        console.error("Error fetching portfolio from subgraph:", error);
        setPortfolioData(null);
      } finally {
        setIsLoadingPortfolio(false);
      }
    };

    fetchPortfolioFromSubgraph();
  }, [accountAddress]);

  // Fetch accurate unrealized PnL from PolicastViews
  const { data: calculatedUnrealizedPnL } = (useReadContract as any)({
    address: PolicastViews,
    abi: PolicastViewsAbi,
    functionName: "calculateUnrealizedPnL",
    args: [accountAddress as `0x${string}`],
    query: {
      enabled: !!accountAddress,
      refetchInterval: 10000,
    },
  });

  useEffect(() => {
    if (symbolData) setTokenSymbol(symbolData as string);
    if (decimalsData) setTokenDecimals(Number(decimalsData));
  }, [symbolData, decimalsData]);

  // Fetch detailed portfolio data
  const fetchPortfolioData = async () => {
    if (!accountAddress || !portfolioData) return;

    setIsLoading(true);
    try {
      // Check cache
      const cacheKey = `${CACHE_KEY}_${accountAddress}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        // Custom BigInt deserializer
        const deserializeWithBigInt = (str: string) => {
          return JSON.parse(str, (key, value) => {
            if (
              typeof value === "string" &&
              value.endsWith("n") &&
              /^\d+n$/.test(value)
            ) {
              return BigInt(value.slice(0, -1));
            }
            return value;
          });
        };

        const data = deserializeWithBigInt(cached);
        if (Date.now() - data.timestamp < CACHE_TTL * 1000) {
          setPortfolio(data.portfolio);
          setPositions(data.positions);
          setRecentTrades(data.trades);
          setIsLoading(false);
          return;
        }
      }

      // Set portfolio basic data from subgraph
      // Use calculated unrealized PnL from contract if available, otherwise use subgraph value
      const portfolioInfo: UserPortfolio = {
        totalInvested: portfolioData.totalInvested.toString(),
        totalWinnings: portfolioData.totalWinnings.toString(),
        unrealizedPnL: calculatedUnrealizedPnL
          ? (calculatedUnrealizedPnL as bigint).toString()
          : portfolioData.unrealizedPnL.toString(),
        realizedPnL: portfolioData.realizedPnL.toString(),
        tradeCount: portfolioData.tradeCount,
      };
      setPortfolio(portfolioInfo);

      // Fetch user positions from subgraph
      const userPositions = await subgraphPortfolio.getUserPositions(
        accountAddress
      );

      // For each market with positions, get current share balances and market info from on-chain
      const positions: MarketPosition[] = [];

      for (const position of userPositions) {
        const marketId = Number(position.marketId);

        try {
          // Get current user shares from contract (most accurate)
          const userShares = (await (publicClient.readContract as any)({
            address: V2contractAddress,
            abi: V2contractAbi,
            functionName: "getUserShares" as any,
            args: [BigInt(marketId), accountAddress],
          })) as unknown as bigint[];

          // Skip if no current shares (might have sold all)
          if (!userShares || userShares.every((share) => share === 0n))
            continue;

          // Get market info from subgraph
          const MARKET_QUERY = gql`
            query GetMarketForPortfolio($marketId: String!) {
              marketCreateds(where: { marketId: $marketId }) {
                question
                options
              }
              marketResolveds(where: { marketId: $marketId }) {
                winningOptionId
              }
            }
          `;

          const marketData = (await subgraphClient.request(MARKET_QUERY, {
            marketId: String(marketId),
          })) as any;

          const marketInfo = marketData?.marketCreateds?.[0];
          const resolvedInfo = marketData?.marketResolveds?.[0];

          if (!marketInfo) continue;

          const options = marketInfo.options || [];
          const resolved = !!resolvedInfo;
          const winningOption = resolvedInfo
            ? Number(resolvedInfo.winningOptionId)
            : undefined;

          // Get current prices from contract for accurate valuation
          const currentPrices: bigint[] = [];
          for (let optionId = 0; optionId < options.length; optionId++) {
            try {
              const optionInfo = (await (publicClient.readContract as any)({
                address: V2contractAddress,
                abi: V2contractAbi,
                functionName: "getMarketOption" as any,
                args: [BigInt(marketId), BigInt(optionId)],
              })) as unknown as [
                string,
                string,
                bigint,
                bigint,
                bigint,
                boolean
              ];
              currentPrices.push(optionInfo[4]); // currentPrice
            } catch {
              currentPrices.push(0n);
            }
          }

          // Calculate total position value
          let totalValue = 0n;
          for (let i = 0; i < userShares.length; i++) {
            totalValue += (userShares[i] * currentPrices[i]) / 10n ** 18n;
          }

          positions.push({
            marketId,
            marketName: marketInfo.question,
            options,
            userShares,
            currentPrices,
            totalValue,
            invested: 0n, // Calculated from trades if needed
            pnl: 0n,
            resolved,
            winningOption,
          });
        } catch (error) {
          console.error(
            `Error fetching position for market ${marketId}:`,
            error
          );
        }
      }

      // Get recent trades from subgraph
      const trades: Trade[] = [];
      const userTrades = await subgraphPortfolio.getUserTrades(
        accountAddress,
        20,
        0
      ); // Last 20 trades

      for (const trade of userTrades) {
        const marketId = Number(trade.marketId);
        const optionId = Number(trade.optionId);
        const isBuy =
          trade.buyer.toLowerCase() === accountAddress.toLowerCase();

        // Find market info
        const position = positions.find((p) => p.marketId === marketId);

        trades.push({
          marketId,
          optionId,
          isBuy,
          quantity: BigInt(trade.quantity),
          price: BigInt(trade.price),
          timestamp: BigInt(trade.blockTimestamp),
          marketName: position?.marketName || `Market ${marketId}`,
          optionName: position?.options[optionId] || `Option ${optionId}`,
        });
      }

      setPositions(positions);
      setRecentTrades(trades);

      // Cache the data with BigInt serialization
      const cacheData = {
        portfolio: portfolioInfo,
        positions,
        trades,
        timestamp: Date.now(),
      };

      // Custom BigInt serializer
      const serializeWithBigInt = (obj: any): string => {
        return JSON.stringify(obj, (key, value) =>
          typeof value === "bigint" ? value.toString() + "n" : value
        );
      };

      localStorage.setItem(cacheKey, serializeWithBigInt(cacheData));
    } catch (error) {
      console.error("Error fetching portfolio data:", error);
      toast({
        title: "Error",
        description: "Failed to load portfolio data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && accountAddress && portfolioData) {
      fetchPortfolioData();
    }
  }, [isConnected, accountAddress, portfolioData]);

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / 10 ** tokenDecimals).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  };

  const formatPnL = (pnl: bigint) => {
    const value = Number(pnl) / 10 ** tokenDecimals;
    const isPositive = value >= 0;
    return {
      value: Math.abs(value).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      isPositive,
    };
  };

  // Flexible formatters that accept string (from subgraph) or bigint
  const formatAmountFlexible = (amount: string | bigint) => {
    const bi = typeof amount === "string" ? BigInt(amount) : amount;
    return (Number(bi) / 10 ** tokenDecimals).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  };

  const formatPnLFlexible = (pnl: string | bigint) => {
    const bi = typeof pnl === "string" ? BigInt(pnl) : pnl;
    const value = Number(bi) / 10 ** tokenDecimals;
    const isPositive = value >= 0;
    return {
      value: Math.abs(value).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
      isPositive,
    };
  };

  if (!isConnected || !accountAddress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            V2 Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please connect your wallet to view your V2 portfolio.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            V2 Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>No V2 portfolio data available.</p>
        </CardContent>
      </Card>
    );
  }

  const totalPnL =
    BigInt(portfolio.realizedPnL) + BigInt(portfolio.unrealizedPnL);
  const totalPnLFormatted = formatPnLFlexible(totalPnL);

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            V2 Portfolio Overview
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Clear subgraph cache
              if (accountAddress) {
                subgraphPortfolio.clearCache(accountAddress);
              }
              // Clear local cache
              localStorage.removeItem(`${CACHE_KEY}_${accountAddress}`);
              // Refetch data
              fetchPortfolioData();
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Total Invested
              </p>
              <p className="text-2xl font-bold">
                {formatAmountFlexible(portfolio.totalInvested)} {tokenSymbol}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Total Winnings
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatAmountFlexible(portfolio.totalWinnings)} {tokenSymbol}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {totalPnLFormatted.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                Total P&L
              </p>
              <p
                className={`text-2xl font-bold ${
                  totalPnLFormatted.isPositive
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {totalPnLFormatted.isPositive ? "+" : "-"}
                {totalPnLFormatted.value} {tokenSymbol}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Total Trades
              </p>
              <p className="text-2xl font-bold">
                {portfolio.tradeCount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Realized P&L</p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-lg font-semibold ${
                    Number(portfolio.realizedPnL) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {Number(portfolio.realizedPnL) >= 0 ? "+" : ""}
                  {formatAmountFlexible(portfolio.realizedPnL)} {tokenSymbol}
                </p>
                <Badge variant="secondary">Locked</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Unrealized P&L</p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-lg font-semibold ${
                    Number(portfolio.unrealizedPnL) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {Number(portfolio.unrealizedPnL) >= 0 ? "+" : ""}
                  {formatAmountFlexible(portfolio.unrealizedPnL)} {tokenSymbol}
                </p>
                <Badge variant="outline">Current</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Positions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Active Positions ({positions.length})
            </CardTitle>
            <Link href="/analytics?tab=positions">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No active positions found.
              </p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {positions.map((position) => (
                  <div
                    key={position.marketId}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/market/${position.marketId}`}
                          className="font-medium hover:text-primary transition-colors line-clamp-2"
                        >
                          {position.marketName}
                        </Link>
                        {position.resolved && (
                          <Badge variant="secondary" className="mt-1">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold ml-4">
                        {formatAmount(position.totalValue)} {tokenSymbol}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {position.userShares.map((shares, idx) => {
                        if (shares === 0n) return null;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {position.options[idx]}
                            </span>
                            <div className="flex items-center gap-2">
                              <span>{formatAmount(shares)} shares</span>
                              {position.resolved &&
                                position.winningOption === idx && (
                                  <Badge variant="default" className="text-xs">
                                    Winner
                                  </Badge>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Trades ({recentTrades.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTrades.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No recent trades found.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentTrades.map((trade, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={trade.isBuy ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {trade.isBuy ? "BUY" : "SELL"}
                        </Badge>
                        <Link
                          href={`/market/${trade.marketId}`}
                          className="text-sm font-medium hover:text-primary transition-colors"
                        >
                          #{trade.marketId}
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(
                          Number(trade.timestamp) * 1000
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground line-clamp-1">
                        {trade.marketName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {trade.optionName}
                        </span>
                        <div className="text-right">
                          <p>{formatAmount(trade.quantity)} shares</p>
                          <p className="text-muted-foreground">
                            @ {formatAmount(trade.price)} {tokenSymbol}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
