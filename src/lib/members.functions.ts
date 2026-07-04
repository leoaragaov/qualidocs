import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProjectRole = "owner" | "admin" | "collaborator" | "viewer";

export type MemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  status: "pending" | "accepted";
  created_at: string;
  email: string;
  name: string;
};

export type InvitationRow = {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
};

// ---------- list members ----------
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MemberRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("project_members")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    const members = (rows ?? []) as any[];
    const ids = Array.from(new Set(members.map((m) => m.user_id))).filter(Boolean);
    const info: Record<string, { email: string; name: string }> = {};
    if (ids.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await Promise.all(
          ids.map(async (uid) => {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (u?.user) {
              info[uid] = {
                email: u.user.email ?? "",
                name:
                  (u.user.user_metadata?.full_name as string | undefined) ??
                  (u.user.user_metadata?.name as string | undefined) ??
                  "",
              };
            }
          }),
        );
      } catch {}
    }
    return members.map((m) => ({
      ...m,
      email: info[m.user_id]?.email ?? "",
      name: info[m.user_id]?.name ?? "",
    })) as MemberRow[];
  });

// ---------- list invitations ----------
export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<InvitationRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("project_invitations")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as InvitationRow[];
  });

const roleEnum = z.enum(["owner", "admin", "collaborator", "viewer"]);

// ---------- invite (creates invitation OR direct membership if user exists) ----------
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      project_id: z.string().uuid(),
      email: z.string().email().max(255),
      role: roleEnum.exclude(["owner"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Auth: user must be manager
    const { data: myMember, error: memberErr } = await context.supabase
      .from("project_members")
      .select("role")
      .eq("project_id", data.project_id)
      .eq("user_id", context.userId)
      .eq("status", "accepted")
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (myMember?.role !== "owner" && myMember?.role !== "admin") {
      throw new Error("Sem permissão para convidar membros.");
    }

    const email = data.email.trim().toLowerCase();

    // Look up existing auth user
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let existingUserId: string | null = null;
    try {
      // best-effort: list a page and match. For large user bases, use a targeted query.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      existingUserId = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
    } catch {}

    // Create invitation record
    const { data: inv, error: invErr } = await context.supabase
      .from("project_invitations")
      .insert({
        project_id: data.project_id,
        email,
        role: data.role,
        invited_by: context.userId,
      })
      .select("*")
      .single();
    if (invErr) throw new Error(invErr.message);

    // If user exists, also pre-create a pending membership placeholder? Keep flow uniform:
    // require accept via link so the invited user chooses when to join.
    return { invitation: inv as InvitationRow, existingUser: !!existingUserId };
  });

// ---------- accept invitation ----------
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(8).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("project_invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !inv) throw new Error("Convite não encontrado.");
    if (inv.status !== "pending") throw new Error("Convite já utilizado ou revogado.");
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("project_invitations").update({ status: "expired" }).eq("id", inv.id);
      throw new Error("Convite expirado.");
    }
    const claimsEmail = ((context.claims as any)?.email ?? "").toLowerCase();
    if (claimsEmail && claimsEmail !== inv.email.toLowerCase()) {
      throw new Error(`Este convite é para ${inv.email}. Faça login com esse e-mail.`);
    }

    // Insert membership (admin-side to bypass RLS)
    const { error: mErr } = await supabaseAdmin.from("project_members").upsert(
      {
        project_id: inv.project_id,
        user_id: context.userId,
        role: inv.role,
        invited_by: inv.invited_by,
        invited_at: inv.created_at,
        accepted_at: new Date().toISOString(),
        status: "accepted",
      },
      { onConflict: "project_id,user_id" },
    );
    if (mErr) throw new Error(mErr.message);

    await supabaseAdmin
      .from("project_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: context.userId,
      })
      .eq("id", inv.id);

    return { project_id: inv.project_id as string };
  });

