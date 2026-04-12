import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-slate-50 dark:bg-[#09090b]">
      {/* Background Orbs for Dynamic Design */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] bg-purple-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[50%] bg-indigo-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center p-4">
        <Link href="/" className="flex items-center gap-2 mb-8 group">
          <Image src="/images/logo.jpg" alt="Acadmate" width={40} height={40} className="rounded-xl shadow-lg group-hover:shadow-indigo-500/25 transition-all object-cover" />
          <span className="text-3xl font-bold tracking-tight">Acadmate</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
