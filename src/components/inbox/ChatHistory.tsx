"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDown, User, Bot, Send, Image as ImageIcon, Paperclip } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import LiveChatStatusBar from "./LiveChatStatusBar";
import { sendAdminMessage } from "@/utils/sendAdminMessage";
import { extractPhone } from "@/utils/extractPhone";

function extractMessageText(msg: any): string {
  if (!msg) return "";
  if (typeof msg === "string") return msg;
  if (typeof msg === "object") {
    if (msg.content) return msg.content;
    if (msg.text) return msg.text;
    if (msg.type === "image") return "📷 Imagen";
    if (msg.type === "document") return "📄 Documento";
    return JSON.stringify(msg);
  }
  return "";
}

function extractType(msg: any): string {
  if (!msg) return "";
  if (typeof msg === "object" && msg.type) return msg.type;
  return "texto";
}

function formatChatDateLabel(d: Date): string {
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "EEE d 'de' MMM", { locale: es });
}

interface ChatBubble {
  id: string;
  direction: "inbound" | "outbound";
  origin?: "user" | "bot" | "inbox_admin";
  author?: { type: string };
  text: string;
  timestamp: string;
  type?: string;
  media_url?: string;
}

interface ChatHistoryProps {
  sessionId: string;
}

const BUCKET = "user-uploads";

