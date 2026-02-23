import { motion } from "motion/react";

export function Sphere({ state }: { state: "idle" | "listening" | "processing" | "speaking" }) {
  // Variations for the sphere based on state
  const variants = {
    idle: {
      scale: [1, 1.05, 1],
      rotate: [0, 360],
      opacity: 0.8,
      transition: {
        scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
      },
    },
    listening: {
      scale: [1, 1.2, 1],
      opacity: 1,
      transition: {
        scale: { duration: 1, repeat: Infinity, ease: "easeInOut" },
      },
    },
    processing: {
      scale: [0.9, 1.1, 0.9],
      rotate: [0, -360],
      transition: {
        scale: { duration: 0.5, repeat: Infinity },
        rotate: { duration: 2, repeat: Infinity, ease: "linear" },
      },
    },
    speaking: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="relative flex items-center justify-center w-64 h-64 md:w-96 md:h-96">
      {/* Core Sphere */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-900/20 to-black backdrop-blur-sm"
        animate={state}
        variants={variants}
        style={{ 
          boxShadow: state === "listening" 
            ? "0 0 60px rgba(239, 68, 68, 0.4), inset 0 0 40px rgba(239, 68, 68, 0.2)" 
            : state === "processing"
            ? "0 0 60px rgba(234, 179, 8, 0.4), inset 0 0 40px rgba(234, 179, 8, 0.2)"
            : state === "speaking"
            ? "0 0 60px rgba(34, 211, 238, 0.5), inset 0 0 40px rgba(34, 211, 238, 0.3)"
            : "0 0 40px rgba(8, 145, 178, 0.2), inset 0 0 20px rgba(8, 145, 178, 0.1)"
        }}
      />
      
      {/* Inner Rings - Arrival Style "Ink" feel using irregular rotation */}
      <motion.div
        className={`absolute w-[80%] h-[80%] rounded-full border ${
          state === "listening" ? "border-red-400/30" :
          state === "processing" ? "border-yellow-400/30" :
          "border-cyan-400/20"
        }`}
        animate={{ rotate: [0, 360], scale: [0.9, 1, 0.9] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className={`absolute w-[60%] h-[60%] rounded-full border-t-2 border-r-2 ${
          state === "listening" ? "border-red-300/50" :
          state === "processing" ? "border-yellow-300/50" :
          "border-cyan-300/40"
        }`}
        animate={{ rotate: [360, 0], scale: [1, 0.9, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className={`absolute w-[40%] h-[40%] rounded-full border-b-4 border-l-2 ${
          state === "listening" ? "border-red-200/40 bg-red-500/10" :
          state === "processing" ? "border-yellow-200/40 bg-yellow-500/10" :
          "border-white/10 bg-cyan-500/5"
        }`}
        animate={{ rotate: [0, 180, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Particles/Mist Effect */}
      <motion.div
        className={`absolute w-full h-full rounded-full bg-radial-[circle_at_center,_var(--tw-gradient-stops)] blur-xl ${
          state === "listening" ? "from-red-500/30 via-transparent to-transparent" :
          state === "processing" ? "from-yellow-500/30 via-transparent to-transparent" :
          state === "speaking" ? "from-cyan-500/30 via-transparent to-transparent" :
          "from-cyan-500/20 via-transparent to-transparent"
        }`}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Additional energy rings for active states */}
      {(state === "listening" || state === "processing" || state === "speaking") && (
        <>
          <motion.div
            className={`absolute inset-0 rounded-full border-2 ${
              state === "listening" ? "border-red-500/20" :
              state === "processing" ? "border-yellow-500/20" :
              "border-cyan-500/20"
            }`}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className={`absolute inset-0 rounded-full border-2 ${
              state === "listening" ? "border-red-500/20" :
              state === "processing" ? "border-yellow-500/20" :
              "border-cyan-500/20"
            }`}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 2, delay: 1, repeat: Infinity }}
          />
        </>
      )}
    </div>
  );
}