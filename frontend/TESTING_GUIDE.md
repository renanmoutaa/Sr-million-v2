# 🧪 Guia de Testes - Totem de IA

## Testes Rápidos

### 1. Teste da Interface Base ✅
**O que fazer:**
- Abra a aplicação
- Observe a esfera central cyan girando suavemente
- Veja o header "Sistema Online v2.4.1 • Conectado"
- Verifique os 3 botões de ação rápida na parte inferior
- Veja o botão do microfone cyan no centro

**Resultado esperado:** Interface carrega sem erros com design dark futurístico

---

### 2. Teste de Ação Rápida ✅ 
**O que fazer:**
1. Clique em qualquer botão de ação rápida (Check-In, Direções ou Ajuda)
2. Observe a esfera mudar para amarelo (processing)
3. Aguarde 1 segundo

**Resultado esperado:**
- Esfera sobe e diminui
- Cards aparecem na parte inferior com animação
- Cada card mostra etapas do fluxo
- Etapa atual pulsa em cyan
- Cards progridem automaticamente a cada 3 segundos
- Após conclusão, retorna ao estado inicial

---

### 3. Teste de Reconhecimento de Voz 🎤
**O que fazer:**
1. Clique no botão do microfone (cyan)
2. Permita acesso ao microfone quando solicitado
3. Observe a esfera mudar para vermelho
4. Veja o visualizador de áudio aparecer no topo (barras animadas)
5. Fale uma pergunta, por exemplo:
   - "Como faço check-in?"
   - "Onde fica o portão 15?"
   - "Preciso de ajuda com minha bagagem"

**Resultado esperado:**
- Esfera fica vermelha e pulsa
- Barras de áudio se movem conforme você fala
- Texto transcrito aparece no canto superior direito
- Após parar de falar, a transcrição é enviada

---

### 4. Teste do Botão de Parar 🛑
**O que fazer:**
1. Clique no microfone para começar a ouvir
2. Fale algo
3. Clique no botão vermelho de STOP antes de terminar

**Resultado esperado:**
- Gravação para imediatamente
- Esfera volta ao estado idle (cyan)
- Interface reseta para o estado inicial

---

### 5. Teste de Integração OpenAI 🤖
**⚠️ Requer API Key da OpenAI configurada**

**O que fazer:**
1. Clique no microfone
2. Fale uma pergunta específica como: "Quero fazer check-in para meu voo internacional"
3. Aguarde o processamento

**Resultado esperado:**
- Overlay de loading aparece com mensagem "Gerando fluxo personalizado com IA..."
- Após 10-30 segundos:
  - Cards aparecem com imagens únicas geradas pela IA
  - Cada card tem uma imagem relacionada à etapa
  - Descrições personalizadas baseadas na sua pergunta
  - Animações de conexão entre os cards
  - Partículas fluem entre etapas completadas

---

### 6. Teste de Erros 🚨
**O que fazer:**
1. Teste sem API key:
   - Fale no microfone
   - Deve mostrar erro claro no topo

2. Teste em navegador sem suporte:
   - Abra em Firefox (pode não ter Web Speech API)
   - Deve mostrar mensagem de erro apropriada

3. Teste negando permissões:
   - Negue acesso ao microfone
   - Deve mostrar erro "Erro no reconhecimento de voz"

**Resultado esperado:** Mensagens de erro claras em vermelho no topo da tela

---

## Exemplos de Perguntas para Testar

### Perguntas Simples:
- "Como faço check-in?"
- "Onde fica o banheiro?"
- "Preciso de ajuda"

### Perguntas Específicas:
- "Quero fazer check-in para voo internacional com bagagem despachada"
- "Como chegar ao portão B15 vindo do terminal 2?"
- "Perdi meu cartão de embarque, o que devo fazer?"

### Perguntas Complexas:
- "Meu voo atrasou e preciso remarcar, qual o processo completo?"
- "Como funciona o processo de conexão internacional?"
- "Quero despachar bagagem frágil, quais são as etapas?"

---

## Checklist de Funcionalidades

- [ ] Esfera anima corretamente em todos os estados
- [ ] Microfone captura voz (Chrome/Edge)
- [ ] Visualizador de áudio aparece ao falar
- [ ] Transcrição aparece em tempo real
- [ ] Botão de parar funciona
- [ ] Ações rápidas funcionam
- [ ] Cards aparecem com animação
- [ ] Etapas progridem automaticamente
- [ ] Animações de conexão entre cards
- [ ] Loading overlay aparece durante geração
- [ ] Imagens da OpenAI carregam (se API configurada)
- [ ] Erros são tratados adequadamente
- [ ] Interface é responsiva

---

## Troubleshooting

### Microfone não funciona
1. Verifique se está usando Chrome ou Edge
2. Verifique se a URL é HTTPS ou localhost
3. Verifique permissões do navegador (ícone de cadeado na barra de endereço)
4. Teste em uma janela anônima

### OpenAI não responde
1. Verifique se a API key foi configurada
2. Verifique o console do navegador (F12) para erros
3. Verifique se há créditos na conta OpenAI
4. Aguarde mais tempo (DALL-E pode demorar)

### Cards não aparecem
1. Verifique o console para erros
2. Teste com ações rápidas primeiro
3. Verifique conexão com o backend

---

## Métricas de Performance

- **Tempo de resposta GPT-4**: ~2-5 segundos
- **Tempo de geração DALL-E**: ~10-30 segundos
- **Total por pergunta**: ~15-35 segundos
- **Transcrição de voz**: Tempo real
- **Animações**: 60 FPS

---

## Próximos Testes Recomendados

1. **Teste de Carga**: Múltiplas perguntas seguidas
2. **Teste de Idioma**: Perguntas em inglês/espanhol
3. **Teste Mobile**: Testar em dispositivos móveis
4. **Teste de Acessibilidade**: Screen readers
5. **Teste de Rede Lenta**: Throttling de rede no DevTools
