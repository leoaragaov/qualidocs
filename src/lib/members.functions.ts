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
    const { data: mgr } = await context.supabase.rpc("tms_can_manage", { _pid: data.project_id });
    if (!mgr) throw new Error("Sem permissão para convidar membros.");

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

// ---------- join by access code ----------
export const joinProjectByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(3).max(20) }).parse(d))
  .handler(async ({ data, context }): Promise<{ project_id: string }> => {
    const { data: pid, error } = await context.supabase.rpc("tms_join_by_code", { _code: data.code });
    if (error) throw new Error(error.message);
    if (!pid) throw new Error("Código inválido");
    return { project_id: pid as string };
  });
