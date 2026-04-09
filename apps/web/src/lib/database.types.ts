export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          username: string;
          avatar_url: string | null;
          role: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      chat_rooms: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_rooms']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['chat_rooms']['Insert']>;
      };
      chat_participants: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          is_pinned: boolean;
          is_archived: boolean;
          last_read_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_participants']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chat_participants']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          type: 'text' | 'image' | 'file' | 'location' | 'system';
          content: string | null;
          metadata: Json | null;
          reply_to_id: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_deleted'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['message_reactions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['message_reactions']['Insert']>;
      };
    };
  };
}
