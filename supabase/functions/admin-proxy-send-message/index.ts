import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

    // Obtener usuario desde el token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Body del cliente
    const body = await req.json().catch(() => ({}));
    const {
      sessionId,
      numberId,
      nameId,
      text,
      adminId,
      webhookUrl, // opcional, si no viene se toma de settings
    } = body ?? {};

    if (!sessionId || !text) {
      return new Response(JSON.stringify({ error: "Missing required fields: sessionId, text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtener URL desde settings si no se envía explícita
    let targetUrl = webhookUrl;
    if (!targetUrl) {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from("settings")
        .select("n8n_send_message_webhook_url")
        .eq("id", user.id)
        .single();
      if (settingsError || !settings?.n8n_send_message_webhook_url) {
        return new Response(JSON.stringify({ error: "n8n_send_message_webhook_url not configured in settings." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUrl = settings.n8n_send_message_webhook_url;
    }

    // Reenviar al webhook de n8n con el mismo payload esperado
    const forwardPayload = {
      session_id: sessionId,
      number_id: numberId ?? sessionId,
      name_id: nameId ?? sessionId,
      text,
      admin_id: adminId ?? user.id,
    };

    const n8nRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardPayload),
    });

    const n8nData = await n8nRes.json().catch(() => ({}));
    if (!n8nRes.ok || n8nData?.ok === false) {
      return new Response(JSON.stringify({ error: n8nData?.error || `Webhook error (HTTP ${n8nRes.status})`, details: n8nData }), {
        status: n8nRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, forwarded: true, result: n8nData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-proxy-send-message error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});