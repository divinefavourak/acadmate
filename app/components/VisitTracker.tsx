"use client";

import { useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function VisitTracker() {
  useEffect(() => {
    fetch(`${API_BASE}/analytics/visit`, { method: "POST" }).catch(() => null);
  }, []);

  return null;
}
