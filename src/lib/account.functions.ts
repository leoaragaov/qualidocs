import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclui a conta do usuário autenticado.
 * Passos: (1) apaga todos os projetos onde ele é owner (cascata em US/CT/Bugs/etc via FK),
 * (2) remove memberships restantes, (3) apaga o usuário do auth (Admin API).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;

    // 1) Apagar projetos onde o usuário é dono (dispara cascata nas tabelas filhas)
    const { error: projErr } = await context.supabase
      .from("projects")
      .delete()
      .eq("owner_id", uid);
    if (projErr) throw new Error(`Falha ao remover projetos: ${projErr.message}`);

    // 2) Remover memberships em projetos de terceiros
    const { error: memErr } = await context.supabase
      .from("project_members")
      .delete()
      .eq("user_id", uid);
    if (memErr) throw new Error(`Falha ao remover memberships: ${memErr.message}`);

    // 3) Excluir o usuário no auth via Admin API (service role)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authErr) throw new Error(`Falha ao remover conta: ${authErr.message}`);

    return { ok: true };
  });
