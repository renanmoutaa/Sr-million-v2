import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, StopCircle, ArrowRight, MapPin, HelpCircle, Accessibility } from "lucide-react";
import { WorkflowVisualizer, WorkflowStep } from "../components/totem/WorkflowVisualizer";
import { LoadingOverlay } from "../components/totem/LoadingOverlay";
import { AudioVisualizer } from "../components/totem/AudioVisualizer";
import { cn } from "../../lib/utils";
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
const elevenLabsApiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY;
const elevenLabsVoiceId = (import.meta as any).env.VITE_ELEVENLABS_VOICE_ID;

type ConversationState = "idle" | "listening" | "processing" | "answering";

interface Workflow {
  id: string;
  title: string;
  steps: WorkflowStep[];
  elaborated_by?: string;
  approved_by?: string;
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
  const [useNativeVoice, setUseNativeVoice] = useState(false); // Default: ElevenLabs (Premium) ativado
  const [isPaused, setIsPaused] = useState(false);
  const [hasFinishedAudio, setHasFinishedAudio] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishingTimeoutRef = useRef<number | null>(null);

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

  const unlockAudio = async () => {
    if (audioRef.current) {
      // Small silent 8kHz WAV to bless the audio element's execution context
      audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
      }).catch(() => { });
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
    if (finishingTimeoutRef.current) {
      clearTimeout(finishingTimeoutRef.current);
      finishingTimeoutRef.current = null;
    }

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erro ao processar roteiro com a IA.");
      }

      const data = await response.json();
      const replyText = data.reply;
      const workflow = data.workflow;

      if (workflow) {
        setActiveWorkflow(workflow);
        setCurrentStepIndex(0);
      }

      setConversationContext(replyText);
      setIsGeneratingImages(false);

      setState("answering");
      setConversationContext(replyText);

      // --- LOGIC: Premium Voice (ElevenLabs) vs Native Voice (Tests) ---
      if (useNativeVoice) {
        // Zera latência e custo usando o TTS nativo do navegador
        const utterance = new SpeechSynthesisUtterance(replyText);
        utterance.lang = "pt-BR";
        utterance.rate = 1.1; // Ligeiramente mais rápido para simular o ElevenLabs nativo

        utterance.onend = () => {
          console.log("Native TTS finished.");
          handleFinish();
        };

        utterance.onerror = (e) => {
          console.error("Native TTS error:", e);
          handleFinish();
        };

        window.speechSynthesis.speak(utterance);
        setIsPaused(false);
      } else {
        // Otimização Máxima Premium: Streaming Nativo do Áudio via Supabase!
        const audioUrl = `${supabaseUrl}/functions/v1/chat?action=tts&text=${encodeURIComponent(replyText)}`;

        if (audioRef.current && audioUrl) {
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
        }

        // Native audio events
        if (audioRef.current) {
          audioRef.current.onended = () => {
            console.log("Audio finished naturally.");
            handleFinish();
          };
          audioRef.current.onplay = () => {
            setIsPaused(false);
            console.log("Audio playing...");
          };
          audioRef.current.onpause = () => {
            setIsPaused(true);
            console.log("Audio paused.");
          };
          audioRef.current.onerror = (e) => {
            console.error("Audio error event:", e);
            setError("Erro na reprodução de áudio da ElevenLabs. Verifique sua conexão.");
          };
        }
      }

      const estimatedDuration = replyText.length * 0.1;
      let totalChars = 0;
      workflow?.steps.forEach((s: any) => totalChars += (s.spoken_text || s.description || "123").length);

      const startTime = Date.now();

      // Simulate audio progress for the UI cards
      const progressInterval = setInterval(() => {
        let currentTime = 0;
        let totalDuration = 0;

        if (useNativeVoice) {
          // Avaliação aproximada baseada no tempo para voz nativa (já que não há .currentTime)
          currentTime = (Date.now() - startTime) / 1000;
          totalDuration = estimatedDuration;

          // Evita que os cards fiquem loucos se pausarmos
          if (window.speechSynthesis.paused) return;
        } else {
          if (!audioRef.current || audioRef.current.paused) return;
          currentTime = audioRef.current.currentTime;
          totalDuration = audioRef.current.duration || estimatedDuration;
        }

        if (!totalDuration || isNaN(totalDuration)) return;

        const percent = currentTime / totalDuration;

        let cumulativePercent = 0;
        let foundIndex = 0;

        if (workflow?.steps && workflow.steps.length > 0) {
          // Precisão Extrema: Usamos o peso real do texto falado de cada passo
          const stepWeights = workflow.steps.map((s: any) => (s.spoken_text || s.description || " ").length);
          const totalWeight = stepWeights.reduce((a: number, b: number) => a + b, 0);

          for (let i = 0; i < workflow.steps.length; i++) {
            const weight = stepWeights[i] / totalWeight;
            cumulativePercent += weight;

            if (percent <= cumulativePercent) {
              foundIndex = i;
              break;
            }
          }
          // Clamp to last index if we overshot
          if (percent >= 0.99) foundIndex = workflow.steps.length - 1;
        }

        setCurrentStepIndex(foundIndex);
      }, 50); // Maior frequência de atualização (50ms) para fluidez

      (window as any)._audioProgressInterval = progressInterval;

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
    if (finishingTimeoutRef.current) {
      clearTimeout(finishingTimeoutRef.current);
      finishingTimeoutRef.current = null;
    }

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

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Clear simulated timeouts
    if ((window as any)._audioProgressInterval) clearInterval((window as any)._audioProgressInterval);
    if ((window as any)._audioEndTimeout) clearTimeout((window as any)._audioEndTimeout);
    if (finishingTimeoutRef.current) {
      clearTimeout(finishingTimeoutRef.current);
      finishingTimeoutRef.current = null;
    }

    setState("idle");
    setActiveWorkflow(null);
    setCurrentStepIndex(0);
    setConversationContext("");
    setTranscript("");
    setError("");
    setIsGeneratingImages(false);
  };

  const handleTogglePause = () => {
    if (useNativeVoice) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      if (!audioRef.current) return;
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => setIsPaused(false)).catch(e => console.error("Resume failed:", e));
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const handleFinish = (immediate = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if ((window as any)._audioProgressInterval) clearInterval((window as any)._audioProgressInterval);
    if (finishingTimeoutRef.current) {
      clearTimeout(finishingTimeoutRef.current);
      finishingTimeoutRef.current = null;
    }

    const resetStates = () => {
      setState("idle");
      setActiveWorkflow(null);
      setCurrentStepIndex(0);
      setConversationContext("");
      setIsPaused(false);
      finishingTimeoutRef.current = null;
    };

    if (immediate) {
      resetStates();
    } else {
      // Delay de 3 segundos antes de limpar o workflow e disparar a animação de saída
      finishingTimeoutRef.current = window.setTimeout(resetStates, 3000);
    }
  };

  const handleQuickAction = async (key: string) => {
    if (state !== "idle") return;

    unlockAudio();

    // Convert key to a natural question for our RAG backend
    let questionToProcess = "";
    if (key === "Fluxo de Marketing" || key === "pop_marketing") questionToProcess = "Fluxo de Marketing";
    else if (key === "pop_comercial") questionToProcess = "Fluxo Aplicação Técnica";
    else if (key === "pop_industria") questionToProcess = "Fluxo Setup de Empacotamento";
    else if (key === "pop_totem") questionToProcess = "Fluxo Prospecção de Negócios";
    else questionToProcess = key; // Fallback to key itself if no mapping found

    await handleProcessTranscript(questionToProcess);
  };

  // Compute steps with current status
  const currentSteps = activeWorkflow?.steps.map((step, index) => ({
    ...step,
    status: index < currentStepIndex ? "completed" : index === currentStepIndex ? "current" : "pending",
  })) as WorkflowStep[] | undefined;

  return (
    <div className="h-screen w-screen bg-black text-white font-sans overflow-hidden flex flex-col items-center relative p-8">
      {/* Background stays absolute */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-slate-900 via-black to-black -z-20" />
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-cyan-900/10 to-transparent -z-10" />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isGeneratingImages && (
          <LoadingOverlay message="Sr. Million está pensando..." />
        )}
      </AnimatePresence>

      {/* 1. Header Section */}
      <header className="w-full flex justify-between items-start z-20 mb-4 h-20 flex-shrink-0">
        <div className="flex flex-col gap-2">
          <motion.img
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            src="/logo.png"
            alt="Milhão Ingredients"
            className="h-10 w-auto object-contain self-start"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div>
            <h1 className="text-[10px] font-light tracking-[0.3em] text-cyan-500 uppercase opacity-80">
              Sistema Online
            </h1>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowA11yMenu(!showA11yMenu)}
            className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/50 transition-all text-cyan-400"
          >
            <Accessibility className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showA11yMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute right-0 mt-4 w-48 bg-cyan-950/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-2xl flex flex-col gap-3 z-50"
              >
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider border-b border-cyan-500/20 pb-2 mb-1">Acessibilidade</h3>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm text-slate-300">Legendas</span>
                  <div className={cn("w-10 h-5 rounded-full transition-colors relative", showSubtitles ? "bg-cyan-500" : "bg-slate-700")}>
                    <div className={cn("absolute top-0.5 bottom-0.5 w-4 rounded-full bg-white transition-all shadow-sm", showSubtitles ? "right-0.5" : "left-0.5")} />
                  </div>
                  <input type="checkbox" className="hidden" checked={showSubtitles} onChange={() => setShowSubtitles(!showSubtitles)} />
                </label>
                <label className="flex items-center justify-between cursor-pointer group mt-2">
                  <span className="text-sm text-slate-300">Voz Teste</span>
                  <div className={cn("w-10 h-5 rounded-full transition-colors relative", useNativeVoice ? "bg-cyan-500" : "bg-slate-700")}>
                    <div className={cn("absolute top-0.5 bottom-0.5 w-4 rounded-full bg-white transition-all shadow-sm", useNativeVoice ? "right-0.5" : "left-0.5")} />
                  </div>
                  <input type="checkbox" className="hidden" checked={useNativeVoice} onChange={() => setUseNativeVoice(!useNativeVoice)} />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* 2. Content Area (Flex-grow to take available space) */}
      <main className="w-full flex-1 flex flex-col items-center justify-center relative z-10 overflow-hidden px-4">

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 z-30"
            >
              <div className="bg-red-500/20 border border-red-500/50 px-4 py-2 rounded-lg backdrop-blur-md">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Display (Cards or Avatar or Subtitles) */}
        <div className="w-full flex-1 flex flex-col items-center justify-center gap-8 min-h-0">

          <AnimatePresence mode="wait">
            {state === "listening" ? (
              <motion.div
                key="listening-view"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-8"
              >
                <div className="relative w-64 h-64 rounded-full overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_80px_rgba(8,145,178,0.2)] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-400 animate-ping opacity-20" />
                  <div className="text-cyan-400 text-6xl">🎙️</div>
                </div>
                <div className="bg-black/40 backdrop-blur-md px-8 py-4 rounded-2xl border border-red-500/30">
                  <AudioVisualizer />
                </div>
              </motion.div>
            ) : activeWorkflow && state === "answering" ? (
              <motion.div
                key="workflow-view"
                initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  scale: 1.1,
                  y: -50,
                  filter: "blur(20px)",
                  transition: { duration: 0.8, ease: "circIn" }
                }}
                className="w-full h-full flex flex-col items-center justify-center gap-2"
              >
                <div className="flex-1 w-full min-h-0 flex items-center justify-center">
                  <WorkflowVisualizer
                    steps={currentSteps as any}
                    className="w-full max-w-7xl scale-90 sm:scale-95 md:scale-100 transition-transform"
                    elaboratedBy={activeWorkflow.elaborated_by}
                    approvedBy={activeWorkflow.approved_by}
                  />
                </div>

                {/* Subtitles Integrated in Layout */}
                {showSubtitles && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-3xl bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-2xl flex-shrink-0 mb-2"
                  >
                    <span className="text-[9px] text-cyan-400 uppercase tracking-widest font-bold block mb-0.5 opacity-70">
                      Narrando: Passo {currentStepIndex + 1}
                    </span>
                    <p className="text-base text-slate-100 font-medium leading-relaxed text-center line-clamp-2">
                      {activeWorkflow.steps[currentStepIndex]?.spoken_text || activeWorkflow.steps[currentStepIndex]?.description}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center text-center max-w-xl"
              >
                <h2 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
                  Olá, eu sou o Sr. Million
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Estou pronto para ajudar você com informações técnicas e procedimentos corporativos da Milhão Ingredients.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* 3. Interaction Zone (Bottom Bar) */}
      <footer className="w-full flex-shrink-0 flex flex-col items-center gap-6 pt-4 pb-2 z-20">

        {/* Quick Actions */}
        {state === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap justify-center gap-3 px-4"
          >
            <QuickActionButton icon={<ArrowRight className="w-4 h-4" />} label="Fluxo de Marketing" onClick={() => handleQuickAction("Fluxo de Marketing")} />
            <QuickActionButton icon={<ArrowRight className="w-4 h-4" />} label="Aplicação Técnica" onClick={() => handleQuickAction("pop_comercial")} />
            <QuickActionButton icon={<ArrowRight className="w-4 h-4" />} label="Setup Indústria" onClick={() => handleQuickAction("pop_industria")} />
            <QuickActionButton icon={<ArrowRight className="w-4 h-4" />} label="Prospecção" onClick={() => handleQuickAction("pop_totem")} />
          </motion.div>
        )}

        {/* Main Controls */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            {state === "idle" ? (
              <button
                onClick={handleStartListening}
                className="relative group flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:scale-110 shadow-lg transition-all"
              >
                <div className="absolute inset-0 rounded-full border border-current opacity-30 scale-110 group-hover:scale-125 transition-transform" />
                <Mic className="w-7 h-7" />
              </button>
            ) : state === "answering" ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleTogglePause}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all"
                >
                  {isPaused ? <ArrowRight className="w-4 h-4" /> : <div className="flex gap-1"><div className="w-1.5 h-3.5 bg-cyan-400 rounded-full" /><div className="w-1.5 h-3.5 bg-cyan-400 rounded-full" /></div>}
                  <span className="font-bold uppercase text-[10px] tracking-widest">{isPaused ? "Continuar" : "Pausar"}</span>
                </button>
                <button
                  onClick={() => handleFinish(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
                >
                  <StopCircle className="w-4 h-4" />
                  <span className="font-bold uppercase text-[10px] tracking-widest">Encerrar</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleStop}
                className="flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              >
                <StopCircle className="w-5 h-5" />
                <span className="font-bold uppercase text-xs tracking-widest">Parar</span>
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-500 tracking-[0.2em] uppercase">
            {state === "listening" ? "Sintonizando sua voz..." :
              state === "processing" ? "Sr. Million em processamento..." :
                state === "answering" ? "Módulo de síntese de voz ativo" :
                  "Inicie um Protocolo de Voz ou Toque em uma POP"}
          </p>
        </div>
      </footer>
      <audio ref={audioRef} className="hidden" />
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