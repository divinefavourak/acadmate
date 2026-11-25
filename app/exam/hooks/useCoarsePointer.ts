"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * True on touch-first devices (phones, most tablets). Exams use it to skip
 * fullscreen enforcement there: mobile browsers drop fullscreen on scroll or
 * when the keyboard opens, and can force rotation, which caused false strikes.
 *
 * The server can't know, so it renders as false (desktop) and hydration
 * corrects it before the exam starts.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** One-off check for event handlers, where a hook can't be used. */
export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}
