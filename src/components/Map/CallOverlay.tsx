"use client";

import React from "react";
import { useMapContext } from "./MapProvider";

export function CallOverlay() {
  const {
    incomingStreams,
    isSpeakerMuted,
  } = useMapContext();

  return (
    <div style={{ display: "none" }}>
      {Object.entries(incomingStreams).map(([userId, stream]) => (
        <audio
          key={userId}
          autoPlay
          muted={isSpeakerMuted}
          ref={(audio) => {
            if (audio && audio.srcObject !== stream) {
              audio.srcObject = stream;
            }
          }}
        />
      ))}
    </div>
  );
}
