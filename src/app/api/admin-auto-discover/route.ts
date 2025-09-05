import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { V2contractAddress, V2contractAbi } from "@/constants/contract";

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || "https://mainnet.base.org"
  ),
});

interface AdminWithdrawal {
  marketId: number;
  amount: bigint;
  type: "adminLiquidity" | "prizePool" | "lpRewards";
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json(
        { error: "User address is required" },
        { status: 400 }
      );
    }

    console.log("Auto-discovering admin withdrawals for user:", userAddress);

    // Discover all admin withdrawals available to user
    const adminWithdrawals = await discoverAdminWithdrawals(userAddress);

    console.log(`Found ${adminWithdrawals.length} admin withdrawals available`);

    // Group by type for easier frontend handling
    const groupedWithdrawals = {
      adminLiquidity: adminWithdrawals.filter(
        (w) => w.type === "adminLiquidity"
      ),
      prizePool: adminWithdrawals.filter((w) => w.type === "prizePool"),
      lpRewards: adminWithdrawals.filter((w) => w.type === "lpRewards"),
    };

    // Calculate totals
    const totals = {
      adminLiquidity: groupedWithdrawals.adminLiquidity.reduce(
        (sum, w) => sum + w.amount,
        0n
      ),
      prizePool: groupedWithdrawals.prizePool.reduce(
        (sum, w) => sum + w.amount,
        0n
      ),
      lpRewards: groupedWithdrawals.lpRewards.reduce(
        (sum, w) => sum + w.amount,
        0n
      ),
      total: adminWithdrawals.reduce((sum, w) => sum + w.amount, 0n),
    };

    return NextResponse.json({
      withdrawals: groupedWithdrawals,
      totals,
      totalCount: adminWithdrawals.length,
    });
  } catch (error) {
    console.error("Admin auto-discover error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to auto-discover admin withdrawals: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Discover all admin withdrawals available to user
async function discoverAdminWithdrawals(
  userAddress: string
): Promise<AdminWithdrawal[]> {
  const withdrawals: AdminWithdrawal[] = [];

  try {
    // Check markets in batches to avoid rate limits
    const batchSize = 10;
    const maxMarketId = 200; // Configurable upper limit

    for (let startId = 0; startId < maxMarketId; startId += batchSize) {
      const endId = Math.min(startId + batchSize, maxMarketId);

      try {
        const batchWithdrawals = await checkMarketBatchForAdmin(
          userAddress,
          startId,
          endId
        );
        withdrawals.push(...batchWithdrawals);

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Error checking markets ${startId}-${endId}:`, error);
        // Continue with next batch
      }
    }

    console.log(
      `Found ${withdrawals.length} admin withdrawals via batch checking`
    );
    return withdrawals;
  } catch (error) {
    console.error("Failed to discover admin withdrawals:", error);
    return [];
  }
}

// Check a batch of markets for admin withdrawal opportunities
async function checkMarketBatchForAdmin(
  userAddress: string,
  startId: number,
  endId: number
): Promise<AdminWithdrawal[]> {
  const withdrawals: AdminWithdrawal[] = [];

  for (let marketId = startId; marketId < endId; marketId++) {
    try {
      // Get market info to check creator and market type
      const marketInfo = await publicClient.readContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "getMarketInfo",
        args: [BigInt(marketId)],
      });

      if (!marketInfo) continue;

      const [
        question,
        description,
        endTime,
        category,
        optionCount,
        resolved,
        disputed,
        marketType,
        invalidated,
        winningOptionId,
        creator,
      ] = marketInfo as readonly [
        string,
        string,
        bigint,
        number,
        bigint,
        boolean,
        boolean,
        number,
        boolean,
        bigint,
        string,
        boolean
      ];

      // Check if user is the market creator
      const isCreator = creator.toLowerCase() === userAddress.toLowerCase();

      if (isCreator) {
        // 1. Check for admin liquidity withdrawal
        // We need to get market financials to check admin liquidity status
        try {
          const marketFinancials = await publicClient.readContract({
            address: V2contractAddress,
            abi: V2contractAbi,
            functionName: "getMarketFinancials",
            args: [BigInt(marketId)],
          });

          if (marketFinancials) {
            const [adminInitialLiquidity, , , , adminLiquidityClaimed] =
              marketFinancials as readonly [
                bigint,
                bigint,
                bigint,
                bigint,
                boolean
              ];

            if (!adminLiquidityClaimed && adminInitialLiquidity > 0n) {
              withdrawals.push({
                marketId,
                amount: adminInitialLiquidity,
                type: "adminLiquidity",
                description: `Admin liquidity for market "${question.slice(
                  0,
                  30
                )}..."`,
              });
            }
          }
        } catch (error) {
          console.debug(
            `Could not get financials for market ${marketId}:`,
            error
          );
        }

        // 2. Check for unused prize pool withdrawal (free markets only)
        const isFreeMarket = await checkIfFreeMarket(marketId);
        if (isFreeMarket && resolved) {
          // For free markets, we can't easily determine unused prize pool without more complex logic
          // This would require checking the free market config and current prize pool
          // For now, we'll skip this check as it's complex to implement without additional contract functions
        }
      }

      // 3. Check for LP rewards (any user can have LP position)
      try {
        const lpInfo = await publicClient.readContract({
          address: V2contractAddress,
          abi: V2contractAbi,
          functionName: "getLPInfo",
          args: [BigInt(marketId), userAddress as `0x${string}`],
        });

        if (lpInfo) {
          const [contribution, rewardsClaimed, estimatedRewards] =
            lpInfo as readonly [bigint, boolean, bigint];

          if (!rewardsClaimed && estimatedRewards > 0n) {
            withdrawals.push({
              marketId,
              amount: estimatedRewards,
              type: "lpRewards",
              description: `LP rewards for market "${question.slice(
                0,
                30
              )}..."`,
            });
          }
        }
      } catch (error) {
        console.debug(`Could not get LP info for market ${marketId}:`, error);
      }
    } catch (error) {
      // Market might not exist or other error, continue
      console.debug(`Market ${marketId} check failed:`, error);
    }
  }

  return withdrawals;
}

// Check if market is a free market
async function checkIfFreeMarket(marketId: number): Promise<boolean> {
  try {
    const freeMarketInfo = await publicClient.readContract({
      address: V2contractAddress,
      abi: V2contractAbi,
      functionName: "getFreeMarketInfo",
      args: [BigInt(marketId)],
    });

    // If we get data back, it's a free market
    return !!freeMarketInfo;
  } catch (error) {
    // If call fails, it's not a free market
    return false;
  }
}

// Get unused prize pool for a free market
async function getUnusedPrizePool(marketId: number): Promise<bigint> {
  try {
    // Note: This function doesn't exist in the current contract ABI
    // We'll return 0 for now as this requires additional contract functions
    console.debug(`getUnusedPrizePool not available for market ${marketId}`);
    return 0n;
  } catch (error) {
    console.error(
      `Error getting unused prize pool for market ${marketId}:`,
      error
    );
    return 0n;
  }
}
