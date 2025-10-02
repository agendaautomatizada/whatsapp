"use client";

import React, { useState } from "react";
import ConversationList from "@/components/inbox/ConversationList";
import ChatHistory from "@/components/inbox/ChatHistory";
import ContactSidebar from "@/components/inbox/ContactSidebar";
import { extractPhone } from "@/utils/extractPhone";

const Inbox = () => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);

  // Para obtener el nombre del contacto, puedes modificar ConversationList para que pase el nombre, pero por ahora lo dejamos como el número
  // Si en el futuro quieres el nombre real, puedes levantarlo desde la base de datos

  return (
    <div className="h-screen flex flex-row">
      <div className="w-1/3 border-r">
        <ConversationList
          onSelectConversation={(sessionId) => {
            setSelectedSessionId(sessionId);
            setSelectedContactName(null); // Si tienes el nombre, pásalo aquí
          }}
          selectedSessionId={selectedSessionId}
        />
      </div>
      <div className="flex-1">
        {selectedSessionId ? (
          <ChatHistory sessionId={selectedSessionId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecciona un contacto para ver el historial.
          </div>
        )}
      </div>
      <div className="w-80 border-l bg-card">
        <ContactSidebar
          sessionId={selectedSessionId}
          contactName={selectedContactName || (selectedSessionId ? extractPhone(selectedSessionId) : null)}
        />
      </div>
    </div>
  );
};

export default Inbox;