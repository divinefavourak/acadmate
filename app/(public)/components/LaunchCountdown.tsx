"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// One shared clock that ticks once a second while anything is subscribed.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
// Whole seconds, so the snapshot only changes once per tick.
const getNow = () => Math.floor(Date.now() / 1000);
// The server can't know the visitor's clock: render placeholders, then the
// real numbers right after hydration. Avoids a hydration mismatch.
const getServerNow = () => null;

const UNITS = [
  { label: "Days", seconds: 86_400 },
  { label: "Hours", seconds: 3_600 },
  { label: "Minutes", seconds: 60 },
  { label: "Seconds", seconds: 1 },
] as const;

const FLIP_MS = 300;

/** Days / hours / minutes / seconds until `target` (an ISO string, so it can cross the server/client boundary). */
export function LaunchCountdown({ target }: { target: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  const end = Math.floor(new Date(target).getTime() / 1000);
  const left = now === null ? null : Math.max(0, end - now);
  const ticker = useTicker();

  // A tick per second, in step with the flip. `left` is in the deps so the
  // tick stops once the countdown reaches zero.
  const { enabled, play } = ticker;
  useEffect(() => {
    if (enabled && left) play(left % 2 === 0);
  }, [now, left, enabled, play]);

  if (left === 0) {
    return (
      <p className="text-xl font-semibold text-[#34d29b]" role="status">
        We&apos;re switching over now. Refresh in a minute.
      </p>
    );
  }

  // Each unit is what's left after the bigger units: the remainder modulo the
  // next unit up, divided by this unit's size. Days aren't capped.
  const total = left ?? 0;
  const parts = UNITS.map((u, i) => {
    const within = i === 0 ? total : total % UNITS[i - 1].seconds;
    return { label: u.label, value: Math.floor(within / u.seconds) };
  });

  return (
    <div>
      {/* The visible digits change every second, so screen readers get one stable sentence instead. */}
      <p className="sr-only">
        {left === null ? "Countdown to launch" : `${parts[0].value} days and ${parts[1].value} hours to launch`}
      </p>
      <ol aria-hidden className="mx-auto flex max-w-2xl justify-center gap-3 sm:gap-7">
        {parts.map((p) => (
          <li key={p.label} className="flex flex-col items-center">
            <FlipCard value={left === null ? "--" : String(p.value).padStart(2, "0")} />
            <span className="mt-4 text-[9px] font-semibold uppercase tracking-[0.3em] text-[#7d93ad] sm:mt-6 sm:text-xs">
              {p.label}
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={ticker.toggle}
        aria-label={enabled ? "Mute the ticking" : ticker.waiting ? "Turn on the ticking sound" : "Unmute the ticking"}
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-[#7d93ad] transition-colors hover:border-[#4fadf9]/50 hover:text-white"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          {enabled ? (
            <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
          ) : (
            <path d="m22 9-6 6M16 9l6 6" />
          )}
        </svg>
        {enabled ? "Mute" : ticker.waiting ? "Tap for sound" : "Sound off"}
      </button>
    </div>
  );
}

// The visitor's mute choice, kept in localStorage so it survives a reload.
// Sound is on unless they've muted it.
const MUTE_KEY = "acm-countdown-muted";
const muteListeners = new Set<() => void>();
function subscribeMute(onChange: () => void) {
  muteListeners.add(onChange);
  return () => void muteListeners.delete(onChange);
}
function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false; // storage blocked (some private modes): treat as not muted
  }
}
function writeMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // Storage blocked: the choice still holds until the page is closed.
  }
  muteListeners.forEach((l) => l());
}

const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

/**
 * The clock's tick, synthesised with Web Audio rather than shipped as a file:
 * 30 ms of fading noise through a band-pass filter, higher for "tick", lower
 * for "tock".
 *
 * Sound is on by default and starts as soon as the browser allows. Browsers
 * block audio until the visitor interacts with the page (Chrome lets it play
 * straight away for people who've used the site before). So the AudioContext
 * is created on load, resumed right away in case that's allowed, and otherwise
 * resumed on the first tap, click or key press anywhere on the page.
 */
