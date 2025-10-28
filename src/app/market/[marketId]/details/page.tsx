// No direct on-chain reads for details page unless fallback path kicks in.
import { notFound } from "next/navigation";
import { Metadata, ResolvingMetadata } from "next";
import { MarketDetailsClient } from "@/components/MarketDetailsClient";
import { fetchMarketData as fetchMarketDataFromMigration } from "@/lib/market-migration";
import { subgraphClient } from "@/lib/subgraph";
import { gql } from "graphql-request";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MarketSharesDisplay } from "@/components/market-shares-display";
import { customBase } from "@/constants/chains";

// V1 Market Info Contract Return
type MarketInfoV1ContractReturn = readonly [
  string, // question
  string, // optionA
  string, // optionB
  bigint, // endTime
  number, // outcome
  bigint, // totalOptionAShares
  bigint, // totalOptionBShares
  boolean // resolved
];

// V2 Market Info Contract Return
type MarketInfoV2ContractReturn = readonly [
  string, // question
  string, // description
  bigint, // endTime
  number, // category
  bigint, // optionCount
  boolean, // resolved
  boolean, // disputed
  bigint, // winningOptionId
  string, // creator
  boolean // earlyResolutionAllowed
];

interface Props {
  params: Promise<{ marketId: string }>;
}

