"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MAX_STRIKES = 2;

export type ViolationType = "tab" | "fullscreen";

export interface StrikeWarning {
  type: ViolationType;
  strike: number;
  isFinal: boolean;
}

export function useExamGuard(enabled: boolean, onAutoSubmit: () => void) {
  const [strikes, setStrikes] = useState(0);
  const [warning, setWarning] = useState<StrikeWarning | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const strikesRef = useRef(0);
  const dedupeRef = useRef(false);
  const doneRef = useRef(false);
  // Only penalise after the user has actually entered fullscreen at least once
  const fullscreenEverRef = useRef(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  useEffect(() => { onAutoSubmitRef.current = onAutoSubmit; }, [onAutoSubmit]);

  const requestFullscreen = useCallback(() => {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  const issueStrike = useCallback((type: ViolationType) => {
    if (!enabled || doneRef.current || dedupeRef.current) return;
    // Dedupe: simultaneous fullscreenchange + visibilitychange counts as one event
    dedupeRef.current = true;
    setTimeout(() => { dedupeRef.current = false; }, 1500);

    strikesRef.current += 1;
    const strike = strikesRef.current;
    const isFinal = strike >= MAX_STRIKES;

    setStrikes(strike);
    setWarning({ type, strike, isFinal });

    if (isFinal) {
      doneRef.current = true;
      setTimeout(() => onAutoSubmitRef.current(), 2000);
    }
  }, [enabled]);

  // On enable: if already in fullscreen (entered via briefing button), mark it;
  // otherwise request it now.
  useEffect(() => {
    if (!enabled) return;
    const alreadyFs = !!(document.fullscreenElement ?? (document as any).webkitFullscreenElement);
    if (alreadyFs) {
      fullscreenEverRef.current = true;
      setIsFullscreen(true);
    } else {
      requestFullscreen();
    }
  }, [enabled, requestFullscreen]);

  // Track fullscreen state
  useEffect(() => {
    if (!enabled) return;
    const onChange = () => {
      const fs = !!(document.fullscreenElement ?? (document as any).webkitFullscreenElement);
      setIsFullscreen(fs);
      if (fs) {
        fullscreenEverRef.current = true;
      } else if (fullscreenEverRef.current) {
        issueStrike("fullscreen");
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [enabled, issueStrike]);

  // Track tab visibility
  useEffect(() => {
    if (!enabled) return;
    const onChange = () => { if (document.hidden) issueStrike("tab"); };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [enabled, issueStrike]);

  const dismissWarning = useCallback(() => {
    setWarning(null);
    requestFullscreen();
  }, [requestFullscreen]);

  return { strikes, warning, isFullscreen, dismissWarning, requestFullscreen };
}
