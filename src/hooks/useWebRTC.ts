"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseWebRTCProps {
  myUserId: string;
  sendRtcOffer: (targetUserId: string, offer: any) => void;
  sendRtcAnswer: (targetUserId: string, answer: any) => void;
  sendRtcIceCandidate: (targetUserId: string, candidate: any) => void;
}

export function useWebRTC({
  myUserId,
  sendRtcOffer,
  sendRtcAnswer,
  sendRtcIceCandidate,
}: UseWebRTCProps) {
  const [isBroadcastingAudio, setIsBroadcastingAudio] = useState(false);
  const [incomingStreams, setIncomingStreams] = useState<Record<string, MediaStream>>({});
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  const createPeerConnection = (targetUserId: string, isInitiator: boolean) => {
    // Basic STUN servers for NAT traversal
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcIceCandidate(targetUserId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      setIncomingStreams((prev) => ({
        ...prev,
        [targetUserId]: event.streams[0],
      }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        stopListening(targetUserId);
      }
    };

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  };

  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsBroadcastingAudio(true);
    } catch (err) {
      console.error("[WebRTC] Failed to get local audio:", err);
      alert("Microphone permission denied or not available.");
    }
  };

  const stopBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsBroadcastingAudio(false);
    
    // Close all peer connections that were created to broadcast to listeners
    Object.keys(peerConnectionsRef.current).forEach((targetUserId) => {
      peerConnectionsRef.current[targetUserId].close();
      delete peerConnectionsRef.current[targetUserId];
    });
  };

  // Listener requests to tune in
  const startListening = async (targetUserId: string) => {
    if (peerConnectionsRef.current[targetUserId]) {
      return; // already listening or connecting
    }
    
    const pc = createPeerConnection(targetUserId, true);
    // We are receiving audio only, add a transceiver
    pc.addTransceiver('audio', { direction: 'recvonly' });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendRtcOffer(targetUserId, offer);
    } catch (err) {
      console.error("[WebRTC] Failed to create offer:", err);
    }
  };

  const stopListening = (targetUserId: string) => {
    const pc = peerConnectionsRef.current[targetUserId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[targetUserId];
    }
    setIncomingStreams((prev) => {
      const copy = { ...prev };
      delete copy[targetUserId];
      return copy;
    });
  };

  // Signaling Handlers (called from MapProvider when socket receives messages)
  const handleRtcOffer = useCallback(async (msg: any) => {
    const { sender_id, offer } = msg;
    // We only accept offers if we are broadcasting
    if (!isBroadcastingAudio || !localStreamRef.current) return;

    const pc = peerConnectionsRef.current[sender_id] || createPeerConnection(sender_id, false);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Add local audio tracks to send to the listener
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendRtcAnswer(sender_id, answer);
    } catch (err) {
      console.error("[WebRTC] Error handling offer:", err);
    }
  }, [isBroadcastingAudio, sendRtcAnswer]);

  const handleRtcAnswer = useCallback(async (msg: any) => {
    const { sender_id, answer } = msg;
    const pc = peerConnectionsRef.current[sender_id];
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error("[WebRTC] Error handling answer:", err);
    }
  }, []);

  const handleRtcIceCandidate = useCallback(async (msg: any) => {
    const { sender_id, candidate } = msg;
    const pc = peerConnectionsRef.current[sender_id];
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("[WebRTC] Error adding ICE candidate:", err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    };
  }, []);

  return {
    isBroadcastingAudio,
    startBroadcast,
    stopBroadcast,
    startListening,
    stopListening,
    incomingStreams,
    handleRtcOffer,
    handleRtcAnswer,
    handleRtcIceCandidate,
  };
}