export async function generateMetadata(
  { params }: { params: Promise<{ marketId: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { marketId } = await params;

  console.log("generateMetadata: Processing marketId:", marketId);

  if (!marketId || isNaN(Number(marketId))) {
    console.error("generateMetadata: Invalid marketId", marketId);
    return {
      title: "Market Not Found",
      description: "Unable to load market data for metadata",
    };
  }

  try {
    // Use the same migration fetch logic as the page for consistency
    const marketResult = await fetchMarketDataFromMigration(Number(marketId));

    let market: any;
    let yesPercent = "0.0";

    if (marketResult.version === "v1") {
      // fetchMarketDataFromMigration returns a Market object, not raw tuple
      market = marketResult.market as any;

      const total = market.totalOptionAShares + market.totalOptionBShares;
      yesPercent =
        total > 0n
          ? (Number((market.totalOptionAShares * 1000n) / total) / 10).toFixed(
              1
            )
          : "0.0";
    } else {
      // fetchMarketDataFromMigration returns a MarketV2 object with options array
      market = marketResult.market as any;

      // For V2, create a description with options
      const optionNames =
        market.options?.map((opt: any) =>
          typeof opt === "string" ? opt : opt.name
        ) || [];
      yesPercent = `Options: ${optionNames.join(", ")}`;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://buster-mkt.vercel.app";
    const imageUrl = `${baseUrl}/api/market-image?marketId=${marketId}`;

    const marketUrl = `${baseUrl}/market/${marketId}/details`;

    const description =
      market.version === "v1"
        ? `View market: ${market.question} - ${market.optionA}: ${yesPercent}%`
        : `View market: ${market.question} - ${market.optionCount} options available`;

    const miniAppEmbed = {
      version: "1" as const,
      imageUrl: imageUrl,
      button: {
        title: "View Market Details",
        action: {
          type: "launch_miniapp" as const,
          name: "Policast",
          url: marketUrl,
          iconUrl: "https://buster-mkt.vercel.app/icon.png",
          splashImageUrl: "https://buster-mkt.vercel.app/icon.jpg",
          splashBackgroundColor: "#131E2A",
        },
      },
    };

    const resolvedParent = await parent;
    const otherParentData = resolvedParent.other || {};

    // Ensure fc:miniapp is explicitly a string key
    const fcFrameKey = "fc:miniapp" as string;
    return {
      title: market.question,
      description,
      other: {
        ...otherParentData, // Spread parent's other metadata first
        [fcFrameKey]: JSON.stringify(miniAppEmbed),
      },
      metadataBase: new URL(baseUrl),
      openGraph: {
        title: market.question,
        description,
        images: [
          { url: imageUrl, width: 1200, height: 630, alt: market.question },
        ],
        url: marketUrl,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: market.question,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("generateMetadata: Error processing market metadata:", error);
    return {
      title: "Market Not Found",
      description: "Unable to load market data for metadata",
    };
  }
}

export default async function MarketDetailsPage({ params }: Props) {
  const { marketId } = await params;

  console.log(`=== MARKET DETAILS PAGE: Loading market ${marketId} ===`);

  if (!marketId || isNaN(Number(marketId))) {
    notFound();
  }

  try {
    // Subgraph-first for V2 markets; fallback to on-chain migration for V1 or gaps
    const QUERY = gql`
      query MarketById($marketId: String!) {
        marketCreateds(where: { marketId: $marketId }) {
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
        }
        marketInvalidateds(where: { marketId: $marketId }) {
          id
        }
        marketValidateds(where: { marketId: $marketId }) {
          id
        }
      }
    `;

    const data = (await subgraphClient.request(QUERY, { marketId })) as any;
    const created = Array.isArray(data?.marketCreateds)
      ? data.marketCreateds[0]
      : null;

    if (created) {
      const resolved = Array.isArray(data?.marketResolveds)
        ? data.marketResolveds[0]
        : null;
      const market = {
        question: String(created.question || ""),
        description: "",
        endTime: BigInt(created.endTime || 0),
        category: Number(created.category || 0),
        optionCount: Number((created.options || []).length),
        resolved: Boolean(!!resolved),
        disputed: false,
        winningOptionId: resolved ? Number(resolved.winningOptionId || 0) : 0,
        outcome: resolved ? Number(resolved.winningOptionId || 0) : 0,
        creator: String(
          created.creator || "0x0000000000000000000000000000000000000000"
        ),
        earlyResolutionAllowed: false,
        version: "v2" as const,
        options: (Array.isArray(created.options)
          ? created.options
          : []) as string[],
        optionShares: [],
        marketType: Number(created.marketType || 0),
      };
      return <MarketDetailsClient marketId={marketId} market={market} />;
    }

    // Fallback to on-chain migration util for V1 or if subgraph missing the V2 market
    const marketResult = await fetchMarketDataFromMigration(Number(marketId));
    console.log(
      `Subgraph miss -> migration fallback. Version:`,
      marketResult.version
    );

    let market: any;
    if (marketResult.version === "v1") {
      const marketData =
        marketResult.market as any as MarketInfoV1ContractReturn;
      market = {
        question: marketData[0],
        optionA: marketData[1],
        optionB: marketData[2],
        endTime: marketData[3],
        outcome: marketData[4],
        totalOptionAShares: marketData[5],
        totalOptionBShares: marketData[6],
        resolved: marketData[7],
        version: "v1",
        marketType: 0,
      };
    } else {
      const raw = marketResult.market as any;
      const options: string[] = Array.isArray(raw?.options) ? raw.options : [];
      market = {
        question: raw.question,
        description: raw.description,
        endTime: raw.endTime,
        category: raw.category,
        optionCount: Number(raw.optionCount ?? options.length ?? 0),
        resolved: Boolean(raw.resolved),
        disputed: Boolean(raw.disputed),
        winningOptionId: Number(raw.winningOptionId ?? 0),
        outcome: Number(raw.winningOptionId ?? 0),
        creator: raw.creator,
        earlyResolutionAllowed: Boolean(raw.earlyResolutionAllowed ?? false),
        version: "v2",
        options,
        optionShares: Array.isArray(raw.optionShares) ? raw.optionShares : [],
        marketType:
          Number((marketResult as any).marketType ?? raw.marketType ?? 0) || 0,
      };
    }

    return <MarketDetailsClient marketId={marketId} market={market} />;
  } catch (error) {
    console.error(`Failed to fetch market ${marketId}:`, error);
    notFound();
  }
}
