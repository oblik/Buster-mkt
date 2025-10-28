import {
  subgraphClient,
  GET_MARKET_ANALYTICS,
  GET_DAILY_MARKET_STATS,
  MarketAnalyticsData,
} from "@/lib/subgraph";
import {
  MarketAnalytics,
  PriceHistoryData,
  VolumeHistoryData,
} from "@/types/types";

export class SubgraphAnalyticsService {
  private cache = new Map<
    string,
    { data: MarketAnalytics; lastUpdated: number }
  >();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getMarketAnalytics(marketId: string): Promise<MarketAnalytics> {
    // Check cache first
    const cached = this.cache.get(marketId);
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Query market info from subgraph
      const marketInfoQuery = `
        query GetMarketInfo($marketId: String!) {
          marketCreateds(where: { marketId: $marketId }) {
            question
            options
          }
        }
      `;
      const marketInfo = await subgraphClient.request<any>(marketInfoQuery, {
        marketId,
      });
      const marketCreated = marketInfo.marketCreateds[0];
      const question = marketCreated?.question || "Unknown Question";
      const optionCount = marketCreated?.options?.length || 2; // Default to 2 if not found

      console.log(
        `Market ${marketId} - Question: "${question}", Options: ${optionCount}`
      );

      // 1) Prefer daily snapshots if available
      const daily = (await subgraphClient.request<any>(GET_DAILY_MARKET_STATS, {
        marketId,
      })) as any;

      console.log(
        `Daily stats for market ${marketId}:`,
        daily?.dailyMarketStats?.length || 0,
        "entries"
      );

      if (
        daily &&
        Array.isArray(daily.dailyMarketStats) &&
        daily.dailyMarketStats.length > 0
      ) {
        console.log(`Using daily stats for market ${marketId}`);
        const analytics = this.processDailyStats(
          daily.dailyMarketStats,
          question,
          optionCount
        );
        this.cache.set(marketId, { data: analytics, lastUpdated: Date.now() });
        return analytics;
      }

      console.log(
        `No daily stats found for market ${marketId}, falling back to trade events`
      );

      // 2) Fallback to raw trade events if snapshots not present yet
      const data = await subgraphClient.request<MarketAnalyticsData>(
        GET_MARKET_ANALYTICS,
        { marketId }
      );

      // Handle case where subgraph returns no data
      if (!data || !data.tradeExecuteds || data.tradeExecuteds.length === 0) {
        console.log(
          `No subgraph data found for market ${marketId}, using fallback analytics`
        );
        return this.generateFallbackAnalytics(question, optionCount);
      }

      const analytics = this.processMarketData(data, question, optionCount);

      // Update cache
      this.cache.set(marketId, {
        data: analytics,
        lastUpdated: Date.now(),
      });

      return analytics;
    } catch (error) {
      console.error("Error fetching from subgraph:", error);
      return this.generateFallbackAnalytics("Error fetching question", 2);
    }
  }

  private processDailyStats(
    rows: any[],
    question: string,
    optionCount: number
  ): MarketAnalytics {
    // rows are ordered asc by dayStart
    const priceHistory = [] as PriceHistoryData[];
    const volumeHistory = [] as VolumeHistoryData[];

    let totalVolume = 0;
    let totalTrades = 0;

    const lastPrices: { [key: string]: number } = {};

    for (const r of rows) {
      const ts = Number(r.dayStart) * 1000;

      // Process prices for all options (up to optionCount)
      const prices: { [key: string]: number } = {};
      for (let i = 0; i < optionCount; i++) {
        const priceField =
          i === 0
            ? "optionAPrice"
            : i === 1
            ? "optionBPrice"
            : `option${i}Price`;
        const priceValue = r[priceField];
        if (priceValue) {
          prices[`option${i}`] = Number(BigInt(priceValue)) / 1e18 / 100; // Convert from percentage * 1e18 to decimal
        }
      }

      // Carry forward last known prices
      Object.keys(prices).forEach((key) => {
        lastPrices[key] = prices[key];
      });

      // For options without data, use last known or default
      for (let i = 0; i < optionCount; i++) {
        const key = `option${i}`;
        if (!(key in prices) && lastPrices[key] !== undefined) {
          prices[key] = lastPrices[key];
        } else if (!(key in prices)) {
          prices[key] = 1 / optionCount; // Default equal distribution
        }
      }

      const volume = Number(r.totalVolume || 0);
      const trades = Number(r.trades || 0);
      totalVolume += volume;
      totalTrades += trades;

      const priceData: PriceHistoryData = {
        date: new Date(ts).toISOString().split("T")[0],
        timestamp: ts,
        volume,
        trades,
        ...prices,
      };

      priceHistory.push(priceData);

      volumeHistory.push({
        date: new Date(ts).toISOString().split("T")[0],
        timestamp: ts,
        volume,
        trades,
      });
    }

    const priceChange24h = this.calculatePriceChange(priceHistory);
    const volumeChange24h = this.calculateVolumeChange(volumeHistory);

    return {
      priceHistory,
      volumeHistory,
      totalVolume,
      totalTrades,
      priceChange24h,
      volumeChange24h,
      lastUpdated: new Date().toISOString(),
      question,
      optionCount,
    };
  }

  private processMarketData(
    data: MarketAnalyticsData,
    question: string,
    optionCount: number
  ): MarketAnalytics {
    console.log(
      `Processing market data for ${data.tradeExecuteds.length} trade events`
    );
    const events = data.tradeExecuteds
      .filter((event) => event && event.blockNumber && event.blockTimestamp)
      .map((event) => ({
        optionId: event.optionId,
        price: event.price
          ? Number(BigInt(event.price)) / 1e18 / 100
          : undefined,
        amount: Number(event.quantity || "0"),
        timestamp: parseInt(event.blockTimestamp || "0") * 1000,
        blockNumber: BigInt(event.blockNumber || "0"),
      }));

    console.log(`Filtered to ${events.length} valid events`);
    console.log(`Option IDs found:`, [
      ...new Set(events.map((e) => e.optionId)),
    ]);

    if (events.length === 0) {
      return this.generateFallbackAnalytics(question, optionCount);
    }

    // Group events by day for price history
    const dailyData = new Map<
      string,
      {
        prices: { [optionId: string]: number[] };
        totalVolume: number;
        trades: number;
        timestamp: number;
      }
    >();

    let totalVolume = 0;
    let totalTrades = 0;

    events.forEach((event) => {
      const date = new Date(event.timestamp).toISOString().split("T")[0];
      const existing = dailyData.get(date) || {
        prices: {},
        totalVolume: 0,
        trades: 0,
        timestamp: event.timestamp,
      };

      const amount = event.amount || 0;
      existing.totalVolume += amount;
      existing.trades += 1;
      totalVolume += amount;
      totalTrades += 1;

      // Store price data for each option dynamically
      if (event.price !== undefined) {
        const optionKey = `option${event.optionId}`;
        if (!existing.prices[optionKey]) {
          existing.prices[optionKey] = [];
        }
        existing.prices[optionKey].push(event.price);
      }

      dailyData.set(date, existing);
    });

    const priceHistory: PriceHistoryData[] = Array.from(dailyData.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .map(([date, data]) => {
        const priceData: PriceHistoryData = {
          date,
          timestamp: data.timestamp,
          volume: data.totalVolume,
          trades: data.trades,
        };

        // Calculate average price for each option dynamically
        Object.keys(data.prices).forEach((optionKey) => {
          const prices = data.prices[optionKey];
          if (prices.length > 0) {
            const avgPrice =
              prices.reduce((sum, price) => sum + price, 0) / prices.length;
            priceData[optionKey] = Math.round(avgPrice * 1000) / 1000;
          }
        });

        // Ensure all options have a price (use default if missing)
        for (let i = 0; i < optionCount; i++) {
          const key = `option${i}`;
          if (!(key in priceData)) {
            priceData[key] = 1 / optionCount; // Default equal distribution
          }
        }

        return priceData;
      });

    const volumeHistory: VolumeHistoryData[] = Array.from(dailyData.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .map(([date, data]) => ({
        date,
        timestamp: data.timestamp,
        volume: data.totalVolume,
        trades: data.trades,
      }));

    const priceChange24h = this.calculatePriceChange(priceHistory);
    const volumeChange24h = this.calculateVolumeChange(volumeHistory);

    return {
      priceHistory,
      volumeHistory,
      totalVolume,
      totalTrades,
      priceChange24h,
      volumeChange24h,
      lastUpdated: new Date().toISOString(),
      question,
      optionCount,
    };
  }

  private calculatePriceChange(priceHistory: PriceHistoryData[]): number {
    if (priceHistory.length < 2) return 0;

    const latest = priceHistory[priceHistory.length - 1];
    const previous = priceHistory[priceHistory.length - 2];

    // Use option0 as primary for change calculation
    const latestPrice = latest.option0 ?? 0.5;
    const previousPrice = previous.option0 ?? 0.5;

    return latestPrice - previousPrice;
  }

  private calculateVolumeChange(volumeHistory: VolumeHistoryData[]): number {
    if (volumeHistory.length < 2) return 0;

    const latest = volumeHistory[volumeHistory.length - 1];
    const previous = volumeHistory[volumeHistory.length - 2];

    if (previous.volume === 0) return latest.volume > 0 ? 1 : 0;
    return (latest.volume - previous.volume) / previous.volume;
  }

  private generateFallbackAnalytics(
    question: string,
    optionCount: number
  ): MarketAnalytics {
    const priceHistory: PriceHistoryData[] = [];
    const volumeHistory: VolumeHistoryData[] = [];

    // Generate default prices for all options
    const defaultPrices: { [key: string]: number } = {};
    for (let i = 0; i < optionCount; i++) {
      defaultPrices[`option${i}`] = 1 / optionCount;
    }

    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const volume = Math.floor(Math.random() * 1000) + 100;
      const trades = Math.floor(Math.random() * 50) + 10;

      const priceData: PriceHistoryData = {
        date: date.toISOString().split("T")[0],
        timestamp: date.getTime(),
        volume,
        trades,
        ...defaultPrices,
      };

      priceHistory.push(priceData);

      volumeHistory.push({
        date: date.toISOString().split("T")[0],
        timestamp: date.getTime(),
        volume,
        trades,
      });
    }

    return {
      priceHistory,
      volumeHistory,
      totalVolume: priceHistory.reduce((sum, p) => sum + p.volume, 0),
      totalTrades: priceHistory.reduce((sum, p) => sum + (p.trades || 0), 0),
      priceChange24h: (Math.random() - 0.5) * 0.2,
      volumeChange24h: (Math.random() - 0.5) * 2,
      lastUpdated: new Date().toISOString(),
      question,
      optionCount,
    };
  }

  clearCache(marketId?: string) {
    if (marketId) {
      this.cache.delete(marketId);
    } else {
      this.cache.clear();
    }
  }
}

export const subgraphAnalytics = new SubgraphAnalyticsService();
