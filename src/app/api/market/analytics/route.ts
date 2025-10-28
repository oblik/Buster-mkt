import { NextRequest, NextResponse } from "next/server";
import { subgraphAnalytics } from "@/lib/subgraph-analytics";
import { MarketAnalytics } from "@/types/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get("marketId");
    const timeRange = searchParams.get("timeRange") || "7d";

    if (!marketId) {
      return NextResponse.json(
        { error: "Market ID is required" },
        { status: 400 }
      );
    }

    // Validate marketId is a numeric string suitable for BigInt in subgraph queries
    if (!/^\d+$/.test(marketId)) {
      return NextResponse.json(
        { error: "Market ID must be a numeric string" },
        { status: 400 }
      );
    }

    // Get analytics from subgraph////
    const analytics = await subgraphAnalytics.getMarketAnalytics(marketId);

    // Sample data at regular intervals based on time range
    let timeWindow: number;
    let sampleInterval: number;

    switch (timeRange) {
      case "1h":
        timeWindow = 1 * 60 * 60 * 1000; // 1 hour
        sampleInterval = 5 * 60 * 1000; // 5 minutes
        break;
      case "6h":
        timeWindow = 6 * 60 * 60 * 1000; // 6 hours
        sampleInterval = 30 * 60 * 1000; // 30 minutes
        break;
      case "24h":
        timeWindow = 24 * 60 * 60 * 1000; // 24 hours
        sampleInterval = 2 * 60 * 60 * 1000; // 2 hours
        break;
      case "7d":
        timeWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
        sampleInterval = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case "30d":
        timeWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
        sampleInterval = 24 * 60 * 60 * 1000; // 24 hours
        break;
      default:
        timeWindow = 0; // 'all' - no time window filter
        sampleInterval = 0; // 'all' - no sampling
    }

    const sampleData = (data: any[], timeWindow: number, interval: number) => {
      if (timeWindow === 0 && interval === 0) return data; // Return all data for 'all' range

      const now = Date.now();
      const cutoffTime = now - timeWindow;

      // First filter by time window
      const filteredData =
        timeWindow > 0
          ? data.filter((item) => item.timestamp >= cutoffTime)
          : data;

      if (interval === 0) return filteredData; // No sampling needed

      // Then sample at regular intervals
      const sampled: any[] = [];
      let lastSampleTime = -Infinity;

      for (const item of filteredData.sort(
        (a, b) => a.timestamp - b.timestamp
      )) {
        if (item.timestamp - lastSampleTime >= interval) {
          sampled.push(item);
          lastSampleTime = item.timestamp;
        }
      }

      return sampled;
    };

    const filteredAnalytics: MarketAnalytics = {
      ...analytics,
      priceHistory: sampleData(
        analytics.priceHistory,
        timeWindow,
        sampleInterval
      ),
      volumeHistory: sampleData(
        analytics.volumeHistory,
        timeWindow,
        sampleInterval
      ),
    };

    return NextResponse.json(filteredAnalytics);
  } catch (error) {
    console.error("Error fetching market analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { marketId } = await request.json();

    if (!marketId) {
      return NextResponse.json(
        { error: "Market ID is required" },
        { status: 400 }
      );
    }

    // Clear cache for this market to force refresh
    subgraphAnalytics.clearCache(marketId);

    return NextResponse.json({ success: true, message: "Cache cleared" });
  } catch (error) {
    console.error("Error clearing analytics cache:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
