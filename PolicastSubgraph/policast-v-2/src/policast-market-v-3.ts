import { BigInt } from "@graphprotocol/graph-ts";
import {
  AdminLiquidityWithdrawn as AdminLiquidityWithdrawnEvent,
  BComputed as BComputedEvent,
  Claimed as ClaimedEvent,
  FeeAccrued as FeeAccruedEvent,
  FeeCollectorUpdated as FeeCollectorUpdatedEvent,
  FeesUnlocked as FeesUnlockedEvent,
  FreeMarketConfigSet as FreeMarketConfigSetEvent,
  FreeTokensClaimed as FreeTokensClaimedEvent,
  MarketCreated as MarketCreatedEvent,
  MarketDisputed as MarketDisputedEvent,
  MarketInvalidated as MarketInvalidatedEvent,
  MarketResolved as MarketResolvedEvent,
  MarketValidated as MarketValidatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Paused as PausedEvent,
  PlatformFeesWithdrawn as PlatformFeesWithdrawnEvent,
  RoleAdminChanged as RoleAdminChangedEvent,
  RoleGranted as RoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
  SlippageProtect as SlippageProtectEvent,
  TradeExecuted as TradeExecutedEvent,
  Unpaused as UnpausedEvent,
  UnusedPrizePoolWithdrawn as UnusedPrizePoolWithdrawnEvent,
  UserPortfolioUpdated as UserPortfolioUpdatedEvent,
} from "../generated/PolicastMarketV3/PolicastMarketV3";
import {
  AdminLiquidityWithdrawn,
  BComputed,
  Claimed,
  FeeAccrued,
  FeeCollectorUpdated,
  FeesUnlocked,
  FreeMarketConfigSet,
  FreeTokensClaimed,
  MarketCreated,
  MarketDisputed,
  MarketInvalidated,
  MarketResolved,
  MarketValidated,
  OwnershipTransferred,
  Paused,
  PlatformFeesWithdrawn,
  RoleAdminChanged,
  RoleGranted,
  RoleRevoked,
  SlippageProtect,
  TradeExecuted,
  Unpaused,
  UnusedPrizePoolWithdrawn,
  UserPortfolioUpdated,
  UserPortfolio,
} from "../generated/schema";

