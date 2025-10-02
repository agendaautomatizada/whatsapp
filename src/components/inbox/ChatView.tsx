"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, Smile, Phone, Video, MoreVertical, Plus, ArrowLeft, Check, CheckCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import LiveChatStatusBar from "./LiveChatStatusBar";

interface MessageContent {
  content?: string;
  timestamp: string;
  type: 'text' | 'image' | 'document';
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read';
  media_url?: string;
  from: string;
}

interface RawChatMessage {
  id: number;
  session_id: string;
  message: MessageContent;
  name_id: string | null;
  number_id: string | null;
}

interface ChatMessageDisplay {
  id: string;
  content?: string;
  mediaUrl?: string;
  type: 'text' | 'image' | 'document';
  sender: "me" | "other";
  time: string;
  rawTimestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

interface ChatViewProps {
  conversationId: string; // number_id
  onBack?: () => void;
}

const getStatusIcon = (status: 'sent' | 'delivered' | 'read') => {
  switch (status) {
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    default:
      return null;
  }
};

const ChatMessage = ({ message }: { message: ChatMessageDisplay }) => {
  const isMe = message.sender === "me";
  const bubbleClasses = isMe
    ? "bg-primary text-primary-foreground rounded-br-none"
    : "bg-muted text-muted-foreground rounded-bl-none";

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col max-w-[70%] p-3 rounded-lg ${bubbleClasses}`}>
        {message.type === 'text' && message.content && <p className="text-sm">{message.content}</p>}
        {message.type === 'image' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="message attachment" className="max-w-full h-auto rounded-md mt-1" />
        )}
        {message.type === 'document' && message.mediaUrl && (
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline text-blue-300 hover:text-blue-200">
            Documento adjunto
          </a>
        )}
        <div className={`flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"} mt-1`}>
          <span className="text-xs opacity-70">{message.time}</span>
          {isMe && getStatusIcon(message.status)}
        </div>
      </div>
    </div>
  );
};

function formatChatDate(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

const ChatView = ({ conversationId, onBack }: ChatViewProps) => {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const { data: rawMessages, isLoading, error } = useQuery<RawChatMessage[]>({
    queryKey: ["chatMessages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("n8n_chat_histories_productos")
        .select("id, session_id, message, name_id, number_id")
        .eq("number_id", conversationId)
        .order("message->>'timestamp'", { ascending: true });
      if (error) throw error;
      return data as RawChatMessage[];
    },
    enabled: !!conversationId,
    onSuccess: () => {
      setTimeout(scrollToBottom, 100);
    }
  });

  const currentNumberId = conversationId;
  const contactSessionId = rawMessages?.[0]?.session_id || "";

  const displayMessages: ChatMessageDisplay[] = React.useMemo(() => {
    if (!rawMessages) return [];
    return rawMessages.map((msg) => {
      const rawTimestamp = parseISO(msg.message.timestamp);
      const time = format(rawTimestamp, "HH:mm", { locale: es });
      const sender = msg.message.direction === "outbound" ? "me" : "other";
      return {
        id: msg.id.toString(),
        content: msg.message.content,
        mediaUrl: msg.message.media_url,
        type: msg.message.type,
        sender,
        time,
        rawTimestamp,
        status: msg.message.status,
      };
    });
  }, [rawMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      if (!conversationId) throw new Error("No hay conversación seleccionada.");
      if (!contactSessionId) throw new Error("No se pudo obtener el número del contacto.");
      const toastId = showLoading("Enviando mensaje...");
      try {
        const response = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            recipientPhoneNumber: contactSessionId,
            messageContent: messageContent,
          },
        });
        if (response.error) throw response.error;
        dismissToast(toastId);
        showSuccess("Mensaje enviado.");
        setNewMessage("");
        scrollToBottom();
      } catch (err: any) {
        dismissToast(toastId);
        showError(`Error al enviar mensaje: ${err.message || 'Error desconocido'}`);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chatHistories", "all"] });
    }
  });

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat_messages_updates:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "n8n_chat_histories_productos",
          filter: `number_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["chatHistories", "all"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, conversationId]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground items-center justify-center">
        <p>Cargando mensajes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground items-center justify-center text-red-500">
        <p>Error al cargar mensajes: {error.message}</p>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Selecciona un chat para ver los mensajes.
      </div>
    );
  }

  const messagesByDate: { [key: string]: ChatMessageDisplay[] } = {};
  displayMessages.forEach(msg => {
    const dateKey = format(msg.rawTimestamp, "yyyy-MM-dd");
    if (!messagesByDate[dateKey]) {
      messagesByDate[dateKey] = [];
    }
    messagesByDate[dateKey].push(msg);
  });

  const sortedDates = Object.keys(messagesByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const contactName = rawMessages?.[0]?.name_id || contactSessionId || conversationId;

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <LiveChatStatusBar sessionId={contactSessionId} />
      <div className="p-4 border-b flex items-center justify-between bg-card text-card-foreground">
        <div className="flex items-center gap-3">
          {isMobile && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-9 w-9">
            <AvatarImage src="/user-placeholder.svg" alt={contactName} />
            <AvatarFallback>{contactName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold">{contactName}</h2>
            <p className="text-xs text-muted-foreground">{contactSessionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Ver Contacto</DropdownMenuItem>
              <DropdownMenuItem>Archivar Chat</DropdownMenuItem>
              <DropdownMenuItem>Silenciar Notificaciones</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {sortedDates.map(dateKey => {
          const dateObj = parseISO(dateKey);
          const label = formatChatDate(dateObj);
          return (
            <React.Fragment key={dateKey}>
              <div className="flex justify-center my-4">
                <span className="bg-gray-200 text-gray-700 text-xs px-4 py-1 rounded-full shadow-sm">
                  {label}
                </span>
              </div>
              {messagesByDate[dateKey].map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t bg-card text-card-foreground">
        <div className="flex items-end space-x-2">
          <Button variant="ghost" size="icon">
            <Plus className="h-5 w-5" />
          </Button>
          <Textarea
            placeholder="Escribe un mensaje..."
            className="flex-grow min-h-[40px] max-h-[150px] resize-none"
            rows={1}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={sendMessageMutation.isPending}
          />
          <Button variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <Button onClick={handleSendMessage} disabled={!newMessage.trim() || sendMessageMutation.isPending}>
            {sendMessageMutation.isPending ? "Enviando..." : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;