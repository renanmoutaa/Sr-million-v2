import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-fca6f0da/health", (c) => {
  return c.json({ status: "ok" });
});

// Process question and generate workflow with images
app.post("/make-server-fca6f0da/process-question", async (c) => {
  try {
    const { question } = await c.req.json();
    
    if (!question || typeof question !== "string") {
      return c.json({ error: "Question is required" }, 400);
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("OpenAI API key not configured");
      return c.json({ error: "OpenAI API key not configured" }, 500);
    }

    console.log(`Processing question: "${question}"`);

    // Step 1: Use OpenAI to analyze the question and generate workflow steps
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de aeroporto inteligente. Analise a pergunta do usuário e retorne um fluxo de etapas em formato JSON.
            
O JSON deve ter esta estrutura:
{
  "title": "Título do Fluxo",
  "steps": [
    {
      "id": "1",
      "label": "Nome da Etapa",
      "description": "Descrição detalhada da etapa (1-2 frases)",
      "imagePrompt": "Prompt visual para gerar imagem desta etapa (em inglês, descritivo, focado em ícones e símbolos minimalistas futuristas)"
    }
  ]
}

Crie entre 3-5 etapas. Os imagePrompts devem ser descritivos e visuais, focados em ícones, símbolos e representações minimalistas no estilo futurista do filme "A Chegada". Use fundo escuro e elementos cyan/azul brilhante.

Exemplos de imagePrompts:
- "futuristic holographic airport check-in icon, glowing cyan circular symbol, dark background, minimalist sci-fi style"
- "digital security scan symbol, futuristic biometric icon, glowing blue rings, arrival movie style"
- "holographic boarding gate symbol, minimalist futuristic arrow and portal icon, cyan glow, dark ambient"`
          },
          {
            role: "user",
            content: question,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!chatResponse.ok) {
      const error = await chatResponse.text();
      console.error("OpenAI Chat API error:", error);
      return c.json({ error: "Failed to process question with OpenAI" }, 500);
    }

    const chatData = await chatResponse.json();
    const workflowData = JSON.parse(chatData.choices[0].message.content);
    
    console.log("Generated workflow:", workflowData);

    // Step 2: Generate images for each step using DALL-E
    const stepsWithImages = await Promise.all(
      workflowData.steps.map(async (step: any) => {
        try {
          const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: step.imagePrompt,
              n: 1,
              size: "1024x1024",
              quality: "standard",
              style: "vivid",
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            return {
              ...step,
              imageUrl: imageData.data[0].url,
              status: "pending",
            };
          } else {
            console.error(`Failed to generate image for step ${step.id}`);
            return {
              ...step,
              imageUrl: null,
              status: "pending",
            };
          }
        } catch (error) {
          console.error(`Error generating image for step ${step.id}:`, error);
          return {
            ...step,
            imageUrl: null,
            status: "pending",
          };
        }
      })
    );

    const workflow = {
      id: crypto.randomUUID(),
      title: workflowData.title,
      steps: stepsWithImages,
      timestamp: new Date().toISOString(),
    };

    // Store workflow in KV store
    await kv.set(`workflow:${workflow.id}`, workflow);

    console.log("Workflow created successfully:", workflow.id);

    return c.json({ workflow });
  } catch (error) {
    console.error("Error processing question:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get workflow by ID
app.get("/make-server-fca6f0da/workflow/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const workflow = await kv.get(`workflow:${id}`);
    
    if (!workflow) {
      return c.json({ error: "Workflow not found" }, 404);
    }

    return c.json({ workflow });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

Deno.serve(app.fetch);
