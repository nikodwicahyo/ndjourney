"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ImagePlus, PenLine, Plus, Gamepad2, Gift } from "lucide-react";

const actions = [
  {
    href: "/dashboard/gallery",
    label: "Kelola Foto",
    icon: ImagePlus,
    color: "#6366F1",
    bgColor: "#6366F120",
  },
  {
    href: "/dashboard/letters/new",
    label: "Tulis Surat",
    icon: PenLine,
    color: "#EC4899",
    bgColor: "#EC489920",
  },
  {
    href: "/dashboard/timeline",
    label: "Kelola Timeline",
    icon: Plus,
    color: "#F97316",
    bgColor: "#F9731620",
  },
  {
    href: "/dashboard/games",
    label: "Kelola Games",
    icon: Gamepad2,
    color: "#22C55E",
    bgColor: "#22C55E20",
  },
  {
    href: "/dashboard/wishlist",
    label: "Kelola Wish List",
    icon: Gift,
    color: "#EAB308",
    bgColor: "#EAB30820",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map(({ href, label, icon: Icon, color, bgColor }, i) => (
        <motion.div
          key={href}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
        >
          <Link
            href={href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: bgColor }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <span className="text-sm font-medium">{label}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
