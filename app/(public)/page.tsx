"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MobileNav from '../components/layout/MobileNav';

const landingNavItems = [
  { href: "#features", label: "Features", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17 2 2 4-4"/><path d="m11 9 2 2 4-4"/><path d="M7 17h.01"/><path d="M7 11h.01"/><path d="M7 5h.01"/><path d="M3 21h18"/><path d="M3 3h18"/></svg> },
  { href: "#subjects", label: "Subjects", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> },
  { href: "#prose", label: "Literature", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
];

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {/* Background Orbs for Dynamic Design */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[50%] bg-blue-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] bg-purple-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[50%] bg-indigo-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-blob animation-delay-4000"></div>

      {/* Header Navigation */}
      <header className="glass-panel sticky top-0 z-50 px-4 md:px-6 py-4 flex items-center justify-between mx-auto w-[95%] max-w-7xl mt-4 rounded-2xl">
        <div className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Image src="/images/logo.jpg" alt="Acadmate Logo" width={32} height={32} className="rounded-lg shadow-md object-cover" />
          <span className="tracking-tight">Acadmate</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {landingNavItems.map(item => (
            <Link key={item.href} href={item.href} className="hover:text-indigo-500 transition-colors">{item.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/login" className="hidden sm:inline-flex btn-secondary text-sm px-5 py-2">Sign In</Link>
          <Link href="/register" className="btn-primary text-sm px-4 md:px-5 py-2">Start Practicing</Link>
          
          <button 
            className="md:hidden p-2 text-slate-600 dark:text-slate-400"
            onClick={() => setIsMenuOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        </div>
      </header>

      <MobileNav 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        navItems={landingNavItems}
      />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 my-12 md:my-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-semibold uppercase tracking-wider mb-6 md:mb-8 border border-indigo-500/20">
          <span>🚀 The Lekki Headmaster Now Available</span>
        </div>
        
        <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight mb-6">
          Master the UTME with <br/>
          <span className="text-gradient">Laser Precision</span>
        </h1>
        
        <p className="text-base md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-8 md:mb-10 leading-relaxed">
          The most advanced Mock Exam simulator. Practice with timed CBT sessions, detailed explanations, and deep analytics to guarantee your admission success.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto px-4 sm:px-0">
          <Link href="/register" className="w-full sm:w-auto btn-primary text-lg px-8 py-3.5 flex items-center justify-center gap-2">
            Get Started Free
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
          <Link href="#demo" className="w-full sm:w-auto btn-secondary text-lg px-8 py-3.5">
            Take a Demo Test
          </Link>
        </div>

        {/* Target Institutions */}
        <div className="mt-12 md:mt-16 flex flex-col items-center gap-4">
           <span className="text-xs md:text-sm text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest">Targeting Top Universities Like</span>
           <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
             <Image 
               src="/images/1001542112_aa529c02f858ea12b09c99ce04c93aa4-1_18_2026, 9_52_57 AM.png" 
               alt="UNILAG Logo" 
               width={60} 
               height={60} 
               className="md:w-20 md:h-20 object-contain opacity-80 hover:opacity-100 transition-opacity"
             />
           </div>
        </div>

        {/* Floating Demo Cards / Visuals */}
        <div className="mt-16 md:mt-20 w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 relative px-4 md:px-0">
          <div className="glass-panel p-6 rounded-2xl text-left transform md:-rotate-2 hover:rotate-0 transition-transform duration-300">
             <div className="relative w-full h-32 mb-4 rounded-xl overflow-hidden hidden md:block">
               <Image src="/images/images.jfif" alt="Economics Masterclass" fill className="object-cover" />
             </div>
             <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
             </div>
             <h3 className="font-bold text-lg mb-2">Economics Masterclass</h3>
             <p className="text-sm text-slate-500 dark:text-slate-400">Tackle complex supply & demand curves with ease through our deep-dive explanations.</p>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl text-left transform md:hover:-translate-y-2 transition-transform duration-300 border-indigo-500/30 ring-1 ring-indigo-500/20">
             <div className="relative w-full h-32 mb-4 rounded-xl overflow-hidden hidden md:block">
               <Image src="/images/520231975_1062352099320762_1989502761018549539_n.jpg" alt="CBT Engine" fill className="object-cover" />
             </div>
             <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
             </div>
             <h3 className="font-bold text-lg mb-2">Timed CBT Engine</h3>
             <p className="text-sm text-slate-500 dark:text-slate-400">Experience the exact timing and pressure of the real JAMB exam with our smart simulator.</p>
          </div>

          <div className="glass-panel p-6 rounded-2xl text-left transform md:rotate-2 hover:rotate-0 transition-transform duration-300">
             <div className="relative w-full h-32 mb-4 rounded-xl overflow-hidden hidden md:block">
               <Image src="/images/520596414_739489019062965_5923685459460735498_n.jpg" alt="Literature Analysis" fill className="object-cover" />
             </div>
             <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
             </div>
             <h3 className="font-bold text-lg mb-2">The Lekki Headmaster</h3>
             <p className="text-sm text-slate-500 dark:text-slate-400">Exclusive prose summaries, character analysis, and predicted questions.</p>
          </div>
        </div>

        {/* Sections */}
        <section id="features" className="mt-20 md:mt-32 w-full max-w-6xl px-4 md:px-6 py-12 md:py-20">
          <div className="flex flex-col items-center text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Powerful Features</h2>
            <p className="text-sm md:text-base text-slate-500 max-w-2xl px-4">Everything you need to score 300+ in your JAMB UTME.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              { title: "Timed Simulations", desc: "Practice under real exam conditions with our high-performance CBT engine.", icon: "⏱️" },
              { title: "Topic Mastery", desc: "Break down your preparation into specific topics to address your weak points.", icon: "🎯" },
              { title: "Instant Explanations", desc: "Get detailed step-by-step solutions for every question immediately after your test.", icon: "💡" },
              { title: "Performance Analytics", desc: "Track your progress with deep insights into your subject and topic proficiency.", icon: "📊" },
              { title: "Mobile Optimized", desc: "Study on the go with a platform designed for a seamless mobile experience.", icon: "📱" },
              { title: "Up-to-Date Content", desc: "Our question bank is constantly updated with the latest UTME standards.", icon: "✨" },
            ].map((f, i) => (
              <div key={i} className="glass-panel p-6 md:p-8 rounded-2xl border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/50 transition-all text-left group">
                <div className="text-2xl md:text-3xl mb-4 group-hover:scale-110 transition-transform">{f.icon}</div>
                <h4 className="text-lg md:text-xl font-bold mb-2">{f.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="subjects" className="mt-12 md:mt-20 w-full max-w-6xl px-4 md:px-6 py-12 md:py-20 bg-indigo-500/5 rounded-[2rem] md:rounded-[3rem] border border-indigo-500/10 mb-12 md:mb-20">
          <div className="flex flex-col items-center text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Supported Subjects</h2>
            <p className="text-sm md:text-base text-slate-500 max-w-2xl px-4">Comprehensive coverage across all major departments.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {["English Language", "Mathematics", "Biology", "Chemistry", "Physics", "Economics", "Government", "Literature"].map((s, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center font-bold shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all">
                {s}
              </div>
            ))}
          </div>
        </section>

        <section id="prose" className="mt-12 md:mt-20 w-full max-w-6xl px-4 md:px-6 py-12 md:py-20 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <div className="flex-1 text-left order-2 md:order-1">
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-6 border border-emerald-500/20">
              Literature Spotlight
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">Master The Lekki Headmaster</h2>
            <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Don't lose marks on your literature section. Our platform includes the most comprehensive guide to "The Lekki Headmaster" and other UTME prose texts.
            </p>
            <ul className="space-y-4 mb-10">
              {["Full plot summaries & chapter breakdowns", "In-depth character analysis", "Thematic explorations", "Likely exam questions & predictions"].map((l, i) => (
                <li key={i} className="flex items-center gap-3 font-medium text-sm md:text-base">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs">✓</span>
                  {l}
                </li>
              ))}
            </ul>
            <Link href="/register" className="w-full md:w-auto text-center inline-block btn-primary px-8 py-3.5">Get Literature Guide</Link>
          </div>
          <div className="flex-1 relative order-1 md:order-2 w-full max-w-md md:max-w-none mx-auto">
            <div className="relative w-full aspect-square rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl rotate-2 md:rotate-3">
              <Image src="/images/520596414_739489019062965_5923685459460735498_n.jpg" alt="Lekki Headmaster" fill className="object-cover" />
            </div>
            <div className="absolute -bottom-4 md:-bottom-6 -left-4 md:-left-6 glass-panel p-4 md:p-6 rounded-xl md:rounded-2xl shadow-xl max-w-[200px] md:max-w-xs -rotate-2 md:-rotate-3 border-indigo-500/30">
              <p className="font-bold text-sm md:text-lg mb-1">Predicting Questions</p>
              <p className="text-[10px] md:text-xs text-slate-500">Over 90% accuracy in predicting literature questions based on current JAMB trends.</p>
            </div>
          </div>
        </section>

        <section id="demo" className="mt-20 md:mt-32 w-full max-w-5xl px-4 md:px-6 py-12 md:py-24 mb-12 md:mb-32 rounded-[2rem] md:rounded-[3rem] bg-indigo-600 text-white text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full -ml-32 -mb-32 blur-3xl group-hover:bg-indigo-400/30 transition-all"></div>
          
          <div className="relative z-10 px-4">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to crush your JAMB?</h2>
            <p className="text-base md:text-lg text-indigo-100 max-w-2xl mx-auto mb-10">
              Join thousands of students who are currently using Acadmate to secure their university admission.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Link href="/register" className="w-full sm:w-auto bg-white text-indigo-600 px-8 md:px-10 py-4 rounded-2xl font-bold text-base md:text-lg hover:shadow-xl hover:scale-105 transition-all">
                 Create Free Account
               </Link>
               <Link href="/login" className="w-full sm:w-auto bg-indigo-500 text-white border border-white/20 px-8 md:px-10 py-4 rounded-2xl font-bold text-base md:text-lg hover:bg-indigo-400 transition-all">
                 Sign In
               </Link>
            </div>
            <p className="mt-8 text-indigo-200 text-xs md:text-sm font-medium">No credit card required. Start practicing instantly.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-4 md:px-6 py-12 text-center text-slate-500 text-sm mt-auto backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.jpg" alt="Acadmate Logo" width={24} height={24} className="rounded object-cover" />
            <span className="font-bold text-slate-900 dark:text-white">Acadmate</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {landingNavItems.map(item => (
              <Link key={item.href} href={item.href} className="hover:text-indigo-500 transition-colors">{item.label}</Link>
            ))}
            <Link href="/login" className="hover:text-indigo-500 transition-colors">Sign In</Link>
          </nav>
          <p className="text-center md:text-right">© {new Date().getFullYear()} Acadmate CBT Platforms. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
