# Totem de IA - Assistente Interativo Futurístico

Interface de IA inspirada no filme "A Chegada" com esfera central animada que reage aos estados da IA e visualização de fluxos em etapas com imagens geradas por IA.

## 🎯 Funcionalidades

### ✅ Implementadas

- **Esfera Central Animada**: Reage visualmente aos estados (idle, ouvindo, processando, falando)
- **Reconhecimento de Voz**: Web Speech API para captura de comandos por voz em português
- **Visualizador de Áudio**: Barras animadas durante a captura de voz
- **Backend com IA**: Integração com OpenAI para:
  - Análise de perguntas com GPT-4
  - Geração de fluxos dinâmicos em etapas
  - Criação de imagens personalizadas com DALL-E 3
- **Cards de Fluxo Interativos**: 
  - Imagens geradas por IA para cada etapa
  - Animações de conexão entre cards
  - Partículas fluindo entre etapas completadas
  - Badges de status (pendente/atual/concluído)
- **Botão de Parar**: Interromper a gravação ou execução do fluxo a qualquer momento
- **Ações Rápidas**: Botões para fluxos pré-definidos (Check-in, Direções, Ajuda)
- **Loading Overlay**: Feedback visual durante geração de imagens
- **Sistema de Erros**: Mensagens claras de erro com tratamento adequado

## 🚀 Como Usar

### 1. Configuração Inicial

A **API Key da OpenAI** já foi configurada. Se precisar atualizá-la:
- Você pode configurar através da interface do Supabase
- A chave está armazenada de forma segura como variável de ambiente `OPENAI_API_KEY`

### 2. Interação por Voz

1. Clique no **botão do microfone** (ícone cyan no centro inferior)
2. Fale sua pergunta em português (ex: "Como faço check-in?", "Onde fica o portão 15?")
3. A esfera mudará para **vermelho** enquanto ouve
4. O visualizador de áudio mostrará barras animadas
5. Sua fala será transcrita em tempo real no canto superior direito
6. Clique no **botão de parar** (ícone vermelho) para interromper a qualquer momento

### 3. Ações Rápidas

Clique em um dos botões na parte inferior:
- **Check-In**: Fluxo de check-in de voo
- **Direções**: Navegação para locais
- **Ajuda**: Protocolo de assistência

### 4. Visualização do Fluxo

Quando a IA processar sua pergunta:
1. A esfera se move para cima e diminui
2. Cards com imagens aparecem na parte inferior
3. Cada card representa uma etapa do processo
4. A etapa atual pulsa e exibe descrição detalhada
5. Linhas animadas conectam os cards
6. Partículas fluem entre etapas completadas

## 🎨 Estados Visuais

### Esfera Central
- **Idle (Cyan)**: Aguardando interação
- **Listening (Vermelho)**: Capturando voz
- **Processing (Amarelo)**: Processando pergunta
- **Speaking (Cyan Brilhante)**: Apresentando resposta

### Cards de Fluxo
- **Pendente**: Opaco com ícone cinza
- **Atual**: Destacado com borda cyan brilhante e pulso
- **Concluído**: Verde com check mark

## 🛠 Tecnologias

- **Frontend**: React + TypeScript + Motion (Framer Motion)
- **Estilo**: Tailwind CSS v4
- **Backend**: Supabase Edge Functions (Hono)
- **IA**: OpenAI GPT-4 + DALL-E 3
- **Voz**: Web Speech API (Chrome/Edge)
- **Roteamento**: React Router v7

## 📝 Estrutura de Arquivos

```
/src/app/
├── pages/
│   └── TotemPage.tsx          # Página principal
├── components/
│   └── totem/
│       ├── Sphere.tsx         # Esfera animada
│       ├── WorkflowVisualizer.tsx  # Cards de fluxo
│       ├── AudioVisualizer.tsx     # Visualizador de áudio
│       └── LoadingOverlay.tsx      # Tela de loading
│
/supabase/functions/server/
└── index.tsx                  # API backend com OpenAI
```

## 🔧 API Backend

### POST `/make-server-fca6f0da/process-question`
Processa pergunta e retorna fluxo com imagens.

**Request:**
```json
{
  "question": "Como faço para embarcar no voo?"
}
```

**Response:**
```json
{
  "workflow": {
    "id": "uuid",
    "title": "Check-in de Voo",
    "steps": [
      {
        "id": "1",
        "label": "Escanear Bilhete",
        "description": "...",
        "imageUrl": "https://...",
        "status": "pending"
      }
    ]
  }
}
```

## 🌐 Compatibilidade

- **Reconhecimento de Voz**: Chrome, Edge, Safari (requer HTTPS ou localhost)
- **Responsivo**: Design adaptável para desktop e mobile
- **Navegadores**: Modernos com suporte a ES6+

## 💡 Dicas

1. **Microfone**: Certifique-se de permitir acesso ao microfone quando solicitado
2. **HTTPS**: Reconhecimento de voz requer conexão segura
3. **Perguntas**: Seja específico nas perguntas para melhores resultados
4. **Tempo**: A geração de imagens pode levar 10-30 segundos

## 🐛 Troubleshooting

- **"Reconhecimento de voz não suportado"**: Use Chrome ou Edge
- **Microfone não funciona**: Verifique permissões do navegador
- **Imagens não carregam**: Aguarde mais tempo ou verifique API key
- **Erro na API**: Verifique console do navegador para detalhes

## 📦 Próximos Passos Sugeridos

- [ ] Adicionar Text-to-Speech para respostas faladas
- [ ] Histórico de conversas
- [ ] Suporte a múltiplos idiomas
- [ ] Animações 3D com Three.js
- [ ] Integração com câmera para reconhecimento facial
- [ ] Modo offline com respostas em cache
