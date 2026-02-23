import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "../../../lib/utils";

export type WorkflowStep = {
  id: string;
  label: string;
  description: string;
  status: "pending" | "current" | "completed";
  imageUrl?: string | null;
};

interface WorkflowVisualizerProps {
  steps: WorkflowStep[];
  className?: string;
}

export function WorkflowVisualizer({ steps, className }: WorkflowVisualizerProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className={cn("w-full max-w-5xl mx-auto p-6", className)}>
      <motion.h3
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-cyan-400 text-sm uppercase tracking-[0.3em] font-semibold mb-8 text-center"
      >
        Protocolo de Execução
      </motion.h3>

      <div className="relative flex flex-wrap justify-center gap-x-4 gap-y-12 w-full max-w-5xl mx-auto pb-8 pt-4 px-4">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                delay: index * 0.15,
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              className="relative flex-none w-[calc(50%-1rem)] sm:w-[calc(33%-1rem)] md:w-[calc(25%-1rem)] max-w-[170px]"
            >
              {/* Connection Line to Next Step */}
              {index < steps.length - 1 && index % 4 !== 3 && (
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{
                    scaleX: step.status === "completed" ? 1 : 0.3,
                    opacity: step.status === "completed" ? 1 : 0.3
                  }}
                  transition={{ duration: 0.5, delay: index * 0.15 + 0.3 }}
                  className="absolute left-full top-1/2 w-4 md:w-6 h-0.5 origin-left z-0"
                  style={{
                    background: step.status === "completed"
                      ? "linear-gradient(90deg, rgba(34,211,238,0.8) 0%, rgba(34,211,238,0.3) 100%)"
                      : "rgba(100,116,139,0.3)"
                  }}
                >
                  {/* Animated flow particles */}
                  {step.status === "completed" && (
                    <>
                      <motion.div
                        className="absolute top-1/2 left-0 w-1 h-1 rounded-full bg-cyan-400"
                        animate={{
                          x: ["0%", "400%"],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                      <motion.div
                        className="absolute top-1/2 left-0 w-1 h-1 rounded-full bg-cyan-300"
                        animate={{
                          x: ["0%", "400%"],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          delay: 0.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    </>
                  )}
                </motion.div>
              )}

              {/* Step Card */}
              <motion.div
                className={cn(
                  "relative w-full rounded-xl overflow-hidden transition-all duration-500",
                  "backdrop-blur-md border-2",
                  step.status === "current"
                    ? "bg-cyan-500/20 border-cyan-500/60 shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                    : step.status === "completed"
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-black/40 border-white/10 opacity-60"
                )}
                animate={{
                  scale: step.status === "current" ? 1.05 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {/* Image Container */}
                <div className="relative w-full h-20 md:h-28 bg-gradient-to-b from-cyan-950/50 to-black overflow-hidden">
                  {step.imageUrl ? (
                    <motion.img
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      src={step.imageUrl}
                      alt={step.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full"
                      />
                    </div>
                  )}

                  {/* Status Icon Overlay */}
                  <div className="absolute top-2 right-2">
                    {step.status === "completed" ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                      >
                        <CheckCircle2 className="w-6 h-6 text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                      </motion.div>
                    ) : step.status === "current" ? (
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Circle className="w-6 h-6 text-cyan-400 fill-cyan-400/30 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      </motion.div>
                    ) : (
                      <Circle className="w-6 h-6 text-gray-600" />
                    )}
                  </div>

                  {/* Pulsing glow for current step */}
                  {step.status === "current" && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Text Content */}
                <div className="p-4">
                  <h4 className={cn(
                    "font-semibold text-sm mb-2 transition-colors",
                    step.status === "current" ? "text-cyan-100" :
                      step.status === "completed" ? "text-green-100" :
                        "text-gray-400"
                  )}>
                    {step.label}
                  </h4>

                  <AnimatePresence mode="wait">
                    {step.status === "current" && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-cyan-200/80 leading-relaxed"
                      >
                        {step.description}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Step Number Badge */}
                <div className={cn(
                  "absolute bottom-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  step.status === "current" ? "bg-cyan-500 text-black" :
                    step.status === "completed" ? "bg-green-500 text-black" :
                      "bg-gray-700 text-gray-400"
                )}>
                  {index + 1}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
