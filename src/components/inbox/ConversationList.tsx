"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { es } from "date-fns/locale";

function extractPhone(session_id: any): string {
  if (!session_id) return "";
  if (typeof session_id === "string" && session_id.includes("|")) {
    return session_id.split("|").pop() || "";
  }
  if (typeof session_id === "string") {
    return session_id;
  }
  if (typeof session_id === "object" && session_id !== null) {
    // Si es un objeto, intenta extraer el valor primitivo
    return Object.values(session_id).join("");
  }
  return String(session_id);
}

function extractName(row: any): string {
  if (row.name_id && typeof row.name_id === "string" && row.name_id.trim() !== "") {
    return row.name_id;
  }
  return extractPhone(row.session_id);
}

function extractLastMessage(row: any): string {
  if (!row.message) return "";
  if (typeof row.message === "string") {
    return row.message;
  }
  if (typeof row.message === "object") {
    if (row.message.content) return row.message.content;
    if (row.message.text) return row.message.text;
    if (row.message.type === "image") return "📷 Imagen";
    if (row.message.type === "document") return "📄 Documento";
    return JSON.stringify(row.message);
  }
  return "";
}

function extractLastTimestamp(row: any): Date | null {
  // Preferir message.timestamp si existe
  const ts = typeof row.message === "object" ? row.message?.timestamp : undefined;
  if (typeof ts === "string" && ts.length) {
    // Intentar parsear como ISO; si falla, usar Date(ts) como fallback
    try {
      return parseISO(ts);
    } catch {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  // Fallback: sin timestamp conocido
  return null;
}

function formatListTimeLabel(date: Date | null): string {
  if (!date) return "";
  if (isToday(date)) return format(date, "HH:mm", { locale: es });
  if (isYesterday(date)) return "Ayer";
  return format(date, "d MMM", { locale: es }); // ej: 7 abr
}

interface ConversationListProps {
  onSelectConversation: (sessionId: string) => void;
  selectedSessionId: string | null;
}

const ConversationList = ({ onSelectConversation, selectedSessionId }: ConversationListProps) => {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["rawChatHistories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("n8n_chat_histories_productos")
        .select("*")
        .order("id", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Suscripción en tiempo real: ante cada INSERT, revalidar la lista
  useEffect(() => {
    const channel = supabase
      .channel("conversation_list_updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "n8n_chat_histories_productos",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rawChatHistories"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Agrupar por session_id (número de teléfono)
  const contactMap = new Map<string, any>();
  if (data && data.length > 0) {
    data.forEach((row) => {
      const phone = extractPhone(row.session_id);
      if (!phone) return;
      // Mantener el más reciente por id
      if (!contactMap.has(phone)) {
        contactMap.set(phone, row);
      } else {
        const existing = contactMap.get(phone);
        if (row.id > existing.id) {
          contactMap.set(phone, row);
        }
      }
    });
  }

  // Ordenar por id descendente (último mensaje arriba)
  const contacts = Array.from(contactMap.values()).sort((a, b) => b.id - a.id);

  // Filtrar por búsqueda (nombre o número)
  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const lower = search.trim().toLowerCase();
    return contacts.filter((row) => {
      const name = extractName(row).toLowerCase();
      const phone = extractPhone(row.session_id).toLowerCase();
      return name.includes(lower) || phone.includes(lower);
    });
  }, [contacts, search]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full border-r bg-card text-card-foreground items-center justify-center">
        <p>Cargando contactos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full border-r bg-card text-card-foreground items-center justify-center text-red-500">
        <p>Error al cargar datos: {error.message}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col h-full border-r bg-card text-card-foreground items-center justify-center">
        <p>No hay contactos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r bg-card text-card-foreground overflow-y-auto">
      <div className="p-4 border-b sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <h2 className="text-xl font-semibold mb-2">Contactos</h2>
        <Input
          type="text"
          placeholder="Buscar por nombre o número..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full"
        />
      </div>
      <ul className="flex-1 divide-y">
        {filteredContacts.length === 0 ? (
          <li className="p-4 text-muted-foreground">No se encontraron contactos.</li>
        ) : (
          filteredContacts.map((row) => {
            const phone = extractPhone(row.session_id);
            const isActive = selectedSessionId === phone;
            const name = extractName(row);
            const lastText = extractLastMessage(row);
            const lastDate = extractLastTimestamp(row);
            const timeLabel = formatListTimeLabel(lastDate);

            return (
              <li
                key={phone}
                className={`p-4 cursor-pointer hover:bg-muted transition-colors ${isActive ? "bg-accent" : ""}`}
                onClick={() => onSelectConversation(phone)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">{timeLabel}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate">{lastText}</div>
                <div className="text-xs text-muted-foreground">{phone}</div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

export default ConversationList;