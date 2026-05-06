export default function Loader({ className = "py-8" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="loader" />
    </div>
  );
}
