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
  const [isAvatarConnected, setIsAvatarConnected] = useState(false);
  const [simliError, setSimliError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [hasFinishedAudio, setHasFinishedAudio] = useState(false);

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

  // Simli initialization disabled as per user request to focus on audio
  /*
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

      const timer = setTimeout(() => {
        initSimli();
      }, 1000);
      return () => {
        clearTimeout(timer);
        if (simliClientRef.current) {
          try {
            simliClientRef.current.stop();
            simliClientRef.current = null;
          } catch (e) { }
        }
      };
    }
  }, []);
  */

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

      // Call ElevenLabs TTS (Using MP3 for direct playback)
      const audioResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}?output_format=mp3_44100_128&optimize_streaming_latency=3`, {
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

      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(e => console.error("Auto-play failed:", e));
      }

      setState("answering");
      setConversationContext(replyText);

      // Native audio onended event to properly clean up
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
          setError("Erro na reprodução de áudio. Verifique sua conexão.");
        };
      }

      const estimatedDuration = replyText.length * 0.1;
      let totalChars = 0;
      workflow?.steps.forEach((s: any) => totalChars += (s.spoken_text || s.description || "123").length);

      // Simulate audio progress for the UI cards
      // We don't use absolute duration anymore for stopping, only for progress
      const progressInterval = setInterval(() => {
        if (!audioRef.current || audioRef.current.paused) return;

        const currentTime = audioRef.current.currentTime;
        const totalDuration = audioRef.current.duration || estimatedDuration;

        if (!totalDuration || isNaN(totalDuration)) return;

        const percent = currentTime / totalDuration;

        let cumulativePercent = 0;
        let foundIndex = 0;

        if (workflow?.steps && workflow.steps.length > 0) {
          for (let i = 0; i < workflow.steps.length; i++) {
            const s = workflow.steps[i];
            const weight = (s.spoken_text || s.description || "123").length / (totalChars || 1);
            cumulativePercent += weight;

            if (percent <= cumulativePercent) {
              foundIndex = i;
              break;
            }
          }
          // Clamp to last index if we overshot (due to small floats/rounding)
          if (percent >= 0.99) foundIndex = workflow.steps.length - 1;
        }

        setCurrentStepIndex(foundIndex);
      }, 100);

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

  const handleTogglePause = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(e => console.error("Resume failed:", e));
    } else {
      audioRef.current.pause();
    }
  };

  const handleFinish = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if ((window as any)._audioProgressInterval) clearInterval((window as any)._audioProgressInterval);

    setState("idle");
    setActiveWorkflow(null);
    setCurrentStepIndex(0);
    setConversationContext("");
    setIsPaused(false);
  };

  const handleQuickAction = async (key: string) => {
    if (state !== "idle") return;

    unlockAudio();

    // Convert key to a natural question for our RAG backend
    let questionToProcess = "";
    if (key === "pop_marketing") questionToProcess = "Fluxo Marketing";
    else if (key === "pop_comercial") questionToProcess = "Fluxo Aplicação Técnica";
    else if (key === "pop_industria") questionToProcess = "Fluxo Setup de Empacotamento";
    else if (key === "pop_totem") questionToProcess = "Fluxo Prospecção de Negócios";

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
        <div className="flex flex-col gap-4">
          <motion.img
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            src="/logo.png"
            alt="Milhão Ingredients"
            className="h-12 w-auto object-contain self-start"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div>
            <h1 className="text-sm font-light tracking-[0.3em] text-cyan-500 uppercase opacity-80">
              Sistema Online
            </h1>
            <p className="text-xs text-slate-500 mt-1">v2.4.1 • Conectado</p>
          </div>
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

        {/* The Avatar Screen - HIDDEN */}
        <AnimatePresence>
          {state === "listening" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="relative mx-auto w-96 h-96 rounded-full overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_80px_rgba(8,145,178,0.2)] z-10 mt-16 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
            >
              <div className="absolute inset-0 rounded-full border-4 border-cyan-400 animate-ping opacity-20 pointer-events-none" />
              <div className="text-cyan-400 text-6xl opacity-30">🎙️</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Workflow Visualization Overlay - Centered */}
        <AnimatePresence>
          {state === "answering" && activeWorkflow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-x-0 top-[40%] -translate-y-1/2 flex justify-center items-center px-12 z-50"
            >
              <WorkflowVisualizer
                steps={currentSteps as any}
                className="w-full max-w-7xl"
                elaboratedBy={activeWorkflow.elaborated_by}
                approvedBy={activeWorkflow.approved_by}
              />
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
                label="Fluxo Marketing e Vendas"
                onClick={() => handleQuickAction("pop_marketing")}
              />
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Fluxo Aplicação Técnica"
                onClick={() => handleQuickAction("pop_comercial")}
              />
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Fluxo Setup de Empacotamento"
                onClick={() => handleQuickAction("pop_industria")}
              />
              <QuickActionButton
                icon={<ArrowRight className="w-4 h-4" />}
                label="Fluxo Prospecção de Negócios"
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
            ) : state === "answering" ? (
              <div className="flex items-center gap-6">
                <button
                  onClick={handleTogglePause}
                  className={cn(
                    "relative group flex items-center justify-center gap-3 px-6 py-3 rounded-full transition-all duration-300",
                    "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30 shadow-lg"
                  )}
                >
                  {isPaused ? (
                    <ArrowRight className="w-5 h-5 fill-current" />
                  ) : (
                    <div className="flex gap-1">
                      <div className="w-1.5 h-4 bg-cyan-400 rounded-full" />
                      <div className="w-1.5 h-4 bg-cyan-400 rounded-full" />
                    </div>
                  )}
                  <span className="font-bold tracking-widest uppercase text-xs">
                    {isPaused ? "Continuar" : "Pausar"}
                  </span>
                </button>

                <button
                  onClick={handleFinish}
                  className={cn(
                    "relative group flex items-center justify-center gap-3 px-6 py-3 rounded-full transition-all duration-300",
                    "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 shadow-lg"
                  )}
                >
                  <StopCircle className="w-5 h-5" />
                  <span className="font-bold tracking-widest uppercase text-xs">Encerrar</span>
                </button>
              </div>
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