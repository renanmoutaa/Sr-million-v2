import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, StopCircle, ArrowRight, MapPin, HelpCircle, Accessibility } from "lucide-react";
import { SimliClient, generateSimliSessionToken, generateIceServers } from "simli-client";
import { WorkflowVisualizer, WorkflowStep } from "../components/totem/WorkflowVisualizer";
import { LoadingOverlay } from "../components/totem/LoadingOverlay";
import { AudioVisualizer } from "../components/totem/AudioVisualizer";
import { cn } from "../../lib/utils";
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
const elevenLabsApiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY;
const elevenLabsVoiceId = (import.meta as any).env.VITE_ELEVENLABS_VOICE_ID;
const simliApiKey = (import.meta as any).env.VITE_SIMLI_API_KEY;
const simliFaceId = (import.meta as any).env.VITE_SIMLI_FACE_ID;

type ConversationState = "idle" | "listening" | "processing" | "answering";

interface Workflow {
  id: string;
  title: string;
  steps: WorkflowStep[];
}

const SAMPLE_WORKFLOWS: Record<string, Workflow> = {
  marketing: {
    id: "marketing",
    title: "Etapas de Marketing",
    steps: [
      { id: "1", label: "Consultando BD", description: "Buscando o POP de Marketing...", status: "pending" },
      { id: "2", label: "Filtrando Etapas", description: "Listando os passos comerciais...", status: "pending" },
    ],
  },
  comercial_tecnica: {
    id: "comercial_tecnica",
    title: "Aplicação Técnica",
    steps: [
      { id: "1", label: "Consultando BD", description: "Buscando o POP Comercial...", status: "pending" },
      { id: "2", label: "Resumindo", description: "Lendo as normas de aplicação...", status: "pending" },
    ],
  },
  industria: {
    id: "industria",
    title: "Setup de Indústria",
    steps: [
      { id: "1", label: "Consultando BD", description: "Buscando POP de Indústria e Empacotamento...", status: "pending" },
      { id: "2", label: "Extraindo Fatos", description: "Preparando diretrizes de setup...", status: "pending" },
    ],
  },
};

