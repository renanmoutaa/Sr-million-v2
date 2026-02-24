import { motion } from "motion/react";

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Gerando visualização..." }: LoadingOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-8">
        <motion.img
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          src="/logo.png"
          alt="Milhão Ingredients"
          className="h-20 w-auto object-contain mb-4"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <div className="flex flex-col items-center gap-6">
          {/* Animated Loading Rings */}
          <div className="relative w-32 h-32">
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-cyan-500/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border-4 border-cyan-400/50 border-t-transparent"
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-4 rounded-full border-4 border-cyan-300/70 border-r-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Pulsing Center */}
            <motion.div
              className="absolute inset-8 rounded-full bg-cyan-500/30"
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          {/* Loading Text */}
          <div className="text-center">
            <motion.p
              className="text-cyan-400 text-lg font-medium tracking-wider"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {message}
            </motion.p>
            <motion.div
              className="flex gap-1 justify-center mt-3"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-cyan-400"
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* Status Messages */}
          <div className="text-center space-y-2 max-w-md">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="text-xs text-slate-400 tracking-wide"
            >
              Consultando a base de dados...
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4 }}
              className="text-xs text-slate-500 tracking-wide"
            >
              Formulando resposta inteligente...
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
