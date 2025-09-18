import { useQuery } from "@tanstack/react-query";
import {
  subgraphClient,
  GET_MARKET_BY_ID,
  GET_TRADES_BY_MARKET,
  GET_PRICE_HISTORY,
  GET_USER_PORTFOLIO,
  Market,
  Trade,
  PriceHistory,
  UserPortfolio,
} from "@/lib/subgraph";

export function useMarketData(marketId: string | number) {
  const id = typeof marketId === "number" ? marketId.toString() : marketId;

  const {
    data: market,
    isLoading: isLoadingMarket,
    error: marketError,
  } = useQuery({
    queryKey: ["market", id],
    queryFn: async () => {
      const response = (await subgraphClient.request(GET_MARKET_BY_ID, {
        id,
      })) as any;
      return response.market as Market | null;
    },
    enabled: !!id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: trades, isLoading: isLoadingTrades } = useQuery({
    queryKey: ["trades", id],
    queryFn: async () => {
      const response = (await subgraphClient.request(GET_TRADES_BY_MARKET, {
        marketId: id,
        first: 100,
        skip: 0,
        orderBy: "timestamp",
        orderDirection: "desc",
      })) as any;
      return response.trades as Trade[];
    },
    enabled: !!id,
    refetchInterval: 15000,
  });

  return {
    market,
    trades,
    isLoading: isLoadingMarket || isLoadingTrades,
    error: marketError,
  };
}

export function usePriceHistory(marketId: string | number, optionId: number) {
  const id = typeof marketId === "number" ? marketId.toString() : marketId;

  const { data: priceHistory, isLoading } = useQuery({
    queryKey: ["priceHistory", id, optionId],
    queryFn: async () => {
      const response = (await subgraphClient.request(GET_PRICE_HISTORY, {
        marketId: id,
        optionId: optionId.toString(),
        first: 1000,
        skip: 0,
        orderBy: "timestamp",
        orderDirection: "asc",
      })) as any;
      return response.priceHistories as PriceHistory[];
    },
    enabled: !!id && optionId !== undefined,
    refetchInterval: 30000,
  });

  return {
    priceHistory,
    isLoading,
  };
}

export function useUserPortfolio(userAddress: string) {
  const {
    data: portfolio,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["userPortfolio", userAddress],
    queryFn: async () => {
      const response = (await subgraphClient.request(GET_USER_PORTFOLIO, {
        user: userAddress.toLowerCase(),
      })) as any;
      return response.userPortfolio as UserPortfolio | null;
    },
    enabled: !!userAddress,
    refetchInterval: 30000,
  });

  return {
    portfolio,
    isLoading,
    refetch,
  };
}
