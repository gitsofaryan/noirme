"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const LiveMap = dynamic(() => import("@/components/Map/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-zinc-950">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
    </div>
  ),
});

export default function Home() {
  return (
    <div className="absolute inset-0">
      <LiveMap />
    </div>
  );
}