const ChatHistory = ({ sessionId }: ChatHistoryProps) => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["chatHistory", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("n8n_chat_histories_productos")
        .select("*")
        .eq("session_id", sessionId)
        .order("id", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  const contactName =
    data && data.length > 0
      ? (data[0].name_id || extractPhone(data[0].session_id))
      : extractPhone(sessionId);

  // Habilitar escritura únicamente si NO existe el botón "Pasar a Chat en vivo"
  const [lockButtonPresent, setLockButtonPresent] = useState<boolean>(false);
  const statusBarContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = statusBarContainerRef.current;
    if (!container) return;

    const check = () => {
      const exists = !!container.querySelector('[data-live-action="lock"]');
      setLockButtonPresent(exists);
    };

    const observer = new MutationObserver(() => check());
    observer.observe(container, { childList: true, subtree: true, attributes: true });
    // Primera evaluación
    check();

    return () => observer.disconnect();
  }, [sessionId]);

  const canType = !lockButtonPresent;

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [data]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
      setShowScrollDown(!atBottom);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [data]);

  const handleScrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!sessionId || !text) return;
    if (!canType) {
      showError("Activa Chat en vivo para poder escribir al cliente.");
      return;
    }

    setSending(true);
    try {
      await sendAdminMessage({
        sessionId: extractPhone(sessionId),
        numberId: extractPhone(sessionId),
        nameId: contactName,
        text,
      });
      showSuccess("Mensaje enviado correctamente.");
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["chatHistory", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["rawChatHistories"] });
      handleScrollToBottom();
    } catch (err: any) {
      showError(`Error al enviar mensaje: ${err.message || "Error desconocido"}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (file: File) => {
    if (!sessionId || !file) return;
    if (!canType) {
      showError("Activa Chat en vivo para poder enviar adjuntos.");
      return;
    }
    const toastId = showLoading("Subiendo imagen...");
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${extractPhone(sessionId)}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
      if (!urlData?.publicUrl) throw new Error("No se pudo obtener la URL pública de la imagen.");

      await sendAdminMessage({
        sessionId: extractPhone(sessionId),
        numberId: extractPhone(sessionId),
        nameId: contactName,
        text: "",
      });

      showSuccess("Imagen enviada correctamente.");
      queryClient.invalidateQueries({ queryKey: ["chatHistory", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["rawChatHistories"] });
      handleScrollToBottom();
    } catch (err: any) {
      showError(`Error al enviar imagen: ${err.message || "Error desconocido"}`);
    } finally {
      dismissToast(toastId);
    }
  };

  const bubbles = (data || []).map((row: any) => {
    if (
      row.message &&
      typeof row.message === "object" &&
      row.message.origin === "inbox_admin"
    ) {
      return {
        id: row.message.id || row.id?.toString() || crypto.randomUUID(),
        direction: row.message.direction || "outbound",
        origin: row.message.origin,
        author: row.message.author,
        text: row.message.text || row.message.content || "",
        timestamp: row.message.timestamp || row.created_at,
        type: row.message.type,
        media_url: row.message.media_url,
      };
    }
    return {
      id: row.id?.toString() || crypto.randomUUID(),
      direction:
        typeof row.message === "object"
          ? row.message.direction || "inbound"
          : "inbound",
      origin:
        typeof row.message === "object"
          ? row.message.origin || "user"
          : "user",
      author: undefined,
      text: extractMessageText(row.message),
      timestamp:
        typeof row.message === "object"
          ? row.message.timestamp || row.created_at
          : row.created_at,
      type: typeof row.message === "object" ? row.message.type : undefined,
      media_url:
        typeof row.message === "object" ? row.message.media_url : undefined,
    };
  });

  const groupedByDay: Record<string, typeof bubbles> = {};
  for (const b of bubbles) {
    const d = new Date(b.timestamp);
    const key = format(d, "yyyy-MM-dd");
    if (!groupedByDay[key]) groupedByDay[key] = [];
    groupedByDay[key].push(b);
  }
  const sortedDayKeys = Object.keys(groupedByDay).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat_history_updates:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "n8n_chat_histories_productos",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chatHistory", sessionId] });
          queryClient.invalidateQueries({ queryKey: ["rawChatHistories"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, sessionId]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p>Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-red-500">
        <p>Error al cargar historial: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full" style={{ background: "hsl(210, 40%, 98%)" }}>
      <div ref={statusBarContainerRef}>
        <LiveChatStatusBar sessionId={sessionId} />
      </div>
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-8 space-y-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {sortedDayKeys.map((dayKey) => {
          const firstOfDay = groupedByDay[dayKey][0] as any;
          const labelDate = new Date(firstOfDay.timestamp);
          const label = formatChatDateLabel(labelDate);
          return (
            <React.Fragment key={dayKey}>
              <div className="flex justify-center my-2">
                <span className="bg-gray-200 text-gray-700 text-xs px-4 py-1 rounded-full shadow-sm">
                  {label}
                </span>
              </div>
              {groupedByDay[dayKey].map((bubble: any, idx: number) => {
                const sentByMe = bubble.direction === "outbound";
                const senderType =
                  bubble.origin === "inbox_admin"
                    ? "admin"
                    : bubble.origin === "bot"
                    ? "ai"
                    : "human";
                const senderName =
                  senderType === "admin"
                    ? "Admin"
                    : senderType === "ai"
                    ? "Bot"
                    : "Cliente";
                const SenderIcon =
                  senderType === "admin"
                    ? User
                    : senderType === "ai"
                    ? Bot
                    : User;

                const isImage = bubble.type === "image" && bubble.media_url;

                return (
                  <div
                    key={(bubble.id || "") + idx}
                    className={`flex ${sentByMe ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex flex-col max-w-[80vw] md:max-w-[60vw]`}>
                      <div className={`flex items-center mb-1 ${sentByMe ? "justify-end" : "justify-start"}`}>
                        <SenderIcon className="h-4 w-4 text-muted-foreground mr-1" />
                        <span className="text-xs text-muted-foreground">{senderName}</span>
                      </div>
                      <div
                        className={`
                          px-4 py-2 rounded-2xl shadow
                          break-words
                          ${sentByMe
                            ? "bg-green-500 text-white rounded-br-md"
                            : "bg-gray-200 text-gray-900 rounded-bl-md"
                          }
                          relative
                        `}
                        style={{
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {isImage ? (
                          <div className="flex flex-col items-center">
                            <img
                              src={bubble.media_url}
                              alt="Imagen enviada"
                              className="max-w-xs max-h-60 rounded-lg mb-2 border"
                              style={{ objectFit: "cover" }}
                            />
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ImageIcon className="h-4 w-4" /> Imagen enviada
                            </span>
                          </div>
                        ) : (
                          <div className="text-sm whitespace-pre-line">{bubble.text}</div>
                        )}
                      </div>
                      <div className={`mt-1 flex items-center ${sentByMe ? "justify-end" : "justify-start"}`}>
                        <span className="text-xs text-muted-foreground">
                          {bubble.timestamp
                            ? format(new Date(bubble.timestamp), "HH:mm", { locale: es })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 pb-6">
        {!canType && (
          <div className="mb-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            <span>Para escribir al cliente, pulsa “Pasar a Chat en vivo”.</span>
          </div>
        )}
        <div className="flex items-end space-x-2 bg-white p-4 rounded-lg shadow">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (document.getElementById("file-input-hidden") as HTMLInputElement)?.click()}
            disabled={sending || !canType}
            title="Enviar imagen"
          >
            <Paperclip className="h-5 w-5" />
            <input
              id="file-input-hidden"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await handleSendImage(file);
                  e.target.value = "";
                }
              }}
              disabled={sending || !canType}
            />
          </Button>
          <Textarea
            placeholder={canType ? "Escribe un mensaje..." : "Activa Chat en vivo para escribir..."}
            className="flex-grow min-h-[40px] max-h-[120px] resize-none"
            rows={1}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={sending || !canType}
          />
          <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sending || !canType}>
            {sending ? "Enviando..." : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;