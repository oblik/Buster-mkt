import type { Address } from "viem";

// Small helper to add a timeout to fetch so we don't hang the API route
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 3000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

type SubgraphPortfolio = {
  id: string; // address lowercased
  totalWinnings: string; // BigInt as string
  tradeCount: string; // BigInt as string
};

export type TopV2Winner = {
  address: Address;
  totalWinnings: bigint;
  tradeCount: number;
};

/**
 * Fetch top V2 winners from the subgraph. Returns empty array on any error.
 */
export async function fetchTopV2WinnersFromSubgraph(
  limit = 100
): Promise<TopV2Winner[]> {
  const endpoint =
    process.env.SUBGRAPH_V2_URL || process.env.NEXT_PUBLIC_SUBGRAPH_V2_URL;
  if (!endpoint) return [];

  // GraphQL query for top portfolios by totalWinnings desc
  const query = `
    query TopPortfolios($first: Int!) {
      userPortfolios(first: $first, orderBy: totalWinnings, orderDirection: desc, where: { totalWinnings_gt: "0" }) {
        id
        totalWinnings
        tradeCount
      }
    }
  `;

  try {
    const res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { first: Math.max(1, Math.min(1000, limit)) },
        }),
      },
      3500
    );

    if (!res.ok) return [];
    const body = await res.json();
    if (body?.errors) return [];

    const items: SubgraphPortfolio[] = body?.data?.userPortfolios || [];
    if (!Array.isArray(items) || items.length === 0) return [];

    return items.map((p) => ({
      address: p.id as Address,
      totalWinnings: BigInt(p.totalWinnings),
      tradeCount: Number(p.tradeCount),
    }));
  } catch (_e) {
    return [];
  }
}

export type V2WinnerEntry = {
  user: `0x${string}`;
  totalWinnings: bigint;
  voteCount: number;
};

type GraphUserPortfolio = {
  id: string; // address
  totalWinnings: string; // BigInt as string
  tradeCount: string; // BigInt as string
};

