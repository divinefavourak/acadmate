"use client";

import React from "react";
import ReactNiceAvatar from "react-nice-avatar";
import type { AvatarFullConfig } from "react-nice-avatar";

const NiceAvatar = ReactNiceAvatar as React.ComponentType<AvatarFullConfig & { style?: React.CSSProperties; className?: string }>;

type Props = {
  avatarConfig?: Record<string, unknown> | null;
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
};

export default function UserAvatar({ avatarConfig, avatarUrl, name, size = 40, className = "" }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "avatar"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (avatarConfig) {
    return (
      <NiceAvatar
        style={{ width: size, height: size }}
        className={`rounded-full ${className}`}
        {...(avatarConfig as AvatarFullConfig)}
      />
    );
  }

  // Fallback: initials
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div
      className={`rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold select-none ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
