"use client";

import { Sparkles } from "lucide-react";

interface Props {
  status?: string;
  modelName?: string;
}

export function ModelStatusCard({
  status = "OPTIMIZED",
  modelName = "CLAUDE SONNET 4.6 ACTIVE",
}: Props) {
  return (
    <div className="flex h-full flex-col justify-between bg-zinc-950 p-6 text-white">
      <div>
        <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-400">
          MODEL STATUS
        </div>
        <div className="mt-6 font-sans text-5xl font-black italic uppercase leading-none tracking-tight">
          {status}
        </div>
      </div>
      <div className="mt-8 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-300">
        <Sparkles className="h-3 w-3" />
        {modelName}
      </div>
    </div>
  );
}
