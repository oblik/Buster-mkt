"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMarketAnalytics } from "@/hooks/useMarketAnalytics";

interface MarketChartProps {
  marketId: string;
}

export function MarketChart({ marketId }: MarketChartProps) {
  const {
    data: analyticsData,
    loading,
    error,
  } = useMarketAnalytics({
    marketId,
    timeRange: "7d",
    enabled: true,
  });

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-destructive">Error loading chart data</div>
      </div>
    );
  }

  if (
    !analyticsData ||
    !analyticsData.priceHistory ||
    analyticsData.priceHistory.length === 0
  ) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={analyticsData.priceHistory}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            className="text-xs fill-muted-foreground"
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString();
            }}
          />
          <YAxis className="text-xs fill-muted-foreground" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleString();
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="optionA"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            name="Option A Price"
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="optionB"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            name="Option B Price"
            dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MarketChart;
