"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type EnvelopeAnimationProps = {
  senderName?: string;
  letterTitle?: string;
  isOpening?: boolean;
  onOpen?: () => void;
  ButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
};

export default function EnvelopeAnimation({
  senderName = "Pasangan",
  letterTitle = "",
  isOpening = false,
  onOpen,
}: EnvelopeAnimationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{
          repeat: Infinity,
          duration: 2.5,
          ease: "easeInOut",
        }}
        className="relative mb-8"
      >
        <motion.div
          animate={isOpening ? { rotateY: 180 } : { rotateY: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ perspective: 1000 }}
        >
          <div className="flex h-32 w-40 items-center justify-center rounded-t-3xl border-2 border-primary/30 bg-gradient-to-b from-primary/10 to-primary/5 shadow-lg" style={{ backfaceVisibility: "hidden" }}>
            <div className="absolute top-0 left-0 right-0 h-0">
              <div className="mx-auto h-5 w-32 -translate-y-4 rounded-t-3xl border-2 border-b-0 border-primary/30 bg-primary/10" />
            </div>
            <motion.span
              className="text-5xl"
              animate={{ rotate: [-5, 5, -5] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut",
              }}
            >
              💌
            </motion.span>
          </div>

          <div className="flex h-20 w-40 items-end justify-center rounded-b-3xl border-2 border-t-0 border-primary/20 bg-card" style={{ backfaceVisibility: "hidden" }}>
            <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>Surat Cinta</span>
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
          </div>
        </motion.div>

        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute -top-2 -right-2 text-sm"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              y: [0, -20 - i * 10],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              delay: i * 0.3,
              ease: "easeOut",
            }}
          >
            💖
          </motion.div>
        ))}
      </motion.div>

      <h2 className="font-heading text-2xl font-semibold">
        Surat Baru untukmu! 💕
      </h2>

      <p className="mt-2 text-muted-foreground">
        Dari <span className="font-medium text-foreground">{senderName}</span>
      </p>

      {letterTitle && (
        <p className="mt-1 text-sm italic text-muted-foreground">
          &ldquo;{letterTitle}&rdquo;
        </p>
      )}

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onOpen}
        disabled={isOpening}
        className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-pink-500 px-8 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:shadow-xl disabled:opacity-60"
      >
        {isOpening ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Membuka...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Buka Surat 💕
          </>
        )}
      </motion.button>
    </motion.div>
  );
}
