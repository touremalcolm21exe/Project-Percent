export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          event_type: string;
          actor_id: string | null;
          actor_ip: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          actor_id?: string | null;
          actor_ip?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Record<string, never>; // append-only; no updates permitted
      };
      audit_alerts: {
        Row: {
          id: string;
          alert_type: string;
          details: Record<string, unknown>;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          alert_type: string;
          details?: Record<string, unknown>;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          resolved_at?: string | null;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          plan: 'free' | 'premium';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          projects_created_count: number;
          full_name: string;
          phone_number: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          plan?: 'free' | 'premium';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          projects_created_count?: number;
          full_name?: string;
          phone_number?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan?: 'free' | 'premium';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          full_name?: string;
          phone_number?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          progress_percent: number;
          progress_color: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          progress_percent?: number;
          progress_color?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
          progress_percent?: number;
          progress_color?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          is_complete: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string;
          is_complete?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
          is_complete?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
    };
  };
}

export type Project = Database['public']['Tables']['projects']['Row'];
export type Milestone = Database['public']['Tables']['milestones']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
