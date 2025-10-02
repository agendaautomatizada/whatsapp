"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { extractPhone } from "@/utils/extractPhone";

interface ContactSidebarProps {
  sessionId: string | null;
  contactName: string | null;
}

const ContactSidebar = ({ sessionId, contactName }: ContactSidebarProps) => {
  const [resolvedName, setResolvedName] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function resolveName() {
      if (!sessionId) {
        setResolvedName("");
        return;
      }

      const phoneFromSession = extractPhone(sessionId);
      if (contactName && contactName !== phoneFromSession) {
        setResolvedName(contactName);
        return;
      }

      const { data } = await supabase
        .from("n8n_chat_histories_productos")
        .select("name_id")
        .eq("session_id", sessionId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (data?.name_id && data.name_id !== phoneFromSession) {
        setResolvedName(data.name_id);
      } else {
        setResolvedName("");
      }
    }

    resolveName();
    return () => {
      cancelled = true;
    };
  }, [sessionId, contactName]);

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Selecciona un chat para ver los detalles del contacto.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground border-l">
      <CardHeader className="border-b flex flex-col items-center p-4">
        <Avatar className="h-20 w-20 mb-3">
          <AvatarImage src="/user-placeholder.svg" alt={resolvedName || sessionId} />
          <AvatarFallback>{(resolvedName || sessionId || "?").charAt(0)}</AvatarFallback>
        </Avatar>
        <CardTitle className="text-xl font-semibold">{resolvedName || "Sin nombre"}</CardTitle>
        <p className="text-sm text-muted-foreground">En línea</p>
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Nombre</Label>
          <Input id="contact-name" value={resolvedName} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Teléfono</Label>
          <Input id="contact-phone" value={sessionId || ""} readOnly />
        </div>
        {/* Se han eliminado 'Notas', 'Status' y el separador */}
      </CardContent>
    </div>
  );
};

export default ContactSidebar;