"use client";

import dynamic from "next/dynamic";
import SpeederLoader from "@/components/SpeederLoader";

const LiveMap = dynamic(() => import("@/components/Map/LiveMap"), {
  ssr: false,
  loading: () => <SpeederLoader />,
});

export default function Home() {
  return (
    <div className="absolute inset-0">
      <LiveMap />
    </div>
  );
}