export async function fetchV2TopWinnersFromSubgraph(
  subgraphUrl: string,
  topN = 50
): Promise<V2WinnerEntry[]> {
  const query = `
    query TopWinners($first: Int!) {
      userPortfolios(
        first: $first
        orderBy: totalWinnings
        orderDirection: desc
        where: { totalWinnings_gt: 0 }
      ) {
        id
        totalWinnings
        tradeCount
      }
    }
  `;

  const res = await fetch(subgraphUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { first: topN } }),
    // Small timeout safeguard via AbortController if needed (optional)
  });

  if (!res.ok) {
    throw new Error(`Subgraph HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: { userPortfolios: GraphUserPortfolio[] };
    errors?: Array<{ message: string }>;
  };
  if (json.errors && json.errors.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const portfolios = json.data?.userPortfolios ?? [];
  return portfolios.map((p) => ({
    user: p.id as `0x${string}`,
    totalWinnings: BigInt(p.totalWinnings),
    voteCount: Number(p.tradeCount),
  }));
}
import { GraphQLClient, gql } from "graphql-request";

// Your deployed subgraph URL (default to the new V2 subgraph)
const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/121109/policast-v-2/v0.0.5";

export const subgraphClient = new GraphQLClient(SUBGRAPH_URL);

// GraphQL queries for V3 entities (using gql for better parsing)
export const GET_MARKETS = gql`
  query GetMarkets(
    $first: Int!
    $skip: Int!
    $orderBy: String!
    $orderDirection: String!
  ) {
    marketCreateds(
      first: $first
      skip: $skip
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      marketId
      question
      options
      endTime
      category
      marketType
      creator
      blockTimestamp
    }
  }
`;

export const GET_MARKET_BY_ID = gql`
  query GetMarketById($marketId: String!) {
    marketCreateds(where: { marketId: $marketId }) {
      id
      marketId
      question
      options
      endTime
      category
      marketType
      creator
      blockTimestamp
    }
    marketResolveds(where: { marketId: $marketId }) {
      winningOptionId
      resolver
    }
    marketInvalidateds(where: { marketId: $marketId }) {
      id
    }
  }
`;

export const GET_TRADES_BY_MARKET = gql`
  query GetTradesByMarket(
    $marketId: String!
    $first: Int!
    $skip: Int!
    $orderBy: String!
    $orderDirection: String!
  ) {
    trades(
      where: { market: $marketId }
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      market {
        id
        question
      }
      optionId
      buyer
      seller
      price
      quantity
      timestamp
    }
  }
`;

export const GET_USER_PORTFOLIO = gql`
  query GetUserPortfolio($user: ID!) {
    userPortfolio(id: $user) {
      id
      totalInvested
      totalWinnings
      unrealizedPnL
      realizedPnL
      tradeCount
      updatedAt
    }
  }
`;

export const GET_PRICE_HISTORY = gql`
  query GetPriceHistory(
    $marketId: String!
    $optionId: BigInt!
    $first: Int!
    $skip: Int!
    $orderBy: String!
    $orderDirection: String!
  ) {
    priceHistories(
      where: { market: $marketId, optionId: $optionId }
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      market {
        id
      }
      optionId
      price
      timestamp
      volume
    }
  }
`;

export const GET_MARKET_ANALYTICS = gql`
  query GetMarketAnalytics($marketId: BigInt!) {
    tradeExecuteds(
      where: { marketId: $marketId }
      first: 1000
      orderBy: blockTimestamp
      orderDirection: asc
    ) {
      optionId
      price
      quantity
      blockNumber
      blockTimestamp
    }
  }
`;

export const GET_DAILY_MARKET_STATS = gql`
  query GetDailyMarketStats($marketId: BigInt!) {
    dailyMarketStats(
      where: { marketId: $marketId }
      orderBy: dayStart
      orderDirection: asc
      first: 1000
    ) {
      id
      marketId
      dayStart
      optionAPrice
      optionBPrice
      totalVolume
      trades
      updatedAt
    }
  }
`;

// Production-ready functions (CEI: Check inputs, perform effect/query, handle interactions)
export async function getMarkets(
  first: number,
  skip: number,
  orderBy: string,
  orderDirection: string
): Promise<Market[]> {
  // Check: Validate inputs to prevent invalid queries
  if (
    first <= 0 ||
    skip < 0 ||
    !["asc", "desc"].includes(orderDirection.toLowerCase())
  ) {
    throw new Error("Invalid pagination or order parameters");
  }

  // Effects: Perform the GraphQL request
  try {
    const data = await subgraphClient.request<{ markets: Market[] }>(
      GET_MARKETS,
      {
        first,
        skip,
        orderBy,
        orderDirection,
      }
    );

    // Interactions: Return typed data safely
    return data.markets || [];
  } catch (error) {
    console.error("Error fetching markets from subgraph:", error);
    throw new Error("Failed to fetch markets");
  }
}

export async function getMarketById(id: string): Promise<Market | null> {
  // Check: Validate input
  if (!id || typeof id !== "string") {
    throw new Error("Valid market ID is required");
  }

  // Effects: Perform the request
  try {
    const data = await subgraphClient.request<{ market: Market | null }>(
      GET_MARKET_BY_ID,
      { id }
    );

    // Interactions: Return data
    return data.market;
  } catch (error) {
    console.error("Error fetching market by ID:", error);
    throw new Error("Failed to fetch market");
  }
}

export async function getTradesByMarket(
  marketId: string,
  first: number,
  skip: number,
  orderBy: string,
  orderDirection: string
): Promise<Trade[]> {
  // Check: Validate inputs
  if (
    !marketId ||
    first <= 0 ||
    skip < 0 ||
    !["asc", "desc"].includes(orderDirection.toLowerCase())
  ) {
    throw new Error("Invalid market ID or pagination parameters");
  }

  // Effects: Perform the request
  try {
    const data = await subgraphClient.request<{ trades: Trade[] }>(
      GET_TRADES_BY_MARKET,
      {
        marketId,
        first,
        skip,
        orderBy,
        orderDirection,
      }
    );

    // Interactions: Return data
    return data.trades || [];
  } catch (error) {
    console.error("Error fetching trades:", error);
    throw new Error("Failed to fetch trades");
  }
}

export async function getUserPortfolio(
  user: string
): Promise<UserPortfolio | null> {
  // Check: Validate input (assume Ethereum address format)
  if (!user || !/^0x[a-fA-F0-9]{40}$/.test(user)) {
    throw new Error("Valid user address is required");
  }

  // Effects: Perform the request
  try {
    const data = await subgraphClient.request<{
      userPortfolio: UserPortfolio | null;
    }>(GET_USER_PORTFOLIO, { user });

    // Interactions: Return data
    return data.userPortfolio;
  } catch (error) {
    console.error("Error fetching user portfolio:", error);
    throw new Error("Failed to fetch user portfolio");
  }
}

export async function getPriceHistory(
  marketId: string,
  optionId: string,
  first: number,
  skip: number,
  orderBy: string,
  orderDirection: string
): Promise<PriceHistory[]> {
  // Check: Validate inputs
  if (
    !marketId ||
    !optionId ||
    first <= 0 ||
    skip < 0 ||
    !["asc", "desc"].includes(orderDirection.toLowerCase())
  ) {
    throw new Error("Invalid parameters for price history");
  }

  // Effects: Perform the request
  try {
    const data = await subgraphClient.request<{
      priceHistories: PriceHistory[];
    }>(GET_PRICE_HISTORY, {
      marketId,
      optionId: BigInt(optionId), // Ensure BigInt for GraphQL
      first,
      skip,
      orderBy,
      orderDirection,
    });

    // Interactions: Return data
    return data.priceHistories || [];
  } catch (error) {
    console.error("Error fetching price history:", error);
    throw new Error("Failed to fetch price history");
  }
}

export async function getMarketAnalytics(
  marketId: string
): Promise<MarketAnalyticsData> {
  // Check: Validate input
  if (!marketId) {
    throw new Error("Market ID is required");
  }

  // Effects: Perform the request
  try {
    const data = await subgraphClient.request<MarketAnalyticsData>(
      GET_MARKET_ANALYTICS,
      { marketId: BigInt(marketId) }
    );

    // Interactions: Return data
    return data;
  } catch (error) {
    console.error("Error fetching market analytics:", error);
    throw new Error("Failed to fetch market analytics");
  }
}

// Interfaces (unchanged, matching queries)
export interface Market {
  id: string;
  question: string;
  description: string;
  options: string[];
  endTime: string;
  category: string;
  marketType: string;
  creator: string;
  resolved: boolean;
  winningOptionId?: string;
  invalidated: boolean;
  totalVolume: string;
  liquidity: string;
  createdAt: string;
  freeMarketConfig?: FreeMarketConfig;
}

export interface FreeMarketConfig {
  id: string;
  maxFreeParticipants: string;
  tokensPerParticipant: string;
  totalPrizePool: string;
  currentFreeParticipants: string;
  isActive: boolean;
}

export interface Trade {
  id: string;
  market: {
    id: string;
    question: string;
  };
  optionId: string;
  buyer: string;
  seller?: string;
  price: string;
  quantity: string;
  timestamp: string;
}

export interface UserPortfolio {
  id: string;
  totalInvested: string;
  totalWinnings: string;
  unrealizedPnL: string;
  realizedPnL: string;
  tradeCount: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: string;
  market: {
    id: string;
  };
  optionId: string;
  price: string;
  timestamp: string;
  volume: string;
}

export interface MarketResolved {
  id: string;
  marketId: string;
  outcome: number;
  blockNumber: string;
  blockTimestamp: string;
}

export interface MarketAnalyticsData {
  tradeExecuteds: Array<{
    optionId: string;
    price: string;
    quantity: string;
    blockNumber: string;
    blockTimestamp: string;
  }>;
}
