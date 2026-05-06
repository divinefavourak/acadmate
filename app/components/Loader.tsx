export default function Loader({ className = "py-8" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <div className="loader" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
