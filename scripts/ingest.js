import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotEnv from 'dotenv'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

dotEnv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY // Need SERVICE ROLE key for DB inserts bypassing RLS
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error("Missing environment variables.")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

const docsDir = path.join(process.cwd(), '..', 'docs_milion')

async function processDocs() {
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'))

    for (const file of files) {
        console.log(`Processing ${file}...`)
        const dataBuffer = fs.readFileSync(path.join(docsDir, file))

        try {
            const data = await pdfParse(dataBuffer)
            const text = data.text

            // Simple chunking strategy: split by double newlines or large paragraphs
            const chunks = text.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 50)

            console.log(`Found ${chunks.length} chunks in ${file}. Generating embeddings...`)

            for (const [i, chunk] of chunks.entries()) {
                const embeddingRes = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: chunk,
                })
                const embedding = embeddingRes.data[0].embedding

                const { error } = await supabase
                    .from('document_chunks')
                    .insert({
                        document_name: file,
                        content: chunk,
                        embedding
                    })

                if (error) {
                    console.error(`Error inserting chunk ${i} of ${file}:`, error)
                }
            }
            console.log(`Successfully ingested ${file}`)

        } catch (err) {
            console.error(`Failed to process ${file}`, err)
        }
    }
}

processDocs().then(() => console.log('Done')).catch(console.error)
