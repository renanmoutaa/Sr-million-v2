import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import OpenAI from 'npm:openai'

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

  try {
    const { message, sessionId } = await req.json()

    if (!message) {
      throw new Error('Message is required')
    }

    // 1. Generate Context from the Vector Store (RAG)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // Initialize Supabase Client to trigger the custom RPC
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Call the matching function in Postgres. 
    // The user already has match_documents function created.
    const { data: documents, error: matchError } = await supabaseClient.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2, // Lowered threshold to ensure we capture related POPs
      match_count: 5,
    })

    if (matchError) {
      console.error('Match error:', matchError)
      throw new Error('Failed to match documents. ' + matchError.message)
    }

    let contextText = ''
    if (documents && documents.length > 0) {
      // We assume your table has 'content' or 'text' fields. We'll join whatever text data is returned.
      contextText = documents.map((doc: any) => `[Contexto]: ${doc.content || doc.text || JSON.stringify(doc)}`).join('\n\n')
    }

    // 2. Build the LLM Prompt
    const systemPrompt = `Você é o Agente Sr. Million, um assistente virtual experiente focado em ajudar clientes e colaboradores com base nas Políticas Operacionais Padrão (POPs) disponíveis. 
Você deve se apresentar e ser muito prestativo, tentando tirar as dúvidas com o contexto abaixo. 
Seja EXTREMAMENTE conciso e direto ao ponto em suas falas. Menos palavras significam uma resposta mais rápida do nosso sistema de áudio! Use frases curtas.
Se a pergunta fugir inteiramente do contexto corporativo fornecido, peça desculpas fluidamente. Evite negar respostas se existir algo vagamente relacionado no contexto.
As suas respostas devem ser adequadas para serem faladas em voz alta (texto para fala - TTS). Evite abreviações complexas ou formatações indecifráveis por voz.

Você DEVE OBRIGATORIAMENTE retornar sua resposta em um formato JSON na seguinte estrutura exata:
{
  "workflow_title": "Título curto do fluxo (ex: Fluxo Marketing, Fluxo Técnico, Fluxo Comercial)",
  "elaborated_by": "Kariny Rassmussem",
  "approved_by": "Diogo Leonardo Barbosa",
  "steps": [
    { 
      "spoken_text": "O trecho da frase natural e conversacional que o robô dirá em voz alta. PROIBIDO dizer 'Passo', 'Número', etc.",
      "label": "Título curto do card", 
      "description": "Resumo em uma linha para ler na tela" 
    },
    ...
  ]
}
O array "steps" pode ter de 1 até 8 passos no máximo, dependendo do documento.
MUITO IMPORTANTE: Não resuma o fluxo nem corte etapas! Se o Roteiro (POP) contiver 8 passos (ex: 1. Conferência, 2. Preparação ... 8. Encerramento), você DEVE RETORNAR a lista COMPLETA de 8 passos no array JSON. NUNCA entregue o trabalho pela metade.

IMPORTANTE: Não retorne "reply" global! A fala do robô será a soma exata de todos os "spoken_text". Seja natural, fluido e conciso! 
OBRIGATÓRIO: O último 'spoken_text' do seu array DEVE conter uma pergunta de engajamento no final (ex: "Entendeu direitinho?", "Quer que eu explique alguma etapa de novo?").

CONTEXTO DOS DOCUMENTOS (POPs):
${contextText}
`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]

    // 3. Ask OpenAI
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    })

    const llmContent = chatResponse.choices[0].message.content
    let parsedContent: {
      reply?: string;
      workflow_title?: string;
      elaborated_by?: string;
      approved_by?: string;
      steps: any[]
    } = {
      reply: "Desculpe, ocorreu um erro na formatação da resposta.",
      workflow_title: "Erro",
      steps: []
    }
    try {
      if (llmContent) parsedContent = JSON.parse(llmContent)
    } catch (e) {
      console.error("Failed to parse JSON from LLM", e)
    }

    const workflow = {
      id: "dynamic_answer",
      title: parsedContent.workflow_title || "Resposta Detalhada",
      elaborated_by: parsedContent.elaborated_by || "Kariny Rassmussem",
      approved_by: parsedContent.approved_by || "Diogo Leonardo Barbosa",
      steps: parsedContent.steps?.map((step: any, index: number) => ({
        id: index.toString(),
        label: step.label,
        description: step.description,
        spoken_text: step.spoken_text,
        status: "pending"
      })) || []
    }

    // STRICTLY enforce the final reply text to match the steps' concatenation
    // If the LLM halucinates a separate "reply" field, ignore it!
    const guaranteedReplyText = workflow.steps.map((s: any) => s.spoken_text || s.description || "").join(" ");

    return new Response(JSON.stringify({
      reply: guaranteedReplyText,
      workflow: workflow,
      context_used: documents?.length || 0
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
