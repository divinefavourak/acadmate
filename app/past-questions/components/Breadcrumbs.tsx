import Link from "next/link";
import { SITE_URL, breadcrumbSchema } from "@/lib/seo";

export interface Crumb {
  name: string;
  /** Site-relative path. The last crumb is the current page and may omit it. */
  href?: string;
}

/** Visible breadcrumb trail. Pair it with breadcrumbJsonLd() for the structured-data copy. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.name}-${i}`} className="flex items-center gap-2 min-w-0">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  {item.name}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="text-slate-700 dark:text-slate-300 truncate">
                  {item.name}
                </span>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function breadcrumbJsonLd(items: Crumb[], currentPath: string) {
  return breadcrumbSchema(
    items.map((item, i) => ({
      name: item.name,
      url: `${SITE_URL}${item.href ?? (i === items.length - 1 ? currentPath : "")}`,
    })),
  );
}
