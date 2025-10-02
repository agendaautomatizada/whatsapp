-- Tabla para los perfiles de usuario de tu aplicación
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT UNIQUE,
  avatar_url TEXT,
  full_name TEXT
);

-- Habilitar RLS para la tabla profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para profiles
CREATE POLICY "Users can view their own profile." ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can create their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete their own profile." ON profiles FOR DELETE USING (auth.uid() = id);

-- Tabla para la configuración de la API de WhatsApp de Meta
CREATE TABLE settings (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  whatsapp_business_account_id TEXT,
  phone_number_id TEXT,
  -- IMPORTANTE: El access_token debe ser manejado con EXTREMA precaución.
  -- Idealmente, no se almacena directamente en la base de datos si el frontend tiene acceso directo.
  -- Se recomienda usar un backend seguro (Edge Functions, Cloud Functions) para manejarlo.
  access_token TEXT,
  webhook_url TEXT,
  webhook_verify_token TEXT
);

-- Habilitar RLS para la tabla settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para settings
CREATE POLICY "Users can view their own settings." ON settings FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own settings." ON settings FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can create their own settings." ON settings FOR INSERT WITH CHECK (auth.uid() = id);

-- Tabla para los contactos de WhatsApp
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  notes TEXT,
  last_active TIMESTAMPTZ,
  UNIQUE (profile_id, phone_number)
);

-- Habilitar RLS para la tabla contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para contacts
CREATE POLICY "Users can view their own contacts." ON contacts FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can manage their own contacts." ON contacts FOR ALL USING (auth.uid() = profile_id);

-- Tabla para las etiquetas de contactos
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (profile_id, name)
);

-- Habilitar RLS para la tabla tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para tags
CREATE POLICY "Users can view their own tags." ON tags FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can manage their own tags." ON tags FOR ALL USING (auth.uid() = profile_id);

-- Tabla de unión para contactos y etiquetas (muchos a muchos)
CREATE TABLE contact_tags (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- Habilitar RLS para la tabla contact_tags
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para contact_tags
CREATE POLICY "Users can view their own contact tags." ON contact_tags FOR SELECT USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.profile_id = auth.uid()));
CREATE POLICY "Users can manage their own contact tags." ON contact_tags FOR ALL USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.profile_id = auth.uid()));

-- Tabla para las conversaciones
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  UNIQUE (profile_id, contact_id)
);

-- Habilitar RLS para la tabla conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para conversations
CREATE POLICY "Users can view their own conversations." ON conversations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can manage their own conversations." ON conversations FOR ALL USING (auth.uid() = profile_id);

-- Tabla para los mensajes
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  is_from_me BOOLEAN NOT NULL, -- true si lo envía el usuario de la plataforma, false si es del contacto
  type TEXT NOT NULL, -- 'text', 'image', 'video', etc.
  content TEXT, -- Contenido del mensaje de texto
  media_url TEXT, -- URL para imágenes/videos
  status TEXT, -- 'sent', 'delivered', 'read', 'failed'
  -- Opcional: message_id de WhatsApp para seguimiento
  whatsapp_message_id TEXT
);

-- Habilitar RLS para la tabla messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para messages
CREATE POLICY "Users can view their own messages." ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.profile_id = auth.uid()));
CREATE POLICY "Users can insert their own messages." ON messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.profile_id = auth.uid()));
CREATE POLICY "Users can update their own messages." ON messages FOR UPDATE USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.profile_id = auth.uid()));

-- Tabla para las plantillas de mensajes
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'es',
  category TEXT, -- 'utility', 'marketing', 'authentication'
  whatsapp_template_id TEXT, -- ID de la plantilla en Meta
  UNIQUE (profile_id, name)
);

-- Habilitar RLS para la tabla templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para templates
CREATE POLICY "Users can view their own templates." ON templates FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can manage their own templates." ON templates FOR ALL USING (auth.uid() = profile_id);

-- Tabla para envíos masivos (broadcasts)
CREATE TABLE broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'sending', 'completed', 'failed'
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

-- Habilitar RLS para la tabla broadcasts
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para broadcasts
CREATE POLICY "Users can view their own broadcasts." ON broadcasts FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can manage their own broadcasts." ON broadcasts FOR ALL USING (auth.uid() = profile_id);

-- Tabla de unión para envíos masivos y destinatarios (muchos a muchos)
CREATE TABLE broadcast_recipients (
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  PRIMARY KEY (broadcast_id, contact_id)
);

-- Habilitar RLS para la tabla broadcast_recipients
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para broadcast_recipients
CREATE POLICY "Users can view their own broadcast recipients." ON broadcast_recipients FOR SELECT USING (EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.profile_id = auth.uid()));
CREATE POLICY "Users can manage their own broadcast recipients." ON broadcast_recipients FOR ALL USING (EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.profile_id = auth.uid()));

-- Función para actualizar la columna updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_broadcasts_updated_at
BEFORE UPDATE ON broadcasts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();