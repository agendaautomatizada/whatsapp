import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL');
  const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

  if (!N8N_WEBHOOK_URL || !WHATSAPP_VERIFY_TOKEN) {
    console.error('Missing N8N_WEBHOOK_URL or WHATSAPP_VERIFY_TOKEN environment variables.');
    return new Response(JSON.stringify({ error: 'Server configuration error: Missing environment variables.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create a Supabase client with the service role key to fetch user settings securely
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
      },
    }
  );

  if (req.method === 'GET') {
    // Webhook verification for Meta
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('Webhook verified!');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    } else {
      console.error('Webhook verification failed.');
      return new Response('Verification token mismatch', { status: 403, headers: corsHeaders });
    }
  } else if (req.method === 'POST') {
    // Handle incoming WhatsApp messages
    try {
      const body = await req.json();
      console.log('Received WhatsApp webhook event:', JSON.stringify(body, null, 2));

      // Extract relevant information from the WhatsApp payload
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messageData = value?.messages?.[0];
      const contactData = value?.contacts?.[0];

      if (messageData && value?.metadata) {
        const recipientPhoneNumberId = value.metadata.phone_number_id; // Our business phone number ID
        const senderPhoneNumber = messageData.from; // The contact's phone number
        const senderName = contactData?.profile?.name || senderPhoneNumber; // Contact's name or phone number

        // Find the user_id associated with our business phone number ID
        const { data: settings, error: settingsError } = await supabaseAdmin
          .from('settings')
          .select('id') // We only need the user_id (which is 'id' in settings table)
          .eq('phone_number_id', recipientPhoneNumberId)
          .single();

        if (settingsError || !settings) {
          console.error('User settings not found for phone_number_id:', recipientPhoneNumberId, settingsError);
          // Still forward to n8n, but log the issue
        }

        const userId = settings?.id || null; // Get the user_id

        // Construct the message object to be stored in the database
        const messageToStore = {
          content: messageData.text?.body,
          timestamp: new Date(parseInt(messageData.timestamp) * 1000).toISOString(), // Convert Unix timestamp to ISO string
          type: messageData.type,
          direction: 'inbound',
          status: 'delivered', // Assuming incoming messages are delivered
          media_url: messageData.image?.id ? `https://graph.facebook.com/v19.0/${messageData.image.id}` : undefined, // Placeholder for media
          from: senderPhoneNumber, // The actual sender of the message
        };

        // Insert the message into n8n_chat_histories_productos
        const { error: insertError } = await supabaseAdmin
          .from('n8n_chat_histories_productos')
          .insert({
            session_id: senderPhoneNumber, // The contact's phone number as session_id
            message: messageToStore,
            name_id: senderName,
            number_id: recipientPhoneNumberId, // Our business phone number ID
            user_id: userId, // The user associated with this business number
          });

        if (insertError) {
          console.error('Error inserting incoming message into DB:', insertError);
          // Continue to forward to n8n even if DB insert fails
        } else {
          console.log('Incoming message successfully stored in DB.');
        }
      }

      // Forward the message to n8n
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!n8nResponse.ok) {
        const n8nError = await n8nResponse.text();
        console.error('Failed to forward message to n8n:', n8nError);
        return new Response(JSON.stringify({ error: 'Failed to forward message to n8n', details: n8nError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Message successfully forwarded to n8n.');
      return new Response(JSON.stringify({ status: 'success', forwarded: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error processing WhatsApp webhook event:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
});