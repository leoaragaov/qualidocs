import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessHistoryRow = {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  event_type: string;
  created_at: string;
};

function extractIp(req: Request | undefined): string | null {
  if (!req?.headers) return null;
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("true-client-ip") ??
    null
  );
}

async function geolocate(ip: string | null) {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { "User-Agent": "QualiDocs/1.0" },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j.error) return null;
    return {
      country: j.country_name ?? null,
      region: j.region ?? null,
      city: j.city ?? null,
      latitude: typeof j.latitude === "number" ? j.latitude : null,
      longitude: typeof j.longitude === "number" ? j.longitude : null,
      timezone: j.timezone ?? null,
    };
  } catch {
    return null;
  }
}

export const recordAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ event_type: z.enum(["login", "logout", "signup"]).default("login") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const req = getRequest();
    const ip = extractIp(req);
    const userAgent = req?.headers.get("user-agent") ?? null;
    const geo = await geolocate(ip);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("access_history").insert({
      user_id: context.userId,
      ip_address: ip,
      user_agent: userAgent,
      country: geo?.country ?? null,
      region: geo?.region ?? null,
      city: geo?.city ?? null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      timezone: geo?.timezone ?? null,
      event_type: data.event_type,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAccessHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessHistoryRow[]> => {
    const { data, error } = await context.supabase
      .from("access_history" as any)
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as AccessHistoryRow[];
  });
