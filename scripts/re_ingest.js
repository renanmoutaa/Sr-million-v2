import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotEnv from 'dotenv'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

dotEnv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error("Missing environment variables in scripts/.env")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

const docsDir = path.join(process.cwd(), '..', '..', 'docs_milion')

async function cleanAndIngest() {
    console.log("--- Starting Re-Ingestion Process (Target: documents table) ---")

    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'))

    for (const file of files) {
        // Limpamos apenas os chunks deste arquivo específico para evitar duplicatas se rodar de novo
        console.log(`Cleaning old entries for ${file}...`)
        // No Postgrest, para filtrar por valor dentro de JSONB usamos ->>
        // Mas como estamos usando o client JS, o eq('metadata->source', file) pode funcionar dependendo da versão
        // Vou usar um delete baseado no que o match_documents retorna no metadata: source
        await supabase.from('documents').delete().filter('metadata->>source', 'eq', file)

        console.log(`Processing ${file}...`)
        const dataBuffer = fs.readFileSync(path.join(docsDir, file))

        try {
            const data = await pdfParse(dataBuffer)
            // Limpeza de texto: remove quebras de linha excessivas mas tenta manter a estrutura
            const text = data.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n')

            // High Precision Overlapping: 600 caracteres com 200 de sobreposição
            const chunkSize = 650
            const overlap = 200
            const chunks = []

            for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
                let chunk = text.substring(i, i + chunkSize)
                if (chunk.length > 50) {
                    chunks.push(chunk)
                }
                if (i + chunkSize >= text.length) break
            }

            console.log(`Creating ${chunks.length} overlapping chunks for ${file}...`)

            for (const [idx, chunk] of chunks.entries()) {
                const embeddingRes = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: chunk,
                    dimensions: 384
                })
                const embedding = embeddingRes.data[0].embedding
                console.log(`Embedding for chunk ${idx} length: ${embedding.length}`)

                const { error } = await supabase
                    .from('documents')
                    .insert({
                        content: chunk,
                        embedding,
                        metadata: { source: file, chunk_index: idx, type: 'pop' }
                    })

                if (error) {
                    console.error(`Error inserting chunk ${idx} for ${file}:`, error.message)
                }
            }
            console.log(`✅ Ingested ${file} successfully.`)

        } catch (err) {
            console.error(`❌ Failed to process ${file}`, err)
        }
    }
    console.log("--- Re-Ingestion Complete ---")
}

cleanAndIngest().catch(console.error)
