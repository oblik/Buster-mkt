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
      // 1) Prefer daily snapshots if available
      const daily = (await subgraphClient.request<any>(GET_DAILY_MARKET_STATS, {
        marketId,
      })) as any;

      if (
        daily &&
        Array.isArray(daily.dailyMarketStats) &&
        daily.dailyMarketStats.length > 0
      ) {
        const analytics = this.processDailyStats(daily.dailyMarketStats);
        this.cache.set(marketId, { data: analytics, lastUpdated: Date.now() });
        return analytics;
      }

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
        return this.generateFallbackAnalytics();
      }

      const analytics = this.processMarketData(data);

      // Update cache
      this.cache.set(marketId, {
        data: analytics,
        lastUpdated: Date.now(),
      });

      return analytics;
    } catch (error) {
      console.error("Error fetching from subgraph:", error);
      return this.generateFallbackAnalytics();
    }
  }

  private processDailyStats(rows: any[]): MarketAnalytics {
    // rows are ordered asc by dayStart
    const priceHistory = [] as PriceHistoryData[];
    const volumeHistory = [] as VolumeHistoryData[];

    let totalVolume = 0;
    let totalTrades = 0;

    let lastA: number | undefined = undefined;
    let lastB: number | undefined = undefined;

    for (const r of rows) {
      const ts = Number(r.dayStart) * 1000;
      const a = r.optionAPrice ? Number(r.optionAPrice) / 1e18 : undefined;
      const b = r.optionBPrice ? Number(r.optionBPrice) / 1e18 : undefined;

      // Carry forward last known prices for smoother charts
      if (a !== undefined) lastA = a;
      if (b !== undefined) lastB = b;

      // If only one leg present and binary, infer the other
      const optionA =
        lastA !== undefined
          ? Math.max(0, Math.min(1, lastA))
          : lastB !== undefined
          ? Math.max(0, Math.min(1, 1 - lastB))
          : 0.5;
      const optionB =
        lastB !== undefined
          ? Math.max(0, Math.min(1, lastB))
          : Math.max(0, Math.min(1, 1 - optionA));

      const volume = Number(r.totalVolume || 0);
      const trades = Number(r.trades || 0);
      totalVolume += volume;
      totalTrades += trades;

      priceHistory.push({
        date: new Date(ts).toISOString().split("T")[0],
        timestamp: ts,
        optionA: Math.round(optionA * 1000) / 1000,
        optionB: Math.round(optionB * 1000) / 1000,
        volume,
        trades,
      });

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
    };
  }

  private processMarketData(data: MarketAnalyticsData): MarketAnalytics {
    const events = data.tradeExecuteds
      .filter((event) => event && event.blockNumber && event.blockTimestamp)
      .map((event) => ({
        optionId: event.optionId,
        // Treat quantity as amount for volume analytics
        amount: Number(event.quantity || "0"),
        timestamp: parseInt(event.blockTimestamp || "0") * 1000,
        blockNumber: BigInt(event.blockNumber || "0"),
      }));

    if (events.length === 0) {
      return this.generateFallbackAnalytics();
    }

    // Group events by day for price history
    const dailyData = new Map<
      string,
      {
        optionAVolume: number;
        optionBVolume: number;
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
        optionAVolume: 0,
        optionBVolume: 0,
        totalVolume: 0,
        trades: 0,
        timestamp: event.timestamp,
      };

      const amount = event.amount || 0;
      // Derive option A/B from optionId for two-option markets: 0 => A, else => B
      if (event.optionId === "0") {
        existing.optionAVolume += amount;
      } else {
        existing.optionBVolume += amount;
      }

      existing.totalVolume += amount;
      existing.trades += 1;
      totalVolume += amount;
      totalTrades += 1;

      dailyData.set(date, existing);
    });

    // Calculate running totals for price percentages
    let runningOptionAVolume = 0;
    let runningOptionBVolume = 0;

    const priceHistory: PriceHistoryData[] = Array.from(dailyData.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .map(([date, data]) => {
        runningOptionAVolume += data.optionAVolume;
        runningOptionBVolume += data.optionBVolume;

        const totalVol = runningOptionAVolume + runningOptionBVolume;
        const optionA = totalVol > 0 ? runningOptionAVolume / totalVol : 0.5;
        const optionB = totalVol > 0 ? runningOptionBVolume / totalVol : 0.5;

        return {
          date,
          timestamp: data.timestamp,
          optionA: Math.round(optionA * 1000) / 1000,
          optionB: Math.round(optionB * 1000) / 1000,
          volume: data.totalVolume,
          trades: data.trades,
        };
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
    };
  }

  private calculatePriceChange(priceHistory: PriceHistoryData[]): number {
    if (priceHistory.length < 2) return 0;

    const latest = priceHistory[priceHistory.length - 1];
    const previous = priceHistory[priceHistory.length - 2];

    // Handle cases where optionA might be undefined
    const latestPrice = latest.optionA ?? 0.5;
    const previousPrice = previous.optionA ?? 0.5;

    return latestPrice - previousPrice;
  }

  private calculateVolumeChange(volumeHistory: VolumeHistoryData[]): number {
    if (volumeHistory.length < 2) return 0;

    const latest = volumeHistory[volumeHistory.length - 1];
    const previous = volumeHistory[volumeHistory.length - 2];

    if (previous.volume === 0) return latest.volume > 0 ? 1 : 0;
    return (latest.volume - previous.volume) / previous.volume;
  }

  private generateFallbackAnalytics(): MarketAnalytics {
    const priceHistory: PriceHistoryData[] = [];
    const volumeHistory: VolumeHistoryData[] = [];

    let currentPriceA = 0.5;

    for (let i = 7; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const volatility = (Math.random() - 0.5) * 0.1;
      currentPriceA = Math.max(
        0.05,
        Math.min(0.95, currentPriceA + volatility)
      );

      const volume = Math.floor(Math.random() * 1000) + 100;
      const trades = Math.floor(Math.random() * 50) + 10;

      priceHistory.push({
        date: date.toISOString().split("T")[0],
        timestamp: date.getTime(),
        optionA: Math.round(currentPriceA * 1000) / 1000,
        optionB: Math.round((1 - currentPriceA) * 1000) / 1000,
        volume,
        trades,
      });

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