export function handleAdminLiquidityWithdrawn(
  event: AdminLiquidityWithdrawnEvent
): void {
  let entity = new AdminLiquidityWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.creator = event.params.creator;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleBComputed(event: BComputedEvent): void {
  let entity = new BComputed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.bValue = event.params.bValue;
  entity.coverageRatioNum = event.params.coverageRatioNum;
  entity.coverageRatioDen = event.params.coverageRatioDen;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleClaimed(event: ClaimedEvent): void {
  let entity = new Claimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.user = event.params.user;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleFeeAccrued(event: FeeAccruedEvent): void {
  let entity = new FeeAccrued(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.optionId = event.params.optionId;
  entity.isBuy = event.params.isBuy;
  entity.rawAmount = event.params.rawAmount;
  entity.fee = event.params.fee;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleFeeCollectorUpdated(
  event: FeeCollectorUpdatedEvent
): void {
  let entity = new FeeCollectorUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.oldCollector = event.params.oldCollector;
  entity.newCollector = event.params.newCollector;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleFeesUnlocked(event: FeesUnlockedEvent): void {
  let entity = new FeesUnlocked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleFreeMarketConfigSet(
  event: FreeMarketConfigSetEvent
): void {
  let entity = new FreeMarketConfigSet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.maxFreeParticipants = event.params.maxFreeParticipants;
  entity.tokensPerParticipant = event.params.tokensPerParticipant;
  entity.totalPrizePool = event.params.totalPrizePool;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleFreeTokensClaimed(event: FreeTokensClaimedEvent): void {
  let entity = new FreeTokensClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.user = event.params.user;
  entity.tokens = event.params.tokens;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleMarketCreated(event: MarketCreatedEvent): void {
  let entity = new MarketCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.question = event.params.question;
  entity.options = event.params.options;
  entity.endTime = event.params.endTime;
  entity.category = event.params.category;
  entity.marketType = event.params.marketType;
  entity.creator = event.params.creator;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleMarketDisputed(event: MarketDisputedEvent): void {
  let entity = new MarketDisputed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.disputer = event.params.disputer;
  entity.reason = event.params.reason;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleMarketInvalidated(event: MarketInvalidatedEvent): void {
  let entity = new MarketInvalidated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.validator = event.params.validator;
  entity.refundedAmount = event.params.refundedAmount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleMarketResolved(event: MarketResolvedEvent): void {
  let entity = new MarketResolved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.winningOptionId = event.params.winningOptionId;
  entity.resolver = event.params.resolver;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleMarketValidated(event: MarketValidatedEvent): void {
  let entity = new MarketValidated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.validator = event.params.validator;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.previousOwner = event.params.previousOwner;
  entity.newOwner = event.params.newOwner;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handlePaused(event: PausedEvent): void {
  let entity = new Paused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.account = event.params.account;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handlePlatformFeesWithdrawn(
  event: PlatformFeesWithdrawnEvent
): void {
  let entity = new PlatformFeesWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.collector = event.params.collector;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleRoleAdminChanged(event: RoleAdminChangedEvent): void {
  let entity = new RoleAdminChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.role = event.params.role;
  entity.previousAdminRole = event.params.previousAdminRole;
  entity.newAdminRole = event.params.newAdminRole;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleRoleGranted(event: RoleGrantedEvent): void {
  let entity = new RoleGranted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.role = event.params.role;
  entity.account = event.params.account;
  entity.sender = event.params.sender;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleRoleRevoked(event: RoleRevokedEvent): void {
  let entity = new RoleRevoked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.role = event.params.role;
  entity.account = event.params.account;
  entity.sender = event.params.sender;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleSlippageProtect(event: SlippageProtectEvent): void {
  let entity = new SlippageProtect(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.optionId = event.params.optionId;
  entity.isBuy = event.params.isBuy;
  entity.quantity = event.params.quantity;
  entity.bound = event.params.bound;
  entity.actualTotal = event.params.actualTotal;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleTradeExecuted(event: TradeExecutedEvent): void {
  let entity = new TradeExecuted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.optionId = event.params.optionId;
  entity.buyer = event.params.buyer;
  entity.seller = event.params.seller;
  entity.price = event.params.price;
  entity.quantity = event.params.quantity;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleUnpaused(event: UnpausedEvent): void {
  let entity = new Unpaused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.account = event.params.account;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleUnusedPrizePoolWithdrawn(
  event: UnusedPrizePoolWithdrawnEvent
): void {
  let entity = new UnusedPrizePoolWithdrawn(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.marketId = event.params.marketId;
  entity.creator = event.params.creator;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleUserPortfolioUpdated(
  event: UserPortfolioUpdatedEvent
): void {
  let entity = new UserPortfolioUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  entity.user = event.params.user;
  entity.totalInvested = event.params.totalInvested;
  entity.totalWinnings = event.params.totalWinnings;
  entity.unrealizedPnL = event.params.unrealizedPnL;
  entity.realizedPnL = event.params.realizedPnL;
  entity.tradeCount = event.params.tradeCount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();

  // Upsert aggregate per-user portfolio for fast leaderboard queries
  let userId = event.params.user;
  let portfolio = UserPortfolio.load(userId);
  if (portfolio == null) {
    portfolio = new UserPortfolio(userId);
    portfolio.totalInvested = BigInt.zero();
    portfolio.totalWinnings = BigInt.zero();
    portfolio.unrealizedPnL = BigInt.zero();
    portfolio.realizedPnL = BigInt.zero();
    portfolio.tradeCount = BigInt.zero();
    portfolio.updatedAt = BigInt.zero();
  }

  portfolio.totalInvested = event.params.totalInvested;
  portfolio.totalWinnings = event.params.totalWinnings;
  portfolio.unrealizedPnL = event.params.unrealizedPnL;
  portfolio.realizedPnL = event.params.realizedPnL;
  portfolio.tradeCount = event.params.tradeCount;
  portfolio.updatedAt = event.block.timestamp;
  portfolio.save();
}