// ---------- update role ----------
export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      role: roleEnum.exclude(["owner"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_members")
      .update({ role: data.role })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- remove member ----------
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- revoke invitation ----------
export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- resend (renew token/expires) ----------
export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("project_invitations")
      .update({
        status: "pending",
        expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as InvitationRow;
  });

// ---------- current-user role for a project ----------
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("project_members")
      .select("role")
      .eq("project_id", data.project_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { role: (row?.role ?? null) as ProjectRole | null };
  });

// ---------- join by access code (now creates a pending access request) ----------
export const joinProjectByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(3).max(20) }).parse(d))
  .handler(async ({ data, context }): Promise<{ project_id: string; already_member: boolean }> => {
    const { data: pid, error } = await context.supabase.rpc("tms_join_by_code", { _code: data.code });
    if (error) throw new Error(error.message);
    if (!pid) throw new Error("Código inválido");
    const { data: member } = await context.supabase
      .from("project_members")
      .select("role")
      .eq("project_id", pid as string)
      .eq("user_id", context.userId)
      .eq("status", "accepted")
      .maybeSingle();
    return { project_id: pid as string, already_member: member?.role != null };
  });

// ---------- request access directly by project id ----------
export const requestProjectAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      project_id: z.string().uuid(),
      message: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("tms_request_access", {
      _pid: data.project_id,
      _message: data.message ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

// ---------- project preview for non-members (safe fields only) ----------
export type ProjectPreview = {
  id: string;
  projeto: string;
  objetivo: string | null;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  member_count: number;
  my_membership_status: string | null;
  my_request_status: string | null;
};

export const getProjectPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProjectPreview | null> => {
    const { data: row, error } = await context.supabase
      .rpc("tms_project_preview", { _pid: data.project_id })
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    let owner_email = "";
    let owner_name = "";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById((row as any).owner_id);
      if (u?.user) {
        owner_email = u.user.email ?? "";
        owner_name =
          (u.user.user_metadata?.full_name as string | undefined) ??
          (u.user.user_metadata?.name as string | undefined) ??
          owner_email.split("@")[0] ??
          "";
      }
    } catch { /* ignore */ }
    return {
      id: (row as any).id,
      projeto: (row as any).projeto,
      objetivo: (row as any).objetivo,
      owner_id: (row as any).owner_id,
      owner_name,
      owner_email,
      member_count: Number((row as any).member_count ?? 0),
      my_membership_status: (row as any).my_membership_status ?? null,
      my_request_status: (row as any).my_request_status ?? null,
    };
  });

// ---------- access requests (manager side) ----------
export type AccessRequestRow = {
  id: string;
  project_id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_role: ProjectRole;
  message: string | null;
  created_at: string;
  decided_at: string | null;
  email: string;
  name: string;
};

export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AccessRequestRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("access_requests")
      .select("*")
      .eq("project_id", data.project_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    const ids = Array.from(new Set(list.map((r) => r.user_id))).filter(Boolean);
    const info: Record<string, { email: string; name: string }> = {};
    if (ids.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await Promise.all(
          ids.map(async (uid) => {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (u?.user) {
              info[uid] = {
                email: u.user.email ?? "",
                name:
                  (u.user.user_metadata?.full_name as string | undefined) ??
                  (u.user.user_metadata?.name as string | undefined) ??
                  "",
              };
            }
          }),
        );
      } catch { /* ignore */ }
    }
    return list.map((r) => ({
      ...r,
      email: info[r.user_id]?.email ?? "",
      name: info[r.user_id]?.name ?? "",
    })) as AccessRequestRow[];
  });

