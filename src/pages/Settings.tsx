"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/components/auth/SessionContextProvider";
import LiveChatSettings from "@/components/settings/LiveChatSettings";
import { useUserRole } from "@/hooks/use-user-role";
import { useFeatureFlag } from "@/hooks/use-feature-flag";

const queryClient = new QueryClient();

// Defaults de último recurso
const DEFAULT_LIVE_CHAT_STATUS_WEBHOOK =
  "https://moglich.app.n8n.cloud/webhook/6c787716-1656-49be-b197-31a579d65b21";
const DEFAULT_SEND_MESSAGE_WEBHOOK =
  "https://moglich.app.n8n.cloud/webhook/18fb58c9-139a-43e0-9fea-dc596e89544f";

const SettingsContent = () => {
  const { session } = useSupabase();
  const qClient = useQueryClient();
  const { role } = useUserRole();
  const { enabled: assistantsSeeSettings, isLoading: loadingFlag } = useFeatureFlag("assistants_can_see_settings");

  // Iniciar con defaults de último recurso
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = React.useState("");
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [accessToken, setAccessToken] = React.useState("");
  const [n8nWebhookUrl, setN8nWebhookUrl] = React.useState("");
  const [whatsappVerifyToken, setWhatsappVerifyToken] = React.useState("");
  const [n8nSendMessageWebhookUrl, setN8nSendMessageWebhookUrl] = React.useState(DEFAULT_SEND_MESSAGE_WEBHOOK);
  const [testRecipientPhoneNumber, setTestRecipientPhoneNumber] = React.useState("");
  const [testMessageContent, setTestMessageContent] = React.useState("¡Hola! Este es un mensaje de prueba desde tu aplicación Dyad.");

  // Status URL: usar default como último recurso
  const [liveChatStatusWebhookUrl, setLiveChatStatusWebhookUrl] = React.useState(
    DEFAULT_LIVE_CHAT_STATUS_WEBHOOK
  );

  // Hidratar desde localStorage para status si existe
  React.useEffect(() => {
    const local = localStorage.getItem("appSettings");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.liveChatStatusWebhookUrl) {
          setLiveChatStatusWebhookUrl(parsed.liveChatStatusWebhookUrl);
        }
      } catch {}
    }
  }, []);

  const fetchSettings = async () => {
    if (!session?.user) {
      throw new Error("Usuario no autenticado.");
    }
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const { isLoading, error } = useQuery({
    queryKey: ["userSettings"],
    queryFn: fetchSettings,
    enabled: !!session?.user,
    onSuccess: (data) => {
      if (data) {
        setWhatsappBusinessAccountId(data.whatsapp_business_account_id ?? "");
        setPhoneNumberId(data.phone_number_id ?? "");
        setAccessToken(data.access_token ?? "");
        setN8nWebhookUrl(data.n8n_webhook_url ?? "");
        setWhatsappVerifyToken(data.whatsapp_verify_token ?? "");
        // Si no hay URL configurada para enviar mensajes, usar default de último recurso (visible en la UI)
        setN8nSendMessageWebhookUrl(
          data.n8n_send_message_webhook_url && data.n8n_send_message_webhook_url.trim() !== ""
            ? data.n8n_send_message_webhook_url
            : DEFAULT_SEND_MESSAGE_WEBHOOK
        );
      }
    },
    onError: (err: any) => {
      showError(`Error al cargar la configuración: ${err.message}`);
    },
  });

  const saveSettings = async () => {
    if (!session?.user) {
      throw new Error("Usuario no autenticado.");
    }

    const settingsData = {
      id: session.user.id,
      whatsapp_business_account_id: whatsappBusinessAccountId || null,
      phone_number_id: phoneNumberId || null,
      access_token: accessToken || null,
      n8n_webhook_url: n8nWebhookUrl || null,
      whatsapp_verify_token: whatsappVerifyToken || null,
      n8n_send_message_webhook_url: n8nSendMessageWebhookUrl || null,
    };

    const { error } = await supabase.from("settings").upsert(settingsData, { onConflict: "id" });

    if (error) {
      throw error;
    }

    // Guardar también en localStorage el status webhook (para fallback del cliente)
    const local = localStorage.getItem("appSettings");
    let parsed = {};
    try {
      parsed = local ? JSON.parse(local) : {};
    } catch {}
    localStorage.setItem(
      "appSettings",
      JSON.stringify({
        ...parsed,
        liveChatStatusWebhookUrl,
        // Guardar opcionalmente el webhook de envío para posibles fallbacks de cliente
        n8nSendMessageWebhookUrl: n8nSendMessageWebhookUrl || DEFAULT_SEND_MESSAGE_WEBHOOK,
      })
    );
  };

  const saveSettingsMutation = useMutation({
    mutationFn: saveSettings,
    onMutate: () => {
      return showLoading("Guardando configuración...");
    },
    onSuccess: (data, variables, toastId) => {
      dismissToast(toastId);
      showSuccess("Configuración guardada exitosamente.");
      qClient.invalidateQueries({ queryKey: ["userSettings"] });
    },
    onError: (err: any, variables, toastId) => {
      dismissToast(toastId);
      showError(`Error al guardar la configuración: ${err.message}`);
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate();
  };

  const sendTestMessage = async () => {
    if (!session?.user) {
      throw new Error("Usuario no autenticado.");
    }
    if (!testRecipientPhoneNumber || !testMessageContent) {
      throw new Error("Por favor, ingresa el número de teléfono del destinatario y el contenido del mensaje.");
    }
    const urlToUse = n8nSendMessageWebhookUrl || DEFAULT_SEND_MESSAGE_WEBHOOK;

    const toastId = showLoading("Enviando mensaje de prueba...");
    try {
      const response = await fetch(urlToUse, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testRecipientPhoneNumber,
          message: testMessageContent,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Error al enviar mensaje de prueba");
      }

      dismissToast(toastId);
      showSuccess("Mensaje de prueba enviado exitosamente. Revisa tu WhatsApp.");
    } catch (err: any) {
      dismissToast(toastId);
      showError(`Error al enviar mensaje de prueba: ${err.message || "Error desconocido"}`);
      console.error("Error sending test message:", err);
    }
  };

  const sendTestMessageMutation = useMutation({
    mutationFn: sendTestMessage,
    onMutate: () => {
      return showLoading("Enviando mensaje de prueba...");
    },
    onSuccess: (data, variables, toastId) => {
      dismissToast(toastId);
      showSuccess("Mensaje de prueba enviado exitosamente. Revisa tu WhatsApp.");
    },
    onError: (err: any, variables, toastId) => {
      dismissToast(toastId);
      showError(`Error al enviar mensaje de prueba: ${err.message || "Error desconocido"}`);
    },
  });

  const toggleAssistantsSettings = async (enable: boolean) => {
    const toastId = showLoading(enable ? "Habilitando para asistentes..." : "Ocultando para asistentes...");
    try {
      const { data, error } = await supabase.functions.invoke("admin-set-feature", {
        body: {
          key: "assistants_can_see_settings",
          value: { enabled: enable },
        },
      });
      dismissToast(toastId);
      if (error) throw error;
      showSuccess(enable ? "Ahora los asistentes ven Configuración." : "Los asistentes ya no ven Configuración.");
      qClient.invalidateQueries({ queryKey: ["featureFlag", "assistants_can_see_settings"] });
    } catch (e: any) {
      dismissToast(toastId);
      showError(e.message || "No se pudo actualizar el flag.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <p>Cargando configuración...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <p className="text-red-500">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-background text-foreground p-2 sm:p-4 lg:p-8">
      <div className="w-full max-w-3xl mx-auto space-y-6 pb-32">
        {role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle>Visibilidad de Configuración para asistentes</CardTitle>
              <CardDescription>
                Control global para mostrar u ocultar la pestaña de Configuración a usuarios con rol “asistente”.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm">
                Estado actual:{" "}
                <span className={`font-semibold ${assistantsSeeSettings ? "text-green-600" : "text-red-600"}`}>
                  {loadingFlag ? "Cargando..." : assistantsSeeSettings ? "Visible" : "Oculta"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toggleAssistantsSettings(false)} disabled={loadingFlag || !assistantsSeeSettings}>
                  Ocultar para asistentes
                </Button>
                <Button onClick={() => toggleAssistantsSettings(true)} disabled={loadingFlag || assistantsSeeSettings}>
                  Mostrar a asistentes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Meta WhatsApp API</CardTitle>
            <CardDescription>
              Ingresa tus credenciales de la API de WhatsApp Business para enviar y recibir mensajes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-business-account-id">ID de Cuenta de WhatsApp Business</Label>
              <Input
                id="whatsapp-business-account-id"
                placeholder="Ej. 1234567890"
                value={whatsappBusinessAccountId}
                onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                disabled={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number-id">ID de Número de Teléfono</Label>
              <Input
                id="phone-number-id"
                placeholder="Ej. 9876543210"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                disabled={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-token">Token de Acceso Permanente</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="Ingresa tu token de acceso permanente"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                disabled={false}
              />
              <p className="text-sm text-muted-foreground">
                Asegúrate de usar un token de acceso permanente para evitar interrupciones.
              </p>
            </div>
            <Button onClick={handleSaveSettings} className="w-full">
              Guardar Configuración
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Integración con n8n</CardTitle>
            <CardDescription>
              Configura la URL de tu webhook de n8n y el token de verificación para WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n8n-webhook-url">URL del Webhook de n8n (entrante)</Label>
              <Input
                id="n8n-webhook-url"
                placeholder="Ej. https://your-n8n-instance.com/webhook/whatsapp"
                value={n8nWebhookUrl}
                onChange={(e) => setN8nWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-verify-token">Token de Verificación de WhatsApp</Label>
              <Input
                id="whatsapp-verify-token"
                type="password"
                placeholder="Ingresa tu token de verificación"
                value={whatsappVerifyToken}
                onChange={(e) => setWhatsappVerifyToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n8n-send-message-webhook-url">URL del Webhook de n8n para enviar mensajes</Label>
              <Input
                id="n8n-send-message-webhook-url"
                placeholder={DEFAULT_SEND_MESSAGE_WEBHOOK}
                value={n8nSendMessageWebhookUrl}
                onChange={(e) => setN8nSendMessageWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="livechat-status-webhook-url">URL del Webhook para checar status de chat en vivo</Label>
              <Input
                id="livechat-status-webhook-url"
                placeholder={DEFAULT_LIVE_CHAT_STATUS_WEBHOOK}
                value={liveChatStatusWebhookUrl}
                onChange={(e) => setLiveChatStatusWebhookUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Este endpoint solo debe usarse para consultar el estado del chat en vivo (NO para activar/desactivar).
              </p>
            </div>
            <Button onClick={handleSaveSettings} className="w-full">
              Guardar Configuración de n8n
            </Button>
          </CardContent>
        </Card>

        <LiveChatSettings />

        <Card>
          <CardHeader>
            <CardTitle>Probar Envío de Mensaje de WhatsApp</CardTitle>
            <CardDescription>
              Envía un mensaje de prueba a un número de WhatsApp para verificar tu configuración.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-recipient-phone-number">Número de Teléfono del Destinatario</Label>
              <Input
                id="test-recipient-phone-number"
                placeholder="Ej. 5215512345678 (con código de país, sin +)"
                value={testRecipientPhoneNumber}
                onChange={(e) => setTestRecipientPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-message-content">Contenido del Mensaje</Label>
              <Textarea
                id="test-message-content"
                placeholder="Escribe tu mensaje de prueba aquí..."
                value={testMessageContent}
                onChange={(e) => setTestMessageContent(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={() => sendTestMessageMutation.mutate()}
              className="w-full"
              disabled={!testRecipientPhoneNumber || !testMessageContent}
            >
              Enviar Mensaje de Prueba
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Settings = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsContent />
  </QueryClientProvider>
);

export default Settings;