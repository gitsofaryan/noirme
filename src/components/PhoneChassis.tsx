"use client";

import { useEffect, useState } from "react";
import { Wifi, Battery } from "lucide-react";

export default function PhoneChassis({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setTime(`${hours}:${minutes} ${ampm}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#090504] p-0 md:p-6 select-none font-sans">
      {/* Outer Phone Bezel Container - hidden borders on real mobile */}
      <div className="relative w-full h-screen md:h-[880px] md:max-w-[410px] md:rounded-[48px] md:border-[10px] md:border-[#2b1b16] md:shadow-[0_0_80px_rgba(0,0,0,0.8),inset_0_0_15px_rgba(0,0,0,0.6)] md:bg-[#120c0a] overflow-hidden flex flex-col">
        
        {/* Top Status Bar Mockup */}
        <div className="w-full h-11 px-6 flex items-center justify-between text-[11px] font-semibold text-[#f5efe6]/70 bg-gradient-to-b from-[#120c0a] to-[#120c0a]/90 relative z-[999] shrink-0">
          <div>{time || "06:31 PM"}</div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] tracking-widest text-[#f5efe6]/50">LTE</span>
            <Wifi size={13} className="text-[#f5efe6]/75" />
            <div className="flex items-center space-x-0.5">
              <Battery size={16} className="text-[#f5efe6]/75" />
            </div>
          </div>
        </div>

        {/* Dynamic App Content Screen */}
        <div className="flex-1 w-full relative overflow-hidden bg-[#120c0a]">
          {children}
        </div>
        
        {/* Soft Home Indicator Line for Modern iOS/Android Look */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-[#f5efe6]/25 z-[999] pointer-events-none hidden md:block" />
      </div>
    </div>
  );
}