export const decideAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("tms_decide_access_request", {
      _request_id: data.id,
      _approve: data.approve,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- notifications ----------
export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  project_id: string | null;
  actor_id: string | null;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
  project_name: string | null;
  actor_name: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const pids = Array.from(new Set(list.map((n) => n.project_id).filter(Boolean))) as string[];
    const pmap: Record<string, string> = {};
    if (pids.length) {
      const { data: projs } = await context.supabase
        .from("projects")
        .select("id,projeto")
        .in("id", pids);
      (projs ?? []).forEach((p: any) => { pmap[p.id] = p.projeto; });
    }

    const aids = Array.from(new Set(list.map((n) => n.actor_id).filter(Boolean))) as string[];
    const amap: Record<string, string> = {};
    if (aids.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await Promise.all(
          aids.map(async (uid) => {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (u?.user) {
              amap[uid] =
                (u.user.user_metadata?.full_name as string | undefined) ??
                (u.user.user_metadata?.name as string | undefined) ??
                u.user.email ??
                "";
            }
          }),
        );
      } catch { /* ignore */ }
    }

    return list.map((n) => ({
      ...n,
      project_name: n.project_id ? pmap[n.project_id] ?? null : null,
      actor_name: n.actor_id ? amap[n.actor_id] ?? "" : "",
    })) as NotificationRow[];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ ids: z.array(z.string().uuid()).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const base = context.supabase.from("notifications").update({ read_at: new Date().toISOString() });
    const q = data.ids && data.ids.length
      ? base.in("id", data.ids)
      : base.is("read_at", null).eq("user_id", context.userId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- list projects grouped by role ----------
export type MyProjectSummary = {
  id: string;
  projeto: string;
  objetivo: string | null;
  updated_at: string;
  codigo_acesso: string | null;
  owner_id: string;
  owner_name: string;
  my_role: ProjectRole;
  member_count: number;
  pending_requests: number;
};

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ owned: MyProjectSummary[]; collaborating: MyProjectSummary[] }> => {
      const { data: projects, error } = await context.supabase
        .from("projects")
        .select("id,projeto,objetivo,updated_at,codigo_acesso,owner_id")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      const list = (projects ?? []) as any[];
      const ids = list.map((p) => p.id);
      if (!ids.length) return { owned: [], collaborating: [] };

      const [membersRes, requestsRes] = await Promise.all([
        context.supabase.from("project_members").select("project_id,user_id,role,status").in("project_id", ids),
        context.supabase.from("access_requests").select("project_id").in("project_id", ids).eq("status", "pending"),
      ]);

      const memberCount: Record<string, number> = {};
      const myRole: Record<string, ProjectRole> = {};
      (membersRes.data ?? []).forEach((m: any) => {
        if (m.status === "accepted") memberCount[m.project_id] = (memberCount[m.project_id] ?? 0) + 1;
        if (m.user_id === context.userId && m.status === "accepted") myRole[m.project_id] = m.role;
      });
      const pending: Record<string, number> = {};
      (requestsRes.data ?? []).forEach((r: any) => {
        pending[r.project_id] = (pending[r.project_id] ?? 0) + 1;
      });

      const ownerIds = Array.from(new Set(list.map((p) => p.owner_id))).filter(Boolean);
      const ownerMap: Record<string, string> = {};
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await Promise.all(
          ownerIds.map(async (uid) => {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (u?.user) {
              ownerMap[uid] =
                (u.user.user_metadata?.full_name as string | undefined) ??
                (u.user.user_metadata?.name as string | undefined) ??
                u.user.email ??
                "";
            }
          }),
        );
      } catch { /* ignore */ }

      const owned: MyProjectSummary[] = [];
      const collaborating: MyProjectSummary[] = [];
      for (const p of list) {
        const role = myRole[p.id];
        if (!role) continue;
        const summary: MyProjectSummary = {
          id: p.id,
          projeto: p.projeto ?? "",
          objetivo: p.objetivo ?? null,
          updated_at: p.updated_at,
          codigo_acesso: p.codigo_acesso ?? null,
          owner_id: p.owner_id,
          owner_name: ownerMap[p.owner_id] ?? "",
          my_role: role,
          member_count: memberCount[p.id] ?? 0,
          pending_requests: pending[p.id] ?? 0,
        };
        if (role === "owner") owned.push(summary);
        else collaborating.push(summary);
      }
      return { owned, collaborating };
    },
  );
