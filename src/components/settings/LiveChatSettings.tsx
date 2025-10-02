"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { toggleLiveChat, getAppSettings, setAppSettings } from "@/utils/toggleLiveChat";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_WEBHOOK_URL = "https://moglich.app.n8n.cloud/webhook/116e7647-b699-4da8-9e4b-37b91c4ac8b9";

const LiveChatSettings = () => {
  // Settings state
  const [liveChatTTL, setLiveChatTTL] = useState<number>(24);
  const [webhookAuthToken, setWebhookAuthToken] = useState<string>("");
  const [liveChatWebhookUrl, setLiveChatWebhookUrl] = useState<string>(DEFAULT_WEBHOOK_URL);
  const [ttlError, setTtlError] = useState<string>("");

  // Tester state
  const [testSessionId, setTestSessionId] = useState<string>("");
  const [testerResult, setTesterResult] = useState<any>(null);
  const [testerLoading, setTesterLoading] = useState<boolean>(false);

  // Cargar primero desde app_settings (servidor). Si no hay fila, caer a localStorage -> DEFAULT.
  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (userId) {
        const { data, error } = await supabase
          .from("app_settings")
          .select("webhook_base_url, webhook_auth_token, live_chat_ttl")
          .eq("id", userId)
          .maybeSingle();

        if (!cancelled && !error && data) {
          if (typeof data.live_chat_ttl === "number") setLiveChatTTL(data.live_chat_ttl);
          setWebhookAuthToken(data.webhook_auth_token || "");
          setLiveChatWebhookUrl(data.webhook_base_url || DEFAULT_WEBHOOK_URL);
          return; // ya cargamos del servidor
        }
      }

      // Fallback a localStorage si no hay fila o hubo error
      const local = getAppSettings();
      if (!cancelled) {
        setLiveChatTTL(local.liveChatTTL ?? 24);
        setWebhookAuthToken(local.webhookAuthToken ?? "");
        setLiveChatWebhookUrl(local.liveChatWebhookUrl || DEFAULT_WEBHOOK_URL);
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guardar localmente y en app_settings
  const handleSave = async () => {
    if (liveChatTTL < 1 || liveChatTTL > 48) {
      setTtlError("El TTL debe estar entre 1 y 48 horas.");
      return;
    }
    setTtlError("");

    // Guardar en localStorage (para la UI/fallback)
    setAppSettings({ liveChatTTL, webhookAuthToken, liveChatWebhookUrl });

    // Guardar en app_settings (usado por la Edge Function)
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      showError("No hay usuario autenticado.");
      return;
    }

    const toastId = showLoading("Guardando configuración...");
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: userId,
          live_chat_ttl: liveChatTTL,
          webhook_auth_token: webhookAuthToken || null,
          webhook_base_url: liveChatWebhookUrl || DEFAULT_WEBHOOK_URL,
        },
        { onConflict: "id" }
      );

    dismissToast(toastId);
    if (error) {
      showError(`Error al guardar: ${error.message}`);
    } else {
      showSuccess("Configuración de Chat en vivo guardada.");
    }
  };

  // Tester actions
  const handleTester = async (action: "lock" | "unlock" | "extend") => {
    setTesterResult(null);
    if (!testSessionId.match(/^\+?\d+$/)) {
      showError("Debes ingresar un sessionId válido (E.164, solo dígitos, puede iniciar con +).");
      return;
    }
    let ttl = liveChatTTL;
    if (action === "extend") ttl = Math.min(liveChatTTL + 4, 48);
    setTesterLoading(true);
    const toastId = showLoading("Llamando al webhook...");
    try {
      const res = await toggleLiveChat({
        sessionId: testSessionId,
        action,
        ttlHours: action === "extend" ? ttl : undefined,
      });
      setTesterResult(res);
      dismissToast(toastId);
      showSuccess("Webhook ejecutado correctamente.");
    } catch (err: any) {
      setTesterResult({ error: err.message });
      dismissToast(toastId);
      showError(err.message);
    } finally {
      setTesterLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat en vivo</CardTitle>
        <CardDescription>
          Configura el tiempo de vida por defecto y el token/URL del webhook para el chat en vivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="livechat-ttl">Default Live-Chat TTL (horas)</Label>
          <Input
            id="livechat-ttl"
            type="number"
            min={1}
            max={48}
            value={liveChatTTL}
            onChange={e => setLiveChatTTL(Number(e.target.value))}
            className="w-32"
          />
          {ttlError && <p className="text-xs text-red-500">{ttlError}</p>}
          <p className="text-xs text-muted-foreground">Rango permitido: 1–48 horas. Valor por defecto: 24.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhook-auth-token">Webhook Auth Token (opcional)</Label>
          <Input
            id="webhook-auth-token"
            type="text"
            value={webhookAuthToken}
            onChange={e => setWebhookAuthToken(e.target.value)}
            placeholder="Token de autenticación para el webhook"
          />
          <p className="text-xs text-muted-foreground">Si se define, se enviará en el header Authorization.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="livechat-webhook-url">Webhook URL</Label>
          <Input
            id="livechat-webhook-url"
            type="text"
            value={liveChatWebhookUrl}
            onChange={e => setLiveChatWebhookUrl(e.target.value)}
            className="bg-muted"
            placeholder={DEFAULT_WEBHOOK_URL}
          />
          <p className="text-xs text-muted-foreground">
            Esta URL será usada por el servidor (Edge Function) o por el fallback del cliente para activar/desactivar/extender el chat en vivo.
          </p>
        </div>
        <Button onClick={handleSave} className="w-full">Guardar configuración</Button>

        {/* Tester embebido */}
        <div className="mt-8 border-t pt-6">
          <h3 className="font-semibold mb-2">Tester de Chat en vivo (QA)</h3>
          <div className="flex flex-col sm:flex-row gap-2 items-center mb-2">
            <Input
              type="text"
              placeholder="sessionId (E.164, puede iniciar con +)"
              value={testSessionId}
              onChange={e => setTestSessionId(e.target.value)}
              className="w-64"
              disabled={testerLoading}
            />
            <Button onClick={() => handleTester("lock")} disabled={testerLoading}>Lock</Button>
            <Button onClick={() => handleTester("unlock")} disabled={testerLoading}>Unlock</Button>
            <Button onClick={() => handleTester("extend")} disabled={testerLoading}>Extend +4h</Button>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            Prueba el webhook con el sessionId indicado. Lock usa el TTL actual, Extend suma 4h (máx. 48).
          </div>
          {testerResult && (
            <pre className={`text-xs rounded p-2 ${testerResult.error ? "bg-red-100 text-red-700" : "bg-muted"}`}>
              {JSON.stringify(testerResult, null, 2)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveChatSettings;