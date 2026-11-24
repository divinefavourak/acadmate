import Image from "next/image";

type Tone = "auto" | "light" | "dark";

/**
 * The Acadmate figure (logo without the wordmark). Files are built by
 * scripts/brand/build.mjs.
 *
 * tone="auto" follows the site theme by rendering both colourways and hiding
 * one with the `dark:` variant, so there is no flash before hydration.
 * Use "dark" on surfaces that are always dark (the mock-exam pages, for example).
 */
export function BrandMark({
  size = 32,
  tone = "auto",
  className = "",
  priority = false,
}: {
  size?: number;
  tone?: Tone;
  className?: string;
  priority?: boolean;
}) {
  const img = (src: string, extra = "") => (
    <Image
      src={src}
      alt="Acadmate"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${extra} ${className}`.trim()}
    />
  );

  if (tone === "light") return img("/brand/mark.svg");
  if (tone === "dark") return img("/brand/mark-dark.svg");
  return (
    <>
      {/* Only one is displayed at a time, and display:none drops the other from the accessibility tree. */}
      {img("/brand/mark.svg", "dark:hidden")}
      {img("/brand/mark-dark.svg", "hidden dark:block")}
    </>
  );
}
