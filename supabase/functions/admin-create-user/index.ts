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
    // 1. Autenticación: obtener el usuario que hace la petición
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    // 2. Crear cliente admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    // 3. Obtener el usuario que hace la petición
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token); // Usar supabaseAdmin aquí también
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Verificar que el usuario sea admin en la tabla profiles
    const { data: profile, error: profileError } = await supabaseAdmin 
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile || profile.role !== "admin") {
      console.error("Error al verificar rol del usuario:", profileError?.message || "Rol no es admin o perfil no encontrado", { userId: user.id, profileData: profile });
      return new Response(JSON.stringify({ error: "Solo los administradores pueden crear usuarios." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Leer datos del body
    const body = await req.json();
    const { email, password, name, role, passwordType } = body;
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: "Faltan datos obligatorios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Crear usuario en Auth
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        first_name: name,
        role, // Asegurarse de que el rol se pase al user_metadata
      },
      email_confirm: passwordType === "permanente",
    });
    if (createError || !created?.user?.id) {
      return new Response(JSON.stringify({ error: createError?.message || "No se pudo crear el usuario." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Insertar en profiles usando supabaseAdmin para bypassar RLS
    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      email,
      first_name: name,
      role, // Asegurarse de que el rol se inserte en profiles
    });

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error en la función admin-create-user:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});