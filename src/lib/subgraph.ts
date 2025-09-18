import { GraphQLClient } from "graphql-request";

// Your deployed subgraph URL
const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/121109/policast/v0.0.1";

export const subgraphClient = new GraphQLClient(SUBGRAPH_URL);

// GraphQL queries for V3 entities
export const GET_MARKETS = `
  query GetMarkets($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
    markets(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      question
      description
      options
      endTime
      category
      marketType
      creator
      resolved
      winningOptionId
      invalidated
      totalVolume
      liquidity
      createdAt
      freeMarketConfig {
        id
        maxFreeParticipants
        tokensPerParticipant
        totalPrizePool
        currentFreeParticipants
        isActive
      }
    }
  }
`;

export const GET_MARKET_BY_ID = `
  query GetMarketById($id: ID!) {
    market(id: $id) {
      id
      question
      description
      options
      endTime
      category
      marketType
      creator
      resolved
      winningOptionId
      invalidated
      totalVolume
      liquidity
      createdAt
      freeMarketConfig {
        id
        maxFreeParticipants
        tokensPerParticipant
        totalPrizePool
        currentFreeParticipants
        isActive
      }
    }
  }
`;

export const GET_TRADES_BY_MARKET = `
  query GetTradesByMarket($marketId: String!, $first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
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

export const GET_USER_PORTFOLIO = `
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

export const GET_PRICE_HISTORY = `
  query GetPriceHistory($marketId: String!, $optionId: BigInt!, $first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
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

export const GET_MARKET_ANALYTICS = `
  query GetMarketAnalytics($marketId: String!) {
    sharesPurchaseds(where: { market: $marketId }, first: 1000, orderBy: "blockNumber", orderDirection: "asc") {
      id
      market {
        id
      }
      optionId
      buyer
      price
      amount
      blockNumber
      blockTimestamp
      isOptionA
    }
    marketCreateds(where: { market: $marketId }) {
      id
      market {
        id
      }
      creator
      timestamp
    }
  }
`;

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
  marketCreateds: any[];
  sharesPurchaseds: any[];
}
