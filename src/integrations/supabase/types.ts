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
      access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          message: string | null
          project_id: string
          requested_role: Database["public"]["Enums"]["project_role"]
          status: Database["public"]["Enums"]["access_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          project_id: string
          requested_role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["access_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          message?: string | null
          project_id?: string
          requested_role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["access_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
          project_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          project_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bugs: {
        Row: {
          bug_id: string | null
          comportamento_atual: string | null
          comportamento_esperado: string | null
          created_at: string
          id: string
          massa: string | null
          passos: string | null
          project_id: string
          severidade: Database["public"]["Enums"]["bug_severity"]
          status: Database["public"]["Enums"]["bug_status"]
          test_case_id: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          bug_id?: string | null
          comportamento_atual?: string | null
          comportamento_esperado?: string | null
          created_at?: string
          id?: string
          massa?: string | null
          passos?: string | null
          project_id: string
          severidade?: Database["public"]["Enums"]["bug_severity"]
          status?: Database["public"]["Enums"]["bug_status"]
          test_case_id?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          bug_id?: string | null
          comportamento_atual?: string | null
          comportamento_esperado?: string | null
          created_at?: string
          id?: string
          massa?: string | null
          passos?: string | null
          project_id?: string
          severidade?: Database["public"]["Enums"]["bug_severity"]
          status?: Database["public"]["Enums"]["bug_status"]
          test_case_id?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bugs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bugs_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_execucoes: {
        Row: {
          created_at: string
          evidencia: string
          executed_at: string
          executor: string
          id: string
          obtido: string
          project_id: string
          status: string
          test_case_id: string
        }
        Insert: {
          created_at?: string
          evidencia?: string
          executed_at?: string
          executor?: string
          id?: string
          obtido?: string
          project_id: string
          status: string
          test_case_id: string
        }
        Update: {
          created_at?: string
          evidencia?: string
          executed_at?: string
          executor?: string
          id?: string
          obtido?: string
          project_id?: string
          status?: string
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_execucoes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_execucoes_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: string
          project_id: string | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          project_id?: string | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          project_id?: string | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ambiente: string
          codigo_acesso: string | null
          created_at: string
          data_criacao: string | null
          id: string
          in_scope: string
          objetivo: string
          out_of_scope: string
          owner_id: string
          projeto: string
          responsavel: string
          ultima_revisao: string | null
          updated_at: string
          versao: string
        }
        Insert: {
          ambiente?: string
          codigo_acesso?: string | null
          created_at?: string
          data_criacao?: string | null
          id?: string
          in_scope?: string
          objetivo?: string
          out_of_scope?: string
          owner_id: string
          projeto?: string
          responsavel?: string
          ultima_revisao?: string | null
          updated_at?: string
          versao?: string
        }
        Update: {
          ambiente?: string
          codigo_acesso?: string | null
          created_at?: string
          data_criacao?: string | null
          id?: string
          in_scope?: string
          objetivo?: string
          out_of_scope?: string
          owner_id?: string
          projeto?: string
          responsavel?: string
          ultima_revisao?: string | null
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      risks: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          impacto: string | null
          mitigacao: string | null
          ordem: number
          probabilidade: string | null
          project_id: string
          responsavel: string | null
          risco_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          impacto?: string | null
          mitigacao?: string | null
          ordem?: number
          probabilidade?: string | null
          project_id: string
          responsavel?: string | null
          risco_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          impacto?: string | null
          mitigacao?: string | null
          ordem?: number
          probabilidade?: string | null
          project_id?: string
          responsavel?: string | null
          risco_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          atividade: string | null
          created_at: string
          fase: string | null
          fim: string | null
          id: string
          inicio: string | null
          ordem: number
          project_id: string
          responsavel: string | null
          status: string | null
        }
        Insert: {
          atividade?: string | null
          created_at?: string
          fase?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          ordem?: number
          project_id: string
          responsavel?: string | null
          status?: string | null
        }
        Update: {
          atividade?: string | null
          created_at?: string
          fase?: string | null
          fim?: string | null
          id?: string
          inicio?: string | null
          ordem?: number
          project_id?: string
          responsavel?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          created_at: string
          ct_id: string | null
          esperado: string | null
          evidencia: string | null
          executado_em: string | null
          executor: string | null
          id: string
          id_us: string | null
          massa: string | null
          modulo: string | null
          observacoes: string | null
          obtido: string | null
          passos: string | null
          precondicoes: string | null
          project_id: string
          status: Database["public"]["Enums"]["test_status"]
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ct_id?: string | null
          esperado?: string | null
          evidencia?: string | null
          executado_em?: string | null
          executor?: string | null
          id?: string
          id_us?: string | null
          massa?: string | null
          modulo?: string | null
          observacoes?: string | null
          obtido?: string | null
          passos?: string | null
          precondicoes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["test_status"]
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ct_id?: string | null
          esperado?: string | null
          evidencia?: string | null
          executado_em?: string | null
          executor?: string | null
          id?: string
          id_us?: string | null
          massa?: string | null
          modulo?: string | null
          observacoes?: string | null
          obtido?: string | null
          passos?: string | null
          precondicoes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["test_status"]
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stories: {
        Row: {
          ator: string | null
          created_at: string
          criterio1: string | null
          criterio2: string | null
          id: string
          modulo: string | null
          prioridade: string | null
          project_id: string
          sprint: string | null
          status: string | null
          story: string | null
          updated_at: string
          us_id: string | null
        }
        Insert: {
          ator?: string | null
          created_at?: string
          criterio1?: string | null
          criterio2?: string | null
          id?: string
          modulo?: string | null
          prioridade?: string | null
          project_id: string
          sprint?: string | null
          status?: string | null
          story?: string | null
          updated_at?: string
          us_id?: string | null
        }
        Update: {
          ator?: string | null
          created_at?: string
          criterio1?: string | null
          criterio2?: string | null
          id?: string
          modulo?: string | null
          prioridade?: string | null
          project_id?: string
          sprint?: string | null
          status?: string | null
          story?: string | null
          updated_at?: string
          us_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      tms_can_manage: { Args: { _pid: string }; Returns: boolean }
      tms_can_view: { Args: { _pid: string }; Returns: boolean }
      tms_can_write: { Args: { _pid: string }; Returns: boolean }
      tms_create_project: {
        Args: { _projeto: string }
        Returns: {
          ambiente: string
          codigo_acesso: string | null
          created_at: string
          data_criacao: string | null
          id: string
          in_scope: string
          objetivo: string
          out_of_scope: string
          owner_id: string
          projeto: string
          responsavel: string
          ultima_revisao: string | null
          updated_at: string
          versao: string
        }
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tms_decide_access_request: {
        Args: { _approve: boolean; _request_id: string }
        Returns: undefined
      }
      tms_generate_access_code: { Args: never; Returns: string }
      tms_is_owner: { Args: { _pid: string }; Returns: boolean }
      tms_join_by_code: { Args: { _code: string }; Returns: string }
      tms_notify_managers: {
        Args: { _actor: string; _data: Json; _pid: string; _type: string }
        Returns: undefined
      }
      tms_owns_project: { Args: { _project_id: string }; Returns: boolean }
      tms_project_preview: {
        Args: { _pid: string }
        Returns: {
          id: string
          member_count: number
          my_membership_status: string
          my_request_status: string
          objetivo: string
          owner_id: string
          projeto: string
        }[]
      }
      tms_project_role: {
        Args: { _pid: string; _uid: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      tms_request_access: {
        Args: { _message?: string; _pid: string }
        Returns: string
      }
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected" | "cancelled"
      audit_action: "create" | "update" | "delete"
      bug_severity: "Alta" | "Média" | "Baixa"
      bug_status: "Aberto" | "Em Correção" | "Corrigido" | "Retestado"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      member_status: "pending" | "accepted"
      project_role: "owner" | "admin" | "collaborator" | "viewer"
      test_status: "Pendente" | "Passou" | "Falhou" | "Bloqueado"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_request_status: ["pending", "approved", "rejected", "cancelled"],
      audit_action: ["create", "update", "delete"],
      bug_severity: ["Alta", "Média", "Baixa"],
      bug_status: ["Aberto", "Em Correção", "Corrigido", "Retestado"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      member_status: ["pending", "accepted"],
      project_role: ["owner", "admin", "collaborator", "viewer"],
      test_status: ["Pendente", "Passou", "Falhou", "Bloqueado"],
    },
  },
} as const
