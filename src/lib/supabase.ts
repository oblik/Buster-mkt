import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Create client with error handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Disable auth for now since we're using wallet auth
  },
});

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co"
  );
};

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          address: string;
          fid: string | null;
          username: string | null;
          pfp_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          address: string;
          fid?: string | null;
          username?: string | null;
          pfp_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          address?: string;
          fid?: string | null;
          username?: string | null;
          pfp_url?: string | null;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          market_id: string;
          content: string;
          user_id: string;
          parent_id: string | null;
          likes_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          content: string;
          user_id: string;
          parent_id?: string | null;
          likes_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          market_id?: string;
          content?: string;
          user_id?: string;
          parent_id?: string | null;
          likes_count?: number;
          created_at?: string;
        };
      };
      comment_likes: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          comment_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
    };
  };
}
