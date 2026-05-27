"use client";

import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("@/components/Map/LiveMap"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="absolute inset-0">
      <LiveMap />
    </div>
  );
}
