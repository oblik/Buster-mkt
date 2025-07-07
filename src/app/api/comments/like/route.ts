import { NextRequest, NextResponse } from "next/server";
import { toggleCommentLike } from "@/lib/supabase-comments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commentId, userAddress } = body;

    if (!commentId || !userAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await toggleCommentLike(commentId, userAddress);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to toggle like" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (error) {
    console.error("Error toggling comment like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}
