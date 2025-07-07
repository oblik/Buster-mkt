import { NextRequest, NextResponse } from "next/server";
import { getComments, createComment } from "@/lib/supabase-comments";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const marketId = searchParams.get("marketId");
  const userAddress = searchParams.get("userAddress");

  if (!marketId) {
    return NextResponse.json(
      { error: "Market ID is required" },
      { status: 400 }
    );
  }

  try {
    const comments = await getComments(marketId, userAddress || undefined);
    return NextResponse.json({
      comments,
      total: comments.length,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, content, parentId, author } = body;

    if (!marketId || !content || !author?.address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (content.length > 500) {
      return NextResponse.json(
        { error: "Comment too long (max 500 characters)" },
        { status: 400 }
      );
    }

    const comment = await createComment({
      marketId,
      content,
      userAddress: author.address,
      fid: author.fid,
      username: author.username,
      pfpUrl: author.pfpUrl,
      parentId,
    });

    if (!comment) {
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        comment,
        message: "Comment posted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
