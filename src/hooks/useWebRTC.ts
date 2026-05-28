"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseWebRTCProps {
  myUserId: string;
  myUsername?: string;
  myAvatarUrl?: string;
  sendRtcOffer: (targetUserId: string, offer: any) => void;
  sendRtcAnswer: (targetUserId: string, answer: any) => void;
  sendRtcIceCandidate: (targetUserId: string, candidate: any) => void;
}

export interface SpeakRequest {
  user_id: string;
  username: string;
  avatar_url?: string;
}

export interface SpaceSpeaker {
  user_id: string;
  username: string;
  avatar_url?: string;
  isMuted: boolean;
}

export interface SpaceListener {
  user_id: string;
  username: string;
  avatar_url?: string;
}

export function useWebRTC({
  myUserId,
  myUsername = "Someone",
  myAvatarUrl,
  sendRtcOffer,
  sendRtcAnswer,
  sendRtcIceCandidate,
}: UseWebRTCProps) {
  const [isBroadcastingAudio, setIsBroadcastingAudio] = useState(false);
  const [isSpaceHost, setIsSpaceHost] = useState(false);
  const [incomingStreams, setIncomingStreams] = useState<Record<string, MediaStream>>({});
  
  // Space Management states
  const [speakRequests, setSpeakRequests] = useState<SpeakRequest[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<SpaceSpeaker[]>([]);
  const [activeListeners, setActiveListeners] = useState<SpaceListener[]>([]);
  const [mySpeakStatus, setMySpeakStatus] = useState<"listener" | "requesting" | "speaker">("listener");
  const [isMutedByHost, setIsMutedByHost] = useState(false);
  const [isLocalMicMuted, setIsLocalMicMuted] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  const handlePeerDisconnect = useCallback((targetUserId: string) => {
    const pc = peerConnectionsRef.current[targetUserId];
    if (pc) {
      pc.oniceconnectionstatechange = null;
      pc.close();
      delete peerConnectionsRef.current[targetUserId];
    }
    setIncomingStreams((prev) => {
      const copy = { ...prev };
      delete copy[targetUserId];
      return copy;
    });
    setActiveListeners((prev) => prev.filter((l) => l.user_id !== targetUserId));
    setActiveSpeakers((prev) => prev.filter((s) => s.user_id !== targetUserId));
    setSpeakRequests((prev) => prev.filter((r) => r.user_id !== targetUserId));
  }, []);

  const createPeerConnection = (targetUserId: string, isInitiator: boolean) => {
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
        handlePeerDisconnect(targetUserId);
      }
    };

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  };

  const startBroadcast = async (isHost = false) => {
    try {
      if (localStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsBroadcastingAudio(true);
      setIsLocalMicMuted(false);
      if (isHost) {
        setIsSpaceHost(true);
      }
    } catch (err) {
      console.error("[WebRTC] Failed to get local audio:", err);
      alert("Microphone permission denied or not available.");
      setMySpeakStatus("listener");
    }
  };

  const stopBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsBroadcastingAudio(false);
    setIsLocalMicMuted(false);
    setIsSpaceHost(false);
    
    Object.keys(peerConnectionsRef.current).forEach((targetUserId) => {
      const pc = peerConnectionsRef.current[targetUserId];
      if (pc) {
        pc.oniceconnectionstatechange = null;
        pc.close();
      }
      delete peerConnectionsRef.current[targetUserId];
    });

    setActiveSpeakers([]);
    setSpeakRequests([]);
    setActiveListeners([]);
  };

  const startListening = async (targetUserId: string) => {
    if (peerConnectionsRef.current[targetUserId]) return;
    
    const pc = createPeerConnection(targetUserId, true);
    pc.addTransceiver('audio', { direction: 'recvonly' });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendRtcOffer(targetUserId, {
        type: "webrtc_recv_offer",
        sdp: offer.sdp,
        username: myUsername,
        avatar_url: myAvatarUrl,
      });
    } catch (err) {
      console.error("[WebRTC] Failed to create receive offer:", err);
    }
  };

  const stopListening = (targetUserId: string) => {
    const pc = peerConnectionsRef.current[targetUserId];
    if (pc) {
      pc.oniceconnectionstatechange = null;
      pc.close();
      delete peerConnectionsRef.current[targetUserId];
    }
    setIncomingStreams((prev) => {
      const copy = { ...prev };
      delete copy[targetUserId];
      return copy;
    });
  };

  // Space Actions
  const requestToSpeak = (hostUserId: string) => {
    setMySpeakStatus("requesting");
    sendRtcOffer(hostUserId, {
      type: "speak_request",
      username: myUsername,
      avatar_url: myAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${myUsername}`,
    });
  };

  const cancelSpeakRequest = (hostUserId: string) => {
    setMySpeakStatus("listener");
    sendRtcOffer(hostUserId, { type: "speak_cancel" });
  };

  const approveSpeaker = (speakerUserId: string, username: string, avatarUrl?: string) => {
    setSpeakRequests((prev) => prev.filter((r) => r.user_id !== speakerUserId));
    setActiveListeners((prev) => prev.filter((l) => l.user_id !== speakerUserId));
    setActiveSpeakers((prev) => {
      if (prev.some((s) => s.user_id === speakerUserId)) return prev;
      return [...prev, { user_id: speakerUserId, username, avatar_url: avatarUrl, isMuted: false }];
    });
    sendRtcAnswer(speakerUserId, { type: "speak_approved" });
    startListening(speakerUserId);
  };

  const declineSpeaker = (speakerUserId: string) => {
    setSpeakRequests((prev) => prev.filter((r) => r.user_id !== speakerUserId));
    sendRtcAnswer(speakerUserId, { type: "speak_declined" });
  };

  const muteSpeaker = (speakerUserId: string) => {
    setActiveSpeakers((prev) =>
      prev.map((s) => (s.user_id === speakerUserId ? { ...s, isMuted: true } : s))
    );
    sendRtcOffer(speakerUserId, { type: "speak_mute" });
  };

  const unmuteSpeaker = (speakerUserId: string) => {
    setActiveSpeakers((prev) =>
      prev.map((s) => (s.user_id === speakerUserId ? { ...s, isMuted: false } : s))
    );
    sendRtcOffer(speakerUserId, { type: "speak_unmute" });
  };

  const removeSpeaker = (speakerUserId: string) => {
    const speaker = activeSpeakers.find((s) => s.user_id === speakerUserId);
    setActiveSpeakers((prev) => prev.filter((s) => s.user_id !== speakerUserId));
    stopListening(speakerUserId);
    sendRtcOffer(speakerUserId, { type: "speak_removed" });

    // Put them back in listeners
    if (speaker) {
      setActiveListeners((prev) => {
        if (prev.some((l) => l.user_id === speakerUserId)) return prev;
        return [...prev, {
          user_id: speakerUserId,
          username: speaker.username,
          avatar_url: speaker.avatar_url
        }];
      });
    }
  };

  const toggleLocalMic = () => {
    if (localStreamRef.current) {
      const newState = !isLocalMicMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newState;
      });
      setIsLocalMicMuted(newState);
    }
  };

  const leaveSpace = (hostUserId: string) => {
    setMySpeakStatus("listener");
    setIsMutedByHost(false);
    setIsLocalMicMuted(false);
    stopBroadcast();
    stopListening(hostUserId);
    activeSpeakers.forEach((s) => stopListening(s.user_id));
    setActiveSpeakers([]);
    setSpeakRequests([]);
    setActiveListeners([]);
    
    sendRtcOffer(hostUserId, { type: "space_listener_leave" });
  };

  // Signaling Handlers
  const handleRtcOffer = useCallback(async (msg: any) => {
    const { sender_id, offer } = msg;
    if (!offer) return;

    if (offer.type === "speak_request") {
      setSpeakRequests((prev) => {
        if (prev.some((r) => r.user_id === sender_id)) return prev;
        return [...prev, { user_id: sender_id, username: offer.username, avatar_url: offer.avatar_url }];
      });
      return;
    }

    if (offer.type === "speak_cancel") {
      setSpeakRequests((prev) => prev.filter((r) => r.user_id !== sender_id));
      return;
    }

    if (offer.type === "space_listener_leave") {
      handlePeerDisconnect(sender_id);
      return;
    }

    if (offer.type === "speak_mute") {
      setIsMutedByHost(true);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
      }
      return;
    }

    if (offer.type === "speak_unmute") {
      setIsMutedByHost(false);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
      }
      return;
    }

    if (offer.type === "speak_removed") {
      setMySpeakStatus("listener");
      stopBroadcast();
      return;
    }

    // Handle traditional listen request (receiving audio only setup)
    if (offer.type === "webrtc_recv_offer") {
      if (!isBroadcastingAudio || !localStreamRef.current) return;

      setActiveListeners((prev) => {
        if (prev.some((l) => l.user_id === sender_id)) return prev;
        return [...prev, {
          user_id: sender_id,
          username: offer.username || "Listener",
          avatar_url: offer.avatar_url
        }];
      });

      const pc = peerConnectionsRef.current[sender_id] || createPeerConnection(sender_id, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: "offer",
          sdp: offer.sdp,
        }));
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendRtcAnswer(sender_id, { type: "answer", sdp: answer.sdp });
      } catch (err) {
        console.error("[WebRTC] Error handling receive-only offer:", err);
      }
      return;
    }
  }, [isBroadcastingAudio, sendRtcAnswer, sendRtcOffer, handlePeerDisconnect]);

  const handleRtcAnswer = useCallback(async (msg: any) => {
    const { sender_id, answer } = msg;
    if (!answer) return;

    if (answer.type === "speak_approved") {
      setMySpeakStatus("speaker");
      setIsMutedByHost(false);
      startBroadcast(false);
      return;
    }

    if (answer.type === "speak_declined") {
      setMySpeakStatus("listener");
      return;
    }

    if (answer.type === "answer") {
      const pc = peerConnectionsRef.current[sender_id];
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: "answer",
          sdp: answer.sdp,
        }));
      } catch (err) {
        console.error("[WebRTC] Error handling call answer:", err);
      }
    }
  }, [isBroadcastingAudio]);

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

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnectionsRef.current).forEach(pc => {
        pc.oniceconnectionstatechange = null;
        pc.close();
      });
    };
  }, []);

  return {
    isBroadcastingAudio,
    isSpaceHost,
    startBroadcast,
    stopBroadcast,
    startListening,
    stopListening,
    incomingStreams,
    handleRtcOffer,
    handleRtcAnswer,
    handleRtcIceCandidate,
    
    // Space states & methods
    speakRequests,
    activeSpeakers,
    activeListeners,
    mySpeakStatus,
    isMutedByHost,
    isLocalMicMuted,
    requestToSpeak,
    cancelSpeakRequest,
    approveSpeaker,
    declineSpeaker,
    muteSpeaker,
    unmuteSpeaker,
    removeSpeaker,
    toggleLocalMic,
    leaveSpace,
  };
}