export function TotemPage() {
  const [state, setState] = useState<ConversationState>("idle");
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [conversationContext, setConversationContext] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [showA11yMenu, setShowA11yMenu] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [isAvatarConnected, setIsAvatarConnected] = useState(false);
  const [simliError, setSimliError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const simliClientRef = useRef<SimliClient | null>(null);

  const stateRef = useRef(state);
  const transcriptRef = useRef(transcript);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Removed redundant audio initialization that was breaking DOM reference
  useEffect(() => {
    // audioRef is now correctly tied only to the hidden <audio> element in the JSX
  }, []);

  // Initialize Simli WebRTC Client
  useEffect(() => {
    if (audioRef.current && !simliClientRef.current) {
      const initSimli = async () => {
        try {
          const sessionTokenParams = {
            config: {
              faceId: simliFaceId,
              handleSilence: true,
              maxSessionLength: 3600,
              maxIdleTime: 3600
            },
            apiKey: simliApiKey
          };
          const tokenRes = await generateSimliSessionToken(sessionTokenParams);
          // Wait for videoRef to be attached if it's not yet
          if (!videoRef.current) return;

          const iceServers = await generateIceServers(simliApiKey);

          simliClientRef.current = new SimliClient(
            tokenRes.session_token,
            videoRef.current!,
            audioRef.current!,
            iceServers
          );

          simliClientRef.current.on('start', () => {
            console.log('Simli Avatar connected');
            setIsAvatarConnected(true);
            setSimliError(null);
          });
          simliClientRef.current.on('error', (e: any) => {
            const errorMsg = String(e);
            console.error('Simli connection failed', errorMsg);
            setIsAvatarConnected(false);
            if (errorMsg.includes("RATE LIMIT")) {
              setSimliError("Limite de conexões atingido. Aguarde 30 segundos.");
            } else {
              setSimliError("Erro de conexão com o avatar.");
            }
          });
          simliClientRef.current.on('stop', () => {
            console.log('Simli Avatar stopped');
            setIsAvatarConnected(false);
          });
        } catch (e: any) {
          console.error("Failed to init Simli:", e);
          setSimliError("Falha ao inicializar o avatar.");
        }
      };

      // We must wait until the videoRef is actually attached in the DOM
      const timer = setTimeout(() => {
        initSimli();
      }, 1000);
      return () => {
        clearTimeout(timer);
        if (simliClientRef.current) {
          try {
            simliClientRef.current.stop();
            simliClientRef.current = null; // Ensure nullified for next effect
          } catch (e) { }
        }
      };
    }
  }, []);

  const handleRetrySimli = () => {
    if (simliClientRef.current) {
      simliClientRef.current.stop();
      simliClientRef.current = null;
    }
    setSimliError("Reiniciando...");
    setIsAvatarConnected(false);
    // Component will re-init due to simliClientRef being null in next render?
    // Actually simplicity: just force a reload or wait for the useEffect again
    // Let's just trigger a manual init here for speed
    const reInit = async () => {
      // repeat init logic or just reload? 
      // Better: just trigger the initial useEffect logic again by using a key or simliClientRef null check
      window.location.reload();
    };
    setTimeout(reInit, 500);
  };

  const unlockAudio = async () => {
    if (audioRef.current) {
      // Small silent 8kHz WAV to bless the audio element's execution context
      audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
      }).catch(() => { });
    }

    if (simliClientRef.current) {
      try {
        await simliClientRef.current.start();
        console.log("Simli WebRTC Audio Unlocked!");
      } catch (e) {
        console.warn('Simli start explicitly called but failed', e);
      }
    }
  };

  // Initialize Web Speech API
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        transcriptRef.current = currentTranscript; // force immediate update for onend
      };

      recognitionRef.current.onend = () => {
        if (stateRef.current === "listening") {
          if (transcriptRef.current.trim()) {
            handleProcessTranscript(transcriptRef.current);
          } else {
            // Se parou de ouvir e não captou nada, volta pro idle
            setState("idle");
            setConversationContext("");
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error:", event.error);
          setError(`Erro no reconhecimento de voz: ${event.error}`);
        }
        setState("idle");
        setConversationContext("");
      };
    } else {
      console.warn("Web Speech API not supported");
      setError("Reconhecimento de voz não suportado neste navegador");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);


  const handleProcessTranscript = async (text: string) => {
    setState("processing");
    setConversationContext(`Sr. Million está pensando...`);
    setError("");
    setIsGeneratingImages(true);

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ message: text }),
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao processar roteiro com a IA.");
      }

      const data = await response.json();
      const replyText = data.reply;
      const workflow = data.workflow;

      if (workflow) {
        setActiveWorkflow(workflow);
        setCurrentStepIndex(0);
      }

      setConversationContext(`Resposta: Gerando Áudio...`);
      setIsGeneratingImages(false);

      // Call ElevenLabs TTS (Requesting PCM 16kHz for Simli)
      const audioResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}?output_format=pcm_16000&optimize_streaming_latency=3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: replyText,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.7 }
        })
      });

      if (!audioResponse.ok) {
        throw new Error("Erro ao gerar áudio com ElevenLabs");
      }

      const audioArrayBuffer = await audioResponse.arrayBuffer();
      const pcmData = new Uint8Array(audioArrayBuffer);
      const duration = pcmData.length / 32000; // 16kHz, 16-bit mono = 32000 bytes/sec

      setState("answering");
      setConversationContext(replyText);

      // Sending audio in chunks to Simli for better synchronization
      const sendAudioInChunks = async () => {
        const chunkSize = 4000; // Smaller chunks for even better sync (~125ms)
        for (let i = 0; i < pcmData.length; i += chunkSize) {
          if (!simliClientRef.current) break;
          const chunk = pcmData.slice(i, i + chunkSize);
          simliClientRef.current.sendAudioData(chunk);
          // Wait slightly less than chunk duration (125ms)
          await new Promise(resolve => setTimeout(resolve, 110));
        }
      };

      // Start the chunked transmission
      sendAudioInChunks();

      let totalChars = 0;
      workflow?.steps.forEach((s: any) => totalChars += (s.spoken_text || s.description || "123").length);

      // Simulate audio progress for the UI cards
      let currentTimeMs = 0;
      const progressInterval = setInterval(() => {
        currentTimeMs += 100;
        const percent = (currentTimeMs / 1000) / duration;

        let cumulativePercent = 0;
        let foundIndex = (workflow?.steps.length || 1) - 1;

        if (percent < 0.01) {
          foundIndex = 0;
        } else if (workflow?.steps) {
          for (let i = 0; i < workflow.steps.length; i++) {
            const s = workflow.steps[i];
            const weight = (s.spoken_text || s.description || "123").length / (totalChars || 1);
            cumulativePercent += weight;

            if (percent <= cumulativePercent) {
              foundIndex = i;
              break;
            }
          }
        }
        setCurrentStepIndex(prev => prev !== foundIndex ? foundIndex : prev);
      }, 100);

      // Timeout to end state
      const endTimeout = setTimeout(() => {
        clearInterval(progressInterval);
        setState("idle");
        setActiveWorkflow(null);
        setCurrentStepIndex(0);
        setConversationContext("");
        setIsAvatarConnected(false);
      }, duration * 1000 + 1000);

      (window as any)._audioProgressInterval = progressInterval;
      (window as any)._audioEndTimeout = endTimeout;

      setState("answering");
      setConversationContext(replyText); // Show the text while speaking

      // Auto-translate using VLibras API if the widget is loaded
      try {
        const vwPlugin = (window as any).plugin;
        if (vwPlugin) {
          if (typeof vwPlugin.videoPlayer?.translate === 'function') {
            vwPlugin.videoPlayer.translate(replyText);
          } else if (typeof vwPlugin.translate === 'function') {
            vwPlugin.translate(replyText);
          }
        }
      } catch (e) {
        console.error("VLibras auto-translate issue:", e);
      }

    } catch (error: any) {
      console.error("Error processing question:", error);
      setError(`Erro: ${error.message}`);
      setIsGeneratingImages(false);
      setState("idle");
      setConversationContext("");
    }
  };

  const handleStartListening = () => {
    if (state !== "idle") return;

    unlockAudio();

    if (!recognitionRef.current) {
      setError("Reconhecimento de voz não disponível");
      return;
    }

    setState("listening");
    setConversationContext("Ouvindo...");
    setTranscript("");
    setError("");
    setActiveWorkflow(null);
    setCurrentStepIndex(0);

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error("Error starting recognition:", error);
      setError("Erro ao iniciar reconhecimento de voz");
      setState("idle");
    }
  };

  const handleStop = () => {
    if (recognitionRef.current && state === "listening") {
      recognitionRef.current.stop();
    }

    // Immediately stop audio if playing via Simli
    if (simliClientRef.current) {
      simliClientRef.current.ClearBuffer();
    }

    // Clear simulated timeouts
    if ((window as any)._audioProgressInterval) clearInterval((window as any)._audioProgressInterval);
    if ((window as any)._audioEndTimeout) clearTimeout((window as any)._audioEndTimeout);

    setState("idle");
    setActiveWorkflow(null);
    setCurrentStepIndex(0);
    setConversationContext("");
    setTranscript("");
    setError("");
    setIsGeneratingImages(false);
    setIsAvatarConnected(false);
  };

  const handleQuickAction = async (key: string) => {
    if (state !== "idle") return;

    unlockAudio();

    // Convert key to a natural question for our RAG backend
    let questionToProcess = "";
    if (key === "pop_marketing") questionToProcess = "Quais são os procedimentos e etapas do POP de Marketing e Vendas?";
    else if (key === "pop_comercial") questionToProcess = "Liste o passo a passo completo do POP de Aplicação Técnica e Comercial.";
    else if (key === "pop_industria") questionToProcess = "Como funciona o Setup Empacotado de Máquinas no POP da Indústria?";
    else if (key === "pop_totem") questionToProcess = "Me fale tudo sobre o POP de Prospecção e Desenvolvimento de Negócios.";

    await handleProcessTranscript(questionToProcess);
  };

  // Compute steps with current status
  const currentSteps = activeWorkflow?.steps.map((step, index) => ({
    ...step,
    status: index < currentStepIndex ? "completed" : index === currentStepIndex ? "current" : "pending",
  })) as WorkflowStep[] | undefined;

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex flex-col relative">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isGeneratingImages && (
          <LoadingOverlay message="Sr. Million está pensando..." />
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-slate-900 via-black to-black -z-20" />
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-cyan-900/10 to-transparent -z-10" />

      {/* Header / Status & Accessibility */}
      <header className="absolute top-8 left-8 right-8 flex justify-between items-start z-20">
        <div>
          <h1 className="text-sm font-light tracking-[0.3em] text-cyan-500 uppercase opacity-80">
            Sistema Online
          </h1>
          <p className="text-xs text-slate-500 mt-1">v2.4.1 • Conectado</p>
        </div>

        {/* Accessibility Menu */}
        <div className="relative">
          <button
            onClick={() => setShowA11yMenu(!showA11yMenu)}
            className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/50 transition-all text-cyan-400"
            title="Acessibilidade"
          >
            <Accessibility className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showA11yMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute right-0 mt-4 w-48 bg-cyan-950/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-2xl flex flex-col gap-3"
              >
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-b border-cyan-500/20 pb-2 mb-1">Acessibilidade</h3>

                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-300 group-hover:text-cyan-200 transition-colors">Legendas</span>
                  <div className={cn("w-10 h-5 rounded-full transition-colors relative", showSubtitles ? "bg-cyan-500" : "bg-slate-700")}>
                    <div className={cn("absolute top-0.5 bottom-0.5 w-4 rounded-full bg-white transition-all shadow-sm", showSubtitles ? "right-0.5" : "left-0.5")} />
                  </div>
                  <input type="checkbox" className="hidden" checked={showSubtitles} onChange={() => setShowSubtitles(!showSubtitles)} />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Context Display - Minimalist (Acting as Subtitles) */}
      <AnimatePresence>
        {showSubtitles && conversationContext && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 right-8 max-w-xs text-right z-20"
          >
            <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 inline-block shadow-lg">
              <span className="text-xs text-cyan-400 uppercase tracking-wider block mb-1">Contexto Atual / Legenda</span>
              <p className="text-sm text-slate-300 font-light">{conversationContext}</p>
              {transcript && state === "listening" && (
                <p className="text-xs text-cyan-200 mt-2 italic">{transcript}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="bg-red-500/20 border border-red-500/50 px-4 py-2 rounded-lg backdrop-blur-md">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">

        {/* Audio Visualizer when listening */}
        <AnimatePresence>
          {state === "listening" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-32 left-0 right-0 flex justify-center"
            >
              <div className="bg-black/40 backdrop-blur-md px-8 py-4 rounded-2xl border border-red-500/30">
                <AudioVisualizer />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Avatar Screen - Moves based on state */}
        <motion.div
          animate={{
            opacity: state === "listening" ? 0.6 : 1,
          }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          className={cn(
            "rounded-full overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_80px_rgba(8,145,178,0.2)] transition-all duration-1000",
            state === "answering"
              ? "absolute top-4 left-1/2 -translate-x-1/2 w-72 h-72 z-50"
              : "relative mx-auto w-96 h-96 z-10 mt-16"
          )}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={cn(
              "w-full h-full object-cover transition-opacity duration-1000",
              isAvatarConnected ? "opacity-100" : "opacity-0"
            )}
          />
          {!isAvatarConnected && state === "answering" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md z-10">
              {simliError ? (
                <>
                  <p className="text-red-400 text-[10px] mb-4 text-center px-4 uppercase tracking-wider">{simliError}</p>
                  <button
                    onClick={handleRetrySimli}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[9px] rounded-full border border-cyan-500/30 transition-all font-bold uppercase tracking-widest shadow-lg shadow-cyan-500/10"
                  >
                    Reiniciar Conexão
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
                  <p className="text-[10px] text-cyan-400 uppercase tracking-widest animate-pulse">Estabelecendo Conexão...</p>
                </>
              )}
            </div>
          )}
          <audio ref={audioRef} autoPlay className="hidden" />
          {state === "listening" && (
            <div className="absolute inset-0 rounded-full border-4 border-cyan-400 animate-ping opacity-30 pointer-events-none" />
          )}
          {state === "processing" && (
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500 opacity-50 pointer-events-none animate-pulse" />
          )}
        </motion.div>

        {/* Workflow Visualization Overlay */}
        <AnimatePresence>
          {state === "answering" && currentSteps && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-40 left-0 right-0 flex justify-center px-4"
            >
              <WorkflowVisualizer steps={currentSteps} className="w-full max-w-6xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interaction Zone (Mic & Quick Actions) */}
        <motion.div
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-8 z-50"
        >
          {/* Quick Actions */}
          {state === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap justify-center gap-4 px-4"
            >
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Marketing e Vendas?"
                onClick={() => handleQuickAction("pop_marketing")}
              />
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Aplicação Técnica?"
                onClick={() => handleQuickAction("pop_comercial")}
              />
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Setup de Empacotamento?"
                onClick={() => handleQuickAction("pop_industria")}
              />
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Prospecção de Negócios?"
                onClick={() => handleQuickAction("pop_totem")}
              />
            </motion.div>
          )}

          {/* Microphone / Stop Button */}
          <div className="flex flex-col items-center gap-4">
            {state === "idle" ? (
              <button
                onClick={handleStartListening}
                className={cn(
                  "relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300",
                  "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:scale-110 shadow-[0_0_20px_rgba(8,145,178,0.2)]"
                )}
              >
                {/* Ripple Effect Ring */}
                <div className="absolute inset-0 rounded-full border border-current opacity-30 scale-110 group-hover:scale-125 transition-transform duration-500" />

                <Mic className="w-8 h-8" />
              </button>
            ) : (
              <button
                onClick={handleStop}
                className={cn(
                  "relative group flex items-center justify-center gap-3 px-8 py-4 rounded-full transition-all duration-300",
                  "bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:scale-105 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                )}
              >
                {/* Ripple Effect Ring */}
                <div className="absolute inset-0 rounded-full border border-red-500/50 opacity-30 scale-105 animate-pulse" />

                <StopCircle className="w-6 h-6" />
                <span className="font-bold tracking-widest uppercase">Parar</span>
              </button>
            )}

            <p className="text-xs text-slate-500 tracking-widest uppercase mt-2">
              {state === "listening" ? "Ouvindo sua pergunta..." :
                state === "processing" ? "Sr. Million está pensando..." :
                  state === "answering" ? "Respondendo em áudio..." :
                    "Toque para Falar ou Escolha uma Pergunta"}
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/30 transition-all text-sm text-slate-300 hover:text-cyan-300"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}