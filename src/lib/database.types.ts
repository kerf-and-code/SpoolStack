export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      defect_types: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          domain_id: string
          id: number
          is_active: boolean
          is_process_related: boolean
          key: string
          likely_causes: string[]
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          domain_id: string
          id?: number
          is_active?: boolean
          is_process_related?: boolean
          key: string
          likely_causes?: string[]
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          domain_id?: string
          id?: number
          is_active?: boolean
          is_process_related?: boolean
          key?: string
          likely_causes?: string[]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "defect_types_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          sort_order: number
          unit_label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id: string
          is_active?: boolean
          sort_order?: number
          unit_label?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          unit_label?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          build_volume: string | null
          commissioned_on: string | null
          created_at: string
          domain_id: string
          expected_life_hours: number | null
          id: string
          is_active: boolean
          maintenance_cost_per_hour: number | null
          make: string | null
          model: string | null
          name: string
          notes: string | null
          nozzle_diameter_mm: number | null
          power_watts: number | null
          purchase_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          build_volume?: string | null
          commissioned_on?: string | null
          created_at?: string
          domain_id: string
          expected_life_hours?: number | null
          id?: string
          is_active?: boolean
          maintenance_cost_per_hour?: number | null
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          nozzle_diameter_mm?: number | null
          power_watts?: number | null
          purchase_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          build_volume?: string | null
          commissioned_on?: string | null
          created_at?: string
          domain_id?: string
          expected_life_hours?: number | null
          id?: string
          is_active?: boolean
          maintenance_cost_per_hour?: number | null
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          nozzle_diameter_mm?: number | null
          power_watts?: number | null
          purchase_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          cost_per_unit: number | null
          created_at: string
          density_g_cm3: number | null
          diameter_mm: number | null
          domain_id: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          package_cost: number | null
          package_qty: number | null
          spool_weight_g: number | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          color?: string | null
          cost_per_unit?: number | null
          created_at?: string
          density_g_cm3?: number | null
          diameter_mm?: number | null
          domain_id: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          package_cost?: number | null
          package_qty?: number | null
          spool_weight_g?: number | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          color?: string | null
          cost_per_unit?: number | null
          created_at?: string
          density_g_cm3?: number | null
          diameter_mm?: number | null
          domain_id?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          package_cost?: number | null
          package_qty?: number | null
          spool_weight_g?: number | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      parameter_defs: {
        Row: {
          created_at: string
          data_type: string
          default_value: string | null
          display_name: string
          domain_id: string
          enum_options: string[] | null
          group_name: string
          help_text: string | null
          id: number
          is_active: boolean
          is_calibration_relevant: boolean
          is_required: boolean
          key: string
          max_value: number | null
          min_value: number | null
          sort_order: number
          step: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          data_type?: string
          default_value?: string | null
          display_name: string
          domain_id: string
          enum_options?: string[] | null
          group_name?: string
          help_text?: string | null
          id?: number
          is_active?: boolean
          is_calibration_relevant?: boolean
          is_required?: boolean
          key: string
          max_value?: number | null
          min_value?: number | null
          sort_order?: number
          step?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          data_type?: string
          default_value?: string | null
          display_name?: string
          domain_id?: string
          enum_options?: string[] | null
          group_name?: string
          help_text?: string | null
          id?: number
          is_active?: boolean
          is_calibration_relevant?: boolean
          is_required?: boolean
          key?: string
          max_value?: number | null
          min_value?: number | null
          sort_order?: number
          step?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parameter_defs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sale_price: number | null
          status: string
          target_quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sale_price?: number | null
          status?: string
          target_quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sale_price?: number | null
          status?: string
          target_quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      run_defects: {
        Row: {
          created_at: string
          defect_type_id: number
          id: number
          notes: string | null
          photo_path: string | null
          run_id: string
          severity: number | null
        }
        Insert: {
          created_at?: string
          defect_type_id: number
          id?: number
          notes?: string | null
          photo_path?: string | null
          run_id: string
          severity?: number | null
        }
        Update: {
          created_at?: string
          defect_type_id?: number
          id?: number
          notes?: string | null
          photo_path?: string | null
          run_id?: string
          severity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "run_defects_defect_type_id_fkey"
            columns: ["defect_type_id"]
            isOneToOne: false
            referencedRelation: "defect_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_defects_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "run_cost_breakdown"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_defects_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_photos: {
        Row: {
          bytes: number | null
          caption: string | null
          created_at: string
          defect_type_id: number | null
          height: number | null
          id: string
          kind: string
          run_id: string
          storage_path: string
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          defect_type_id?: number | null
          height?: number | null
          id?: string
          kind?: string
          run_id: string
          storage_path: string
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          bytes?: number | null
          caption?: string | null
          created_at?: string
          defect_type_id?: number | null
          height?: number | null
          id?: string
          kind?: string
          run_id?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "run_photos_defect_type_id_fkey"
            columns: ["defect_type_id"]
            isOneToOne: false
            referencedRelation: "defect_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_photos_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "run_cost_breakdown"
            referencedColumns: ["run_id"]
          },
          {
            foreignKeyName: "run_photos_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          active_labor_minutes: number
          completed_at: string | null
          created_at: string
          domain_id: string
          duration_minutes: number | null
          id: string
          machine_id: string | null
          material_id: string | null
          material_qty_estimated: boolean
          material_qty_used: number | null
          notes: string | null
          outcome: string
          parameters: Json
          photos: string[]
          project_id: string | null
          quality_rating: number | null
          source: string
          source_metadata: Json
          started_at: string | null
          tags: string[]
          title: string | null
          units_good: number | null
          units_produced: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_labor_minutes?: number
          completed_at?: string | null
          created_at?: string
          domain_id: string
          duration_minutes?: number | null
          id?: string
          machine_id?: string | null
          material_id?: string | null
          material_qty_estimated?: boolean
          material_qty_used?: number | null
          notes?: string | null
          outcome: string
          parameters?: Json
          photos?: string[]
          project_id?: string | null
          quality_rating?: number | null
          source?: string
          source_metadata?: Json
          started_at?: string | null
          tags?: string[]
          title?: string | null
          units_good?: number | null
          units_produced?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_labor_minutes?: number
          completed_at?: string | null
          created_at?: string
          domain_id?: string
          duration_minutes?: number | null
          id?: string
          machine_id?: string | null
          material_id?: string | null
          material_qty_estimated?: boolean
          material_qty_used?: number | null
          notes?: string | null
          outcome?: string
          parameters?: Json
          photos?: string[]
          project_id?: string | null
          quality_rating?: number | null
          source?: string
          source_metadata?: Json
          started_at?: string | null
          tags?: string[]
          title?: string | null
          units_good?: number | null
          units_produced?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          currency: string
          default_domain_id: string | null
          display_name: string | null
          electricity_rate_per_kwh: number | null
          include_labor_in_cost: boolean
          labor_rate_per_hour: number | null
          units: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          default_domain_id?: string | null
          display_name?: string | null
          electricity_rate_per_kwh?: number | null
          include_labor_in_cost?: boolean
          labor_rate_per_hour?: number | null
          units?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          default_domain_id?: string | null
          display_name?: string | null
          electricity_rate_per_kwh?: number | null
          include_labor_in_cost?: boolean
          labor_rate_per_hour?: number | null
          units?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_domain_id_fkey"
            columns: ["default_domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      run_cost_breakdown: {
        Row: {
          active_labor_minutes: number | null
          cost_complete: boolean | null
          cost_per_good_unit: number | null
          cost_per_unit_produced: number | null
          created_at: string | null
          currency: string | null
          domain_id: string | null
          duration_minutes: number | null
          electricity_rate_per_kwh: number | null
          energy_cost: number | null
          expected_life_hours: number | null
          include_labor_in_cost: boolean | null
          labor_cost: number | null
          labor_rate_per_hour: number | null
          machine_cost: number | null
          machine_id: string | null
          machine_purchase_cost: number | null
          maintenance_cost_per_hour: number | null
          material_cost: number | null
          material_cost_per_unit: number | null
          material_id: string | null
          material_qty_estimated: boolean | null
          material_qty_used: number | null
          missing_inputs: string[] | null
          outcome: string | null
          power_watts: number | null
          project_id: string | null
          run_id: string | null
          title: string | null
          total_cost: number | null
          units_good: number | null
          units_produced: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
