import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function AudioVisualizer() {
  const [bars] = useState(Array.from({ length: 20 }, (_, i) => i));

  return (
    <div className="flex items-center justify-center gap-1 h-16">
      {bars.map((bar) => (
        <motion.div
          key={bar}
          className="w-1 bg-gradient-to-t from-red-500 to-red-300 rounded-full"
          animate={{
            height: ["20%", `${Math.random() * 60 + 40}%`, "20%"],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: bar * 0.05,
          }}
        />
      ))}
    </div>
  );
}
