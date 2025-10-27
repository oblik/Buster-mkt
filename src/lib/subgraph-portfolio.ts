import {
  subgraphClient,
  GET_USER_PORTFOLIO_DATA,
  GET_USER_TRADES,
  GET_USER_POSITIONS,
} from "@/lib/subgraph";

export interface UserPortfolioData {
  totalInvested: bigint;
  totalWinnings: bigint;
  unrealizedPnL: bigint;
  realizedPnL: bigint;
  tradeCount: number;
  updatedAt: number;
}

export interface UserTrade {
  id: string;
  marketId: string;
  optionId: string;
  buyer: string;
  seller: string;
  price: string;
  quantity: string;
  blockTimestamp: string;
  transactionHash: string;
}

export interface MarketPosition {
  marketId: string;
  positions: {
    optionId: string;
    totalShares: bigint;
    avgPrice: bigint;
    tradeCount: number;
  }[];
}

export class SubgraphPortfolioService {
  private cache = new Map<
    string,
    { data: UserPortfolioData | null; lastUpdated: number }
  >();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getUserPortfolio(
    userAddress: string
  ): Promise<UserPortfolioData | null> {
    // Normalize address to lowercase
    const normalizedAddress = userAddress.toLowerCase();

    // Check cache first
    const cached = this.cache.get(normalizedAddress);
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const data = (await subgraphClient.request(GET_USER_PORTFOLIO_DATA, {
        userAddress: normalizedAddress,
      })) as any;

      if (!data || !data.userPortfolio) {
        // No portfolio found - user hasn't traded yet
        this.cache.set(normalizedAddress, {
          data: null,
          lastUpdated: Date.now(),
        });
        return null;
      }

      const portfolio = data.userPortfolio;
      const portfolioData: UserPortfolioData = {
        totalInvested: BigInt(portfolio.totalInvested || "0"),
        totalWinnings: BigInt(portfolio.totalWinnings || "0"),
        unrealizedPnL: BigInt(portfolio.unrealizedPnL || "0"),
        realizedPnL: BigInt(portfolio.realizedPnL || "0"),
        tradeCount: Number(portfolio.tradeCount || "0"),
        updatedAt: Number(portfolio.updatedAt || "0"),
      };

      // Update cache
      this.cache.set(normalizedAddress, {
        data: portfolioData,
        lastUpdated: Date.now(),
      });

      return portfolioData;
    } catch (error) {
      console.error("Error fetching user portfolio from subgraph:", error);
      return null;
    }
  }

  async getUserTrades(
    userAddress: string,
    first: number = 50,
    skip: number = 0
  ): Promise<UserTrade[]> {
    const normalizedAddress = userAddress.toLowerCase();

    try {
      const data = (await subgraphClient.request(GET_USER_TRADES, {
        userAddress: normalizedAddress,
        first,
        skip,
      })) as any;

      if (!data || !data.tradeExecuteds) {
        return [];
      }

      return data.tradeExecuteds.map((trade: any) => ({
        id: trade.id,
        marketId: trade.marketId,
        optionId: trade.optionId,
        buyer: trade.buyer,
        seller: trade.seller,
        price: trade.price,
        quantity: trade.quantity,
        blockTimestamp: trade.blockTimestamp,
        transactionHash: trade.transactionHash,
      }));
    } catch (error) {
      console.error("Error fetching user trades from subgraph:", error);
      return [];
    }
  }

  async getUserPositions(userAddress: string): Promise<MarketPosition[]> {
    const normalizedAddress = userAddress.toLowerCase();

    try {
      const data = (await subgraphClient.request(GET_USER_POSITIONS, {
        userAddress: normalizedAddress,
      })) as any;

      if (!data || !data.tradeExecuteds || data.tradeExecuteds.length === 0) {
        return [];
      }

      // Aggregate trades by market and option
      const positionMap = new Map<
        string,
        Map<
          string,
          { totalShares: bigint; totalCost: bigint; tradeCount: number }
        >
      >();

      for (const trade of data.tradeExecuteds) {
        const marketId = trade.marketId;
        const optionId = trade.optionId;
        const quantity = BigInt(trade.quantity);
        const price = BigInt(trade.price);
        const cost = (quantity * price) / BigInt(10 ** 18); // Assuming 18 decimals

        if (!positionMap.has(marketId)) {
          positionMap.set(marketId, new Map());
        }

        const marketPositions = positionMap.get(marketId)!;
        const existing = marketPositions.get(optionId) || {
          totalShares: 0n,
          totalCost: 0n,
          tradeCount: 0,
        };

        marketPositions.set(optionId, {
          totalShares: existing.totalShares + quantity,
          totalCost: existing.totalCost + cost,
          tradeCount: existing.tradeCount + 1,
        });
      }

      // Convert to array format
      const positions: MarketPosition[] = [];
      for (const [marketId, optionPositions] of positionMap.entries()) {
        const positionData: MarketPosition = {
          marketId,
          positions: [],
        };

        for (const [optionId, data] of optionPositions.entries()) {
          if (data.totalShares > 0n) {
            // Only include positions with shares
            positionData.positions.push({
              optionId,
              totalShares: data.totalShares,
              avgPrice:
                data.totalShares > 0n ? data.totalCost / data.totalShares : 0n,
              tradeCount: data.tradeCount,
            });
          }
        }

        if (positionData.positions.length > 0) {
          positions.push(positionData);
        }
      }

      return positions;
    } catch (error) {
      console.error("Error fetching user positions from subgraph:", error);
      return [];
    }
  }

  clearCache(userAddress?: string) {
    if (userAddress) {
      this.cache.delete(userAddress.toLowerCase());
    } else {
      this.cache.clear();
    }
  }
}

export const subgraphPortfolio = new SubgraphPortfolioService();
