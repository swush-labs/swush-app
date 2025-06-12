export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          wallet_address: string
          nickname: string | null
          current_rank: string
          xp: number
          joined_at: string
        }
        Insert: {
          wallet_address: string
          nickname?: string | null
          current_rank?: string
          xp?: number
          joined_at?: string
        }
        Update: {
          wallet_address?: string
          nickname?: string | null
          current_rank?: string
          xp?: number
          joined_at?: string
        }
      }
      swap_history: {
        Row: {
          id: string
          user_wallet: string
          from_asset: string
          to_asset: string
          amount: number
          chain_from: string | null
          chain_to: string | null
          route_used: string
          status: string
          timestamp: string
        }
        Insert: {
          id?: string
          user_wallet: string
          from_asset: string
          to_asset: string
          amount: number
          chain_from?: string | null
          chain_to?: string | null
          route_used: string
          status?: string
          timestamp?: string
        }
        Update: {
          id?: string
          user_wallet?: string
          from_asset?: string
          to_asset?: string
          amount?: number
          chain_from?: string | null
          chain_to?: string | null
          route_used?: string
          status?: string
          timestamp?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 