function useTicker() {
  const muted = useSyncExternalStore(subscribeMute, readMuted, () => false);
  const [running, setRunning] = useState(false);
  const audio = useRef<{ ctx: AudioContext; burst: AudioBuffer } | null>(null);

  useEffect(() => {
    const ctx = new AudioContext();
    const len = Math.floor(ctx.sampleRate * 0.03);
    const burst = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = burst.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
    audio.current = { ctx, burst };

    const unlock = () => void ctx.resume();
    const sync = () => {
      setRunning(ctx.state === "running");
      if (ctx.state === "running") UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock));
    };
    ctx.addEventListener("statechange", sync);
    UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock));
    unlock(); // works now if the browser already allows sound here
    return () => {
      UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock));
      ctx.removeEventListener("statechange", sync);
      void ctx.close();
      audio.current = null;
    };
  }, []);

  const [play] = useState(() => (tick: boolean) => {
    const a = audio.current;
    if (!a || a.ctx.state !== "running") return;
    const src = a.ctx.createBufferSource();
    src.buffer = a.burst;
    const band = a.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = tick ? 3200 : 2300;
    band.Q.value = 3;
    const gain = a.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(band).connect(gain).connect(a.ctx.destination);
    src.start();
  });

  // While the browser still holds the sound back, a click on the button only
  // unlocks it (the window listener does that); it doesn't also mute.
  function toggle() {
    if (running) writeMuted(!muted);
    else if (muted) writeMuted(false);
  }

  return { enabled: !muted && running, waiting: !muted && !running, toggle, play };
}

/**
 * A split-flap card. Four layers: the static top half (new value), the static
 * bottom half (old value), a top flap (old value) that folds down out of view,
 * then a bottom flap (new value) that folds down over the old bottom half.
 * The flaps are keyed by value, so each change remounts them and the CSS
 * animations replay. With reduced motion the top flap is hidden and the bottom
 * flap sits flat, so the card just swaps digits.
 */
function FlipCard({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== shown) {
    setPrev(shown);
    setShown(value);
  }

  return (
    <div className="relative h-[68px] w-[68px] rounded-md shadow-[0_6px_0_1px_#050b14] [perspective:400px] sm:h-[140px] sm:w-[148px] sm:rounded-lg sm:shadow-[0_8px_0_1px_#050b14]">
      <Half side="top" text={shown} />
      <Half side="bottom" text={prev} />
      <Half
        key={`t-${shown}`}
        side="top"
        text={prev}
        className="z-10 origin-bottom [backface-visibility:hidden] motion-reduce:hidden"
        style={{ animation: `acm-flip-top ${FLIP_MS}ms ease-in forwards` }}
      />
      <Half
        key={`b-${shown}`}
        side="bottom"
        text={shown}
        className="z-10 origin-top [backface-visibility:hidden] motion-reduce:animate-none!"
        style={{ animation: `acm-flip-bottom ${FLIP_MS}ms ease-out ${FLIP_MS}ms both` }}
      />
      {/* The hinge: a dark seam with a half-round notch on each edge. */}
      <span className="absolute inset-x-0 top-1/2 z-20 h-px -translate-y-1/2 bg-[#050b14]/70" />
      <span className="absolute top-1/2 left-0 z-20 h-2 w-1 -translate-y-1/2 rounded-r-full bg-[#050b14] sm:h-3 sm:w-1.5" />
      <span className="absolute top-1/2 right-0 z-20 h-2 w-1 -translate-y-1/2 rounded-l-full bg-[#050b14] sm:h-3 sm:w-1.5" />
    </div>
  );
}

function Half({
  side,
  text,
  className = "",
  style,
}: {
  side: "top" | "bottom";
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const top = side === "top";
  return (
    <div
      className={`absolute inset-x-0 h-1/2 overflow-hidden ${
        top ? "top-0 rounded-t-[inherit] bg-[#0f2034]" : "bottom-0 rounded-b-[inherit] bg-[#14293f]"
      } ${className}`}
      style={style}
    >
      {/* Full card height, pinned to this half's edge, so each half shows its share of the digit.
          The logo's sky-to-mint gradient runs down the whole digit, so the halves line up. */}
      <span
        className={`absolute inset-x-0 flex h-[200%] items-center justify-center bg-linear-to-b from-[#4fadf9] from-30% to-[#34d29b] to-80% bg-clip-text text-[36px] font-bold tabular-nums tracking-tight text-transparent sm:text-[80px] ${
          top ? "top-0" : "bottom-0"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
