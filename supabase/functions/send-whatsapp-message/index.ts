import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

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

    // Get the user ID from the JWT
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token or user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the user's WhatsApp API settings from the database
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('whatsapp_business_account_id, phone_number_id, access_token')
      .eq('id', user.id)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: 'WhatsApp API settings not found for this user.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { whatsapp_business_account_id, phone_number_id, access_token } = settings;

    if (!whatsapp_business_account_id || !phone_number_id || !access_token) {
      return new Response(JSON.stringify({ error: 'Missing one or more WhatsApp API credentials in settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recipientPhoneNumber, messageContent } = await req.json();

    if (!recipientPhoneNumber || !messageContent) {
      return new Response(JSON.stringify({ error: 'Missing recipientPhoneNumber or messageContent' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whatsappApiUrl = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;

    const messagePayload = {
      messaging_product: "whatsapp",
      to: recipientPhoneNumber,
      type: "text",
      text: {
        body: messageContent,
      },
    };

    const whatsappResponse = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const whatsappData = await whatsappResponse.json();

    if (!whatsappResponse.ok) {
      console.error('WhatsApp API Error:', whatsappData);
      return new Response(JSON.stringify({ error: 'Failed to send message via WhatsApp API', details: whatsappData }), {
        status: whatsappResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Store the outgoing message in the database ---
    const messageToStore = {
      content: messageContent,
      timestamp: new Date().toISOString(),
      type: 'text',
      direction: 'outbound',
      status: 'sent', // Initial status
      from: phone_number_id, // Our business phone number ID
    };

    const { error: insertError } = await supabaseAdmin
      .from('n8n_chat_histories_productos')
      .insert({
        session_id: recipientPhoneNumber, // The recipient's phone number as session_id
        message: messageToStore,
        name_id: recipientPhoneNumber, // Default to recipient phone number for name_id
        number_id: phone_number_id, // Our business phone number ID
        user_id: user.id, // The user who sent the message
      });

    if (insertError) {
      console.error('Error inserting outgoing message into DB:', insertError);
      // Log the error but still return success if WhatsApp API call was successful
    } else {
      console.log('Outgoing message successfully stored in DB.');
    }
    // --- End Store message ---

    return new Response(JSON.stringify({ message: 'Message sent successfully', data: whatsappData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});