export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      complaints: {
        Row: {
          area: string;
          assigned_authority_id: string | null;
          assigned_authority_name: string | null;
          assigned_contact: string | null;
          assigned_office: string | null;
          authority: string;
          citizen_confirmed_at: string | null;
          code: string;
          created_at: string;
          description: string;
          escalation_level: number;
          expected_by: string;
          forwarded_at: string | null;
          forwarded_reference: string | null;
          id: string;
          lat: number;
          lng: number;
          mcd_category_id: number | null;
          mcd_subcategory_id: number | null;
          photo_url: string | null;
          priority_reasoning: string;
          priority_score: number;
          problem: string;
          read: boolean;
          recommended_action: string;
          reopened_count: number;
          routing_distance_km: number | null;
          routing_sla_deadline: string | null;
          routing_status: string;
          severity: string;
          status: string;
          timeline: Json;
          type: string;
          updated_at: string;
          ward: string;
        };
        Insert: {
          area?: string;
          assigned_authority_id?: string | null;
          assigned_authority_name?: string | null;
          assigned_contact?: string | null;
          assigned_office?: string | null;
          authority: string;
          citizen_confirmed_at?: string | null;
          code?: string;
          created_at?: string;
          description: string;
          escalation_level?: number;
          expected_by: string;
          forwarded_at?: string | null;
          forwarded_reference?: string | null;
          id?: string;
          lat: number;
          lng: number;
          mcd_category_id?: number | null;
          mcd_subcategory_id?: number | null;
          photo_url?: string | null;
          priority_reasoning?: string;
          priority_score?: number;
          problem: string;
          read?: boolean;
          recommended_action: string;
          reopened_count?: number;
          routing_distance_km?: number | null;
          routing_sla_deadline?: string | null;
          routing_status?: string;
          severity: string;
          status?: string;
          timeline?: Json;
          type: string;
          updated_at?: string;
          ward: string;
        };
        Update: {
          area?: string;
          assigned_authority_id?: string | null;
          assigned_authority_name?: string | null;
          assigned_contact?: string | null;
          assigned_office?: string | null;
          authority?: string;
          citizen_confirmed_at?: string | null;
          code?: string;
          created_at?: string;
          description?: string;
          escalation_level?: number;
          expected_by?: string;
          forwarded_at?: string | null;
          forwarded_reference?: string | null;
          id?: string;
          lat?: number;
          lng?: number;
          mcd_category_id?: number | null;
          mcd_subcategory_id?: number | null;
          photo_url?: string | null;
          priority_reasoning?: string;
          priority_score?: number;
          problem?: string;
          read?: boolean;
          recommended_action?: string;
          reopened_count?: number;
          routing_distance_km?: number | null;
          routing_sla_deadline?: string | null;
          routing_status?: string;
          severity?: string;
          status?: string;
          timeline?: Json;
          type?: string;
          updated_at?: string;
          ward?: string;
        };
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_authority_id_fkey";
            columns: ["assigned_authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
        ];
      };
      authorities: {
        Row: {
          address: string;
          authority_type: string;
          contact_email: string | null;
          contact_phone: string;
          created_at: string;
          escalation_parent_id: string | null;
          id: string;
          is_active: boolean;
          issue_types: string[];
          lat: number;
          level: string;
          lng: number;
          name: string;
          office_name: string;
          source_note: string;
        };
        Insert: {
          address: string;
          authority_type: string;
          contact_email?: string | null;
          contact_phone: string;
          created_at?: string;
          escalation_parent_id?: string | null;
          id?: string;
          is_active?: boolean;
          issue_types: string[];
          lat: number;
          level?: string;
          lng: number;
          name: string;
          office_name: string;
          source_note?: string;
        };
        Update: {
          address?: string;
          authority_type?: string;
          contact_email?: string | null;
          contact_phone?: string;
          created_at?: string;
          escalation_parent_id?: string | null;
          id?: string;
          is_active?: boolean;
          issue_types?: string[];
          lat?: number;
          level?: string;
          lng?: number;
          name?: string;
          office_name?: string;
          source_note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "authorities_escalation_parent_id_fkey";
            columns: ["escalation_parent_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
        ];
      };
      complaint_routing_events: {
        Row: {
          actor: string;
          authority_id: string | null;
          authority_name: string;
          complaint_id: string;
          created_at: string;
          distance_km: number | null;
          event_type: string;
          id: string;
          note: string;
          office_name: string | null;
        };
        Insert: {
          actor?: string;
          authority_id?: string | null;
          authority_name: string;
          complaint_id: string;
          created_at?: string;
          distance_km?: number | null;
          event_type: string;
          id?: string;
          note: string;
          office_name?: string | null;
        };
        Update: {
          actor?: string;
          authority_id?: string | null;
          authority_name?: string;
          complaint_id?: string;
          created_at?: string;
          distance_km?: number | null;
          event_type?: string;
          id?: string;
          note?: string;
          office_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "complaint_routing_events_complaint_id_fkey";
            columns: ["complaint_id"];
            isOneToOne: false;
            referencedRelation: "complaints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "complaint_routing_events_authority_id_fkey";
            columns: ["authority_id"];
            isOneToOne: false;
            referencedRelation: "authorities";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
