"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { titleForPath } from "@/lib/pageTitles";
import { SITE_NAME } from "@/lib/seo";

/**
 * Sets the browser tab title per route for client-rendered pages, which can't
 * export Next.js `metadata`. Mapped routes get "<Page> | Acadmate"; unmapped
 * routes (the SEO/server pages) are left with their own server-set title.
 */
export default function RouteTitle() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const title = titleForPath(pathname);
    if (title) document.title = `${title} | ${SITE_NAME}`;
  }, [pathname]);

  return null;
}
