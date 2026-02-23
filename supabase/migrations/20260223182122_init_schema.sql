-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector
with schema extensions;

-- Create the document chunks table for the RAG system
create table if not exists document_chunks (
  id bigint primary key generated always as identity,
  document_name text not null,
  content text not null,
  embedding vector(1536), -- Assuming OpenAI text-embedding-3-small or ada-002
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index to improve vector search performance (HNSW)
create index if not exists document_chunks_embedding_idx on document_chunks using hnsw (embedding vector_ip_ops);

-- Create the chat sessions table
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the messages table for each session
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function for vector similarity search (called from the Edge Function via RPC)
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  document_name text,
  content text,
  similarity float
)
language sql
as $$
  select
    document_chunks.id,
    document_chunks.document_name,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
