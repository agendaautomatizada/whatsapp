import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "lock" | "unlock" | "extend";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Validar usuario
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId: string = body.sessionId;
    const action: Action = body.action;
    let ttlHours: number | undefined = body.ttlHours;

    if (!sessionId || typeof sessionId !== "string" || !/^\+?\d+$/.test(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid sessionId. Use E.164 digits (may start with +)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["lock", "unlock", "extend"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action. Must be lock | unlock | extend" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Leer app_settings del usuario (cada usuario tiene su propia fila)
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("app_settings")
      .select("webhook_base_url, webhook_auth_token, live_chat_ttl")
      .eq("id", user.id)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching app_settings:", settingsError.message);
    }

    const defaultUrl = "https://moglich.app.n8n.cloud/webhook-test/116e7647-b699-4da8-9e4b-37b91c4ac8b9";
    const targetUrl: string = settings?.webhook_base_url || defaultUrl;
    const authToken: string | null = settings?.webhook_auth_token || null;
    const defaultTTL = Number(settings?.live_chat_ttl) || 24;

    if ((action === "lock" || action === "extend")) {
      ttlHours = typeof ttlHours === "number" ? ttlHours : defaultTTL;
      if (isNaN(ttlHours) || ttlHours < 1 || ttlHours > 48) {
        return new Response(JSON.stringify({ error: "ttlHours must be between 1 and 48" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const forwardBody: Record<string, unknown> = {
      session_id: sessionId,
      action,
    };
    if (action === "lock" || action === "extend") {
      forwardBody.ttl_hours = ttlHours;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) {
      const hasScheme = /^(Bearer|Basic|Token)\s/i.test(authToken);
      headers["Authorization"] = hasScheme ? authToken : `Bearer ${authToken}`;
    }

    const n8nRes = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(forwardBody),
    });

    const n8nData = await n8nRes.json().catch(() => ({} as any));

    if (!n8nRes.ok || (n8nData && n8nData.ok === false)) {
      const errMsg = n8nData?.error || `Webhook error (HTTP ${n8nRes.status})`;
      return new Response(JSON.stringify({ ok: false, error: errMsg, details: n8nData }), {
        status: n8nRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(n8nData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("live-chat-toggle error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});