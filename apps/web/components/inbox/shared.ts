import {
  Megaphone, FileText, Trophy, Calendar, Lightbulb,
  ShieldCheck, BarChart3, Sparkles,
} from "lucide-react";
import type { MessageCategory } from "@/lib/types";

export const CATEGORY_META: Record<
  MessageCategory,
  { label: string; icon: typeof Megaphone; bgCls: string; iconCls: string }
> = {
  review: {
    label: "Revisiones",
    icon: ShieldCheck,
    bgCls: "bg-amber-500/10 border border-amber-500/30",
    iconCls: "text-amber-500",
  },
  report: {
    label: "Reportes",
    icon: BarChart3,
    bgCls: "bg-sky-500/10 border border-sky-500/30",
    iconCls: "text-sky-500",
  },
  achievement: {
    label: "Logros",
    icon: Trophy,
    bgCls: "bg-emerald-500/10 border border-emerald-500/30",
    iconCls: "text-emerald-500",
  },
  event: {
    label: "Eventos",
    icon: Calendar,
    bgCls: "bg-violet-500/10 border border-violet-500/30",
    iconCls: "text-violet-500",
  },
  tip: {
    label: "Consejos",
    icon: Lightbulb,
    bgCls: "bg-yellow-500/10 border border-yellow-500/30",
    iconCls: "text-yellow-500",
  },
  platform: {
    label: "Plataforma",
    icon: Megaphone,
    bgCls: "bg-primary/10 border border-primary/30",
    iconCls: "text-primary",
  },
};
