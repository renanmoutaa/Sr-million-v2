import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import OpenAI from 'npm:openai'
import { encodeBase64 } from "jsr:@std/encoding/base64"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);

  // --- OTIMIZAÇÃO EXTREMA 2: TRUE AUDIO STREAMING (GET P/ ÁUDIO) ---
  // O Frontend vai dar um GET nesta URL para que o navegador toque o MP3 assim que a primeira sílaba for gerada!
  if (req.method === 'GET' && url.searchParams.get('action') === 'tts') {
    const text = url.searchParams.get('text');
    if (!text) {
      return new Response('Missing text', { status: 400, headers: corsHeaders });
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY') || '';
    const elevenLabsVoiceId = Deno.env.get('ELEVENLABS_VOICE_ID') || '';

    if (!elevenLabsApiKey || !elevenLabsVoiceId) {
      return new Response('Missing ElevenLabs Config', { status: 500, headers: corsHeaders });
    }

    try {
      // Fazemos o POST para a ElevenLabs requisitando MP3
      const audioResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}?output_format=mp3_44100_128&optimize_streaming_latency=3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.7 }
        })
      });

      if (!audioResponse.ok) {
        return new Response('ElevenLabs Error', { status: audioResponse.status, headers: corsHeaders });
      }

      // Repassamos (Stream Pipe) o corpo de áudio bruto diretamente para o navegador Cliente!
      return new Response(audioResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    } catch (e) {
      return new Response(String(e), { status: 500, headers: corsHeaders });
    }
  }

  try {
    const { message, sessionId } = await req.json()

    if (!message) {
      throw new Error('Message is required')
    }

    let workflow: any = null;
    let contextUsed = 0;

    // --- OTIMIZAÇÃO: FAST PATHS (Mantenha apenas via código o que não tem PDF no banco) ---
    const fastPaths: Record<string, any> = {
      "Fluxo Prospecção de Negócios": {
        id: "prospeccao_negocios",
        title: "Prospecção de Negócios",
        elaborated_by: "Kariny Rassmussem",
        approved_by: "Diogo Leonardo Barbosa",
        steps: [
          { id: "1", label: "Qualificação de Leads", description: "Separamos os contatos mais quentes", spoken_text: "A primeira etapa de prospecção é qualificar os leads e separar os contatos quentes.", status: "pending" },
          { id: "2", label: "Abordagem Inicial", description: "Primeiro contato telefônico ou e-mail", spoken_text: "Em seguida, nossa equipe entra em contato com uma abordagem inicial via telefone ou e-mail.", status: "pending" },
          { id: "3", label: "Agendamento", description: "Marcamos reunião com os executivos", spoken_text: "Por fim, agendamos uma reunião estruturada para fechar a parceria. Posso ajudar com mais detalhes?", status: "pending" },
        ]
      }
    };

    if (fastPaths[message]) {
      console.log(`Fast Path Activated for: ${message}`);
      workflow = fastPaths[message];
    } else {
      // --- SLOW PATH (RAG + OpenAI) ---
      // 1. Generate Context from the Vector Store (RAG)
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
        dimensions: 384,
      })
      const queryEmbedding = embeddingResponse.data[0].embedding

      // Initialize Supabase Client to trigger the custom RPC
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )

      // 1. Identification: Tenta encontrar o documento via Keywords ou Vetor
      // Como o banco está com discrepância de dimensões, o Keyword Search é 100% confiável para 4 PDFs.
      let primaryDocName = "";

      // Técnica 1: Busca por palavras-chave nos nomes dos documentos
      const keywords = ["marketing", "vendas", "técnica", "comercial", "indústria", "empacotado", "nutrição", "grão", "prospecção"];
      const foundKeyword = keywords.find(k => message.toLowerCase().includes(k));

      if (foundKeyword) {
        if (foundKeyword === "marketing" || foundKeyword === "vendas") primaryDocName = "POP 01 - Marketing - Etapas.pdf";
        if (foundKeyword === "técnica" || foundKeyword === "comercial") primaryDocName = "POP 01 - Comercial - Aplicação Técnica.pdf";
        if (foundKeyword === "indústria" || foundKeyword === "empacotado") primaryDocName = "POP 01 - Industria- Setup Empacotado.pdf";
        if (foundKeyword === "nutrição" || foundKeyword === "grão") primaryDocName = "POP 03 - Comercial - Nutrição Animal Grão.pdf";
      }

      // Técnica 2: Fallback para Vetor (se as keywords falharem e o usuário quiser testar)
      if (!primaryDocName) {
        console.log("No keyword match, trying vector match...");
        try {
          const { data: vMatches } = await supabaseClient.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 1,
          });
          if (vMatches && vMatches.length > 0) {
            // Se o metadata estiver em metadata.source (tabela documents antiga)
            primaryDocName = vMatches[0].metadata?.source || vMatches[0].document_name;
          }
        } catch (e) {
          console.warn("Vector identification failed, using default doc or error.", e);
        }
      }

      let contextText = ''
      if (primaryDocName) {
        console.log(`Primary document identified: ${primaryDocName}`);

        // 2. Retrieval: Puxa TODOS os chunks desse documento específico
        const { data: fullDocChunks, error: fetchError } = await supabaseClient
          .from('documents')
          .select('content')
          .filter('metadata->>source', 'eq', primaryDocName)
          .order('id', { ascending: true });

        if (fetchError) {
          console.error('Fetch full doc error:', fetchError);
        } else if (fullDocChunks && fullDocChunks.length > 0) {
          contextUsed = fullDocChunks.length;
          contextText = fullDocChunks.map(c => `[Doc: ${primaryDocName}]: ${c.content}`).join('\n\n');
        } else {
          console.log("No chunks found with metadata->>source filter. Trying content search fallback...");
          // Se o filtro de metadata falhar (Postgrest é chato com JSONB), tentamos um search simples no content ou pegamos os tops
          const { data: fallbackChunks } = await supabaseClient.from('documents').select('content').ilike('content', `%${primaryDocName}%`).limit(20);
          if (fallbackChunks) {
            contextText = fallbackChunks.map(c => c.content).join('\n\n');
          }
        }
      }

      // 2. Build the LLM Prompt - RETORNO DO ARRAY DE PASSOS (Groq é rápido o suficiente para gerar isso < 1s)
      const systemPrompt = `Você é o Agente Sr. Million, um assistente virtual experiente, extremamente prestativo e educado.
Sua missão é responder dúvidas corporativas com base nas Políticas Operacionais Padrão (POPs).

DIRETRIZES DE PERSONALIDADE:
1. INÍCIO DA FALA: Confirme sempre o que o usuário perguntou de forma natural.
2. FIM DA FALA: Pergunte OBRIGATORIAMENTE: "Gostaria de aprofundar em algum desses tópicos?" ou algo muito similar para encorajar a interação.
3. TOM: CONCISO, natural e amigável. Use frases curtas.

REGRAS DE FORMATAÇÃO (JSON):
- "workflow_title": Título curtinho (ex: Fluxo Técnico).
- "steps": OBRIGATÓRIO ter o mesmo número de passos do documento original, mas os campos abaixo devem ser RESUMIDOS:
    - "spoken_text": Texto fluido e natural para ser falado.
    - "label": Título BREVE do passo (máximo 4 palavras).
    - "description": Resumo BREVÍSSIMO do que deve ser feito (máximo 10 palavras).

Você DEVE retornar sua resposta em um formato JSON:
{
  "workflow_title": "Título",
  "elaborated_by": "Kariny Rassmussem",
  "approved_by": "Diogo Leonardo Barbosa",
  "steps": [
    { 
      "spoken_text": "...", 
      "label": "TÍTULO CURTO", 
      "description": "RESUMO BREVE" 
    }
  ]
}

CONTEXTO:
${contextText.substring(0, 12000)}
`

      console.log(`Sending to Groq context length: ${contextText.length}`);
      // console.log("CONTEXT PREVIEW:", contextText.substring(0, 500) + "..." + contextText.slice(-500));

      // 3. Ask Groq (Llama 3) for 10x faster generation
      const groqApiKey = Deno.env.get('GROQ_API_KEY');
      if (!groqApiKey) throw new Error("Missing GROQ_API_KEY");

      const t0 = Date.now();
      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0,
          max_tokens: 2048,
          response_format: { type: "json_object" }
        })
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error("Groq Error:", errorText);
        throw new Error(`Erro Groq: ${errorText}`);
      }

      console.log(`Groq generation took ${Date.now() - t0}ms`);

      const groqData = await groqResponse.json();
      const llmContent = groqData.choices[0].message.content;

      let parsedContent: {
        workflow_title?: string;
        elaborated_by?: string;
        approved_by?: string;
        steps?: any[];
      } = {
        workflow_title: "Erro",
        steps: []
      }
      try {
        if (llmContent) parsedContent = JSON.parse(llmContent)
      } catch (e) {
        console.error("Failed to parse JSON from Groq", e)
      }

      workflow = {
        id: "dynamic_answer",
        title: parsedContent.workflow_title || "Resposta Detalhada",
        elaborated_by: parsedContent.elaborated_by || "Kariny Rassmussem",
        approved_by: parsedContent.approved_by || "Diogo Leonardo Barbosa",
        steps: parsedContent.steps?.map((step: any, index: number) => ({
          id: index.toString(),
          label: step.label || "Passo",
          description: step.description || "",
          spoken_text: step.spoken_text || "",
          status: "pending"
        })) || []
      }
    }

    // Calculate guaranteed replica text
    const guaranteedReplyText = workflow.steps.map((s: any) => s.spoken_text || s.description || "").join(" ");

    // Removemos totalmente a geração de Base64 daqui.
    // O POST agora volta na velocidade da luz devolvendo SÓ o JSON.
    // O Frontend lerá o `reply` e o injetará no `<audio src="?action=tts&text=...">`

    return new Response(JSON.stringify({
      reply: guaranteedReplyText,
      workflow: workflow,
      context_used: contextUsed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error processing chat:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
