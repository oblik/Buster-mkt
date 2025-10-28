"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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

interface PriceHistoryItem {
  date: string;
  timestamp: number;
  volume: number;
  trades: number;
  [key: `option${number}`]: number;
}

interface VolumeHistoryItem {
  date: string;
  timestamp: number;
  volume: number;
  trades: number;
}

interface AnalyticsData {
  priceHistory: PriceHistoryItem[];
  volumeHistory: VolumeHistoryItem[];
  totalVolume: number;
  totalTrades: number;
  priceChange24h: number;
  volumeChange24h: number;
  lastUpdated: string;
  question: string;
  optionCount: number;
}

const TIME_RANGES = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export function AnalyticsContent({ marketId }: { marketId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("24h");

  const fetchAnalytics = async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/market/analytics?marketId=${marketId}&timeRange=${range}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result: AnalyticsData = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeRange);
  }, [timeRange]);

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  if (loading) {
    return (
      <div className="flex-grow container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-grow container mx-auto p-4 md:p-6 max-w-7xl flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error Loading Analytics
          </h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => fetchAnalytics(timeRange)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-grow container mx-auto p-4 md:p-6 max-w-7xl flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
          <p className="text-gray-600">Analytics data could not be loaded.</p>
        </div>
      </div>
    );
  }

  const chartData = data.priceHistory.map((item) => ({
    timestamp: item.timestamp,
    date: item.date,
    ...Object.fromEntries(
      Object.keys(item)
        .filter((key) => key.startsWith("option"))
        .map((key) => [
          key,
          ((item[key as keyof typeof item] as number) * 100).toFixed(2),
        ])
    ),
  }));

  // Get all option keys for dynamic rendering
  const optionKeys = Object.keys(data.priceHistory[0] || {}).filter((key) =>
    key.startsWith("option")
  );

  // Define colors for options (extend as needed)
  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7300",
    "#00ff00",
    "#ff00ff",
    "#00ffff",
    "#ff0000",
    "#0000ff",
    "#ffff00",
  ];

  return (
    <div className="flex-grow container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h1 className="text-3xl font-bold mb-4">
            Market Analytics (Market ID: {marketId})
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Question: {data.question}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Number of Options: {data.optionCount}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>

          {/* Time Range Filters */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Time Range</h2>
            <div className="flex flex-wrap gap-2">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => handleTimeRangeChange(range.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Total Volume</h3>
            <p className="text-2xl font-bold text-blue-600">
              {(data.totalVolume / 1e18).toFixed(2)} Buster
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Total Trades</h3>
            <p className="text-2xl font-bold text-green-600">
              {data.totalTrades}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Price Change (24h)</h3>
            <p
              className={`text-2xl font-bold ${
                data.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {data.priceChange24h >= 0 ? "+" : ""}
              {(data.priceChange24h * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Volume Change (24h)</h3>
            <p
              className={`text-2xl font-bold ${
                data.volumeChange24h >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {data.volumeChange24h >= 0 ? "+" : ""}
              {(data.volumeChange24h * 100).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Price Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Option Price Chart</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  label={{
                    value: "Price (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(value) => `Date: ${value}`}
                  formatter={(value, name) => [
                    `${value}%`,
                    String(name).replace("option", "Option "),
                  ]}
                />
                <Legend />
                {optionKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    name={key.replace("option", "Option ")}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">
                No price data available for the selected time range.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Price History</h2>
            {data.priceHistory.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.priceHistory.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-sm font-medium">{item.date}</span>
                    <div className="text-right">
                      {optionKeys.map((key) => (
                        <div key={key} className="text-sm">
                          {key.replace("option", "Option ")}:{" "}
                          {(
                            (item[key as keyof typeof item] as number) * 100
                          ).toFixed(1)}
                          %
                        </div>
                      ))}
                      <div className="text-xs text-gray-500">
                        Trades: {item.trades}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No price history data available.</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Volume History</h2>
            {data.volumeHistory.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.volumeHistory.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700"
                  >
                    <span className="text-sm font-medium">{item.date}</span>
                    <div className="text-right">
                      <div className="text-sm">
                        Volume: {(item.volume / 1e18).toFixed(2)} Buster
                      </div>
                      <div className="text-xs text-gray-500">
                        Trades: {item.trades}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No volume history data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
