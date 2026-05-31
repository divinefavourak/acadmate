"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Analytics } from "@vercel/analytics/next"
import Image from 'next/image';
import { motion } from 'framer-motion';
import MobileNav from '../components/layout/MobileNav';
import {
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { fadeUp, fadeIn, scaleIn, stagger, slideInLeft, slideInRight } from '@/lib/motion';

const landingNavItems = [
  { href: "#features", label: "Features", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 17 2 2 4-4"/><path d="m11 9 2 2 4-4"/><path d="M7 17h.01"/><path d="M7 11h.01"/><path d="M7 5h.01"/><path d="M3 21h18"/><path d="M3 3h18"/></svg> },
  { href: "#subjects", label: "Subjects", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg> },
  { href: "/blog", label: "Blog", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg> },
  { href: "#pricing", label: "Pricing", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> },
  { href: "#prose", label: "Literature", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
];
const footerSocials = [
  { name: 'WhatsApp', href: 'https://wa.me/2349031843486', icon: ChatBubbleLeftRightIcon},
  { name: 'Website', href: '/', icon: GlobeAltIcon }
]
export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <Analytics />

      {/* Subtle background gradient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-150 h-150 bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-100 h-100 bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpg" alt="Acadmate" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight">Acadmate Business Consult</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            {landingNavItems.map(item => (
              <Link key={item.href} href={item.href} className="hover:text-white transition-colors">{item.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-slate-400 hover:text-white transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl transition-colors">
              Click here to register free
            </Link>
            <button className="md:hidden p-2 text-slate-400" onClick={() => setIsMenuOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </header>

      <MobileNav isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} navItems={landingNavItems} />

      {/* ── HERO ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-16 pb-8 md:pt-24 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left: copy */}
          <motion.div
            variants={stagger(0.1, 0.12)}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-6">
              🎓 Nigeria&apos;s Student Success Platform
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.08] mb-6">
              Ace your exams.<br />
              <span className="bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Go further.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg text-slate-400 mb-8 leading-relaxed max-w-xl">
              JAMB & Post-UTME practice, school news, scholarship alerts, and career guides — everything a Nigerian student needs, in one place.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10">
              <Link href="/register" className="flex-1 sm:flex-none text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-2xl transition-all hover:shadow-lg hover:shadow-indigo-500/25 text-base">
                Start Practicing Free
              </Link>
              <Link href="#features" className="flex-1 sm:flex-none text-center border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-medium px-8 py-4 rounded-2xl transition-all text-base bg-white/5">
                See Features
              </Link>
            </motion.div>

            {/* Social proof numbers */}
            <motion.div variants={stagger(0, 0.1)} className="flex flex-wrap gap-8 pt-4 border-t border-white/5">
              {[
                { val: "8,600+", label: "Past Questions" },
                { val: "11", label: "Subjects" },
                { val: "6", label: "Post-UTME Schools" },
                { val: "Blog", label: "News & Guides" },
              ].map((s) => (
                <motion.div key={s.label} variants={fadeUp}>
                  <p className="text-2xl font-extrabold text-white">{s.val}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: real photos */}
          <motion.div
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            className="relative"
          >
            {/* Main photo — exam hall */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 aspect-4/3">
              <Image
                src="/images/520596414_739489019062965_5923685459460735498_n.jpg"
                alt="Students taking JAMB CBT exam"
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/10 w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-xs font-medium text-white">Real CBT exam conditions</span>
                </div>
              </div>
            </div>

            {/* Floating card — focused student */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
              className="absolute -bottom-6 -left-6 w-44 md:w-52 rounded-xl overflow-hidden border-2 border-indigo-500/50 shadow-xl shadow-indigo-500/10 hidden sm:block"
            >
              <Image
                src="/images/520231975_1062352099320762_1989502761018549539_n.jpg"
                alt="Student focused on practice"
                width={208}
                height={156}
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white drop-shadow">
                Practice → Confidence
              </div>
            </motion.div>

            {/* Score badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.4, ease: "easeOut" }}
              className="absolute -top-4 -right-4 bg-[#09090b] border border-white/10 rounded-2xl px-4 py-3 shadow-xl hidden md:block"
            >
              <p className="text-xs text-slate-400 mb-0.5">Average Score Gain</p>
              <p className="text-2xl font-extrabold text-emerald-400">+47pts</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
        <motion.div
          className="text-center mb-14"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything a Nigerian student needs</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Exam prep, school news, scholarship alerts, and career resources — all in one platform.</p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={stagger(0.1, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {[
            { icon: "⏱️", title: "Timed CBT Engine", desc: "Simulate the exact timing and pressure of the real JAMB exam. 2-hour mock tests, subject-by-subject practice, topic drills." },
            { icon: "📚", title: "Real Past Questions", desc: "8,600+ curated JAMB questions from 1978–2024. Every subject, every year — all with verified answers." },
            { icon: "💡", title: "Step-by-Step Solutions", desc: "Instant, detailed explanations for every question. Understand why, not just what." },
            { icon: "📊", title: "Deep Analytics", desc: "Spot your weak topics before exam day. Track your score trend and subject accuracy over time." },
            { icon: "🎓", title: "Post-UTME Prep", desc: "Practice with real Post-UTME past papers from UNILAG, UI, OAU, UNIBEN, ABU and UNN. Timed 30-minute sessions, 40 questions." },
            { icon: "🏆", title: "Leaderboard", desc: "See how you rank among all students nationally. Separate UTME and Post-UTME boards updated in real time." },
            { icon: "🎯", title: "Topic Mastery", desc: "Drill specific topics until they're perfect. Identify gaps and close them systematically." },
            { icon: "📖", title: "Literature Guide", desc: "Full summaries, character breakdowns and predicted questions for The Lekki Headmaster and other UTME prose." },
            { icon: "🔐", title: "Google Sign-In", desc: "Register or sign in with your Google account in one click — no password required." },
            { icon: "📰", title: "Blog & School News", desc: "Stay informed with JAMB updates, university announcements, and study tips written by our team." },
            { icon: "🎓", title: "Scholarship Alerts", desc: "Never miss a funding opportunity. We publish local and international scholarship announcements for Nigerian students." },
            { icon: "💼", title: "Career Guidance", desc: "Explore career paths, course requirements, and university admission insights to plan beyond the exam." },
          ].map((f, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative bg-white/3 border border-white/8 hover:border-white/15 rounded-2xl p-6 transition-colors hover:bg-white/6 cursor-default"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h4 className="text-lg font-bold mb-2">{f.title}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
        <motion.div
          className="text-center mb-14"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Simple, honest pricing</h2>
          <p className="text-slate-400 max-w-lg mx-auto">Start free. Upgrade when you&apos;re ready to go all in.</p>
        </motion.div>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto"
          variants={stagger(0.1, 0.15)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {/* Free plan */}
          <motion.div variants={fadeUp} className="bg-white/3 border border-white/8 rounded-2xl p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Free</p>
              <p className="text-4xl font-extrabold">₦0</p>
              <p className="text-slate-400 text-sm mt-2">Start practicing instantly, no card needed.</p>
            </div>
            <ul className="space-y-3">
              {[
                "Subject Practice (up to 20 questions)",
                "Topic Drills (up to 20 questions)",
                "AI-powered explanations",
                "Analytics & score tracking",
                "Literature guide",
                "Leaderboard access",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/register" className="block text-center border border-white/10 hover:border-white/20 text-slate-300 font-semibold px-6 py-3 rounded-xl transition-colors">
              Get Started Free
            </Link>
          </motion.div>

          {/* Premium plan */}
          <motion.div variants={fadeUp} className="relative bg-indigo-600 rounded-2xl p-8 space-y-6 shadow-2xl shadow-indigo-500/20">
            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
              Most Popular
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-1">Premium</p>
              <p className="text-4xl font-extrabold text-white">Contact Us</p>
              <p className="text-indigo-200 text-sm mt-2">Pay once, full access — no subscription.</p>
            </div>
            <ul className="space-y-3">
              {[
                "Everything in Free",
                "Full UTME Mock Exams (160 questions, 2 hrs)",
                "Post-UTME Papers — 6 top universities",
                "Unlimited question count per session",
                "Priority WhatsApp support",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white">
                  <span className="w-4 h-4 rounded-full bg-white/20 text-white flex items-center justify-center text-xs shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/2349031843486"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-white text-indigo-700 font-bold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              Pay via WhatsApp
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── SUBJECTS ── */}
      <section id="subjects" className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
        <motion.div
          className="rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 p-10 md:p-16"
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">All Major JAMB Subjects</h2>
            <p className="text-slate-400">Comprehensive question banks across every department combination.</p>
          </div>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            variants={stagger(0.05, 0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {[
              { name: "Mathematics", icon: "📐" },
              { name: "English Language", icon: "✏️" },
              { name: "Biology", icon: "🧬" },
              { name: "Chemistry", icon: "⚗️" },
              { name: "Physics", icon: "⚡" },
              { name: "Economics", icon: "📈" },
              { name: "Government", icon: "🏛️" },
              { name: "Literature", icon: "📖" },
              { name: "Commerce", icon: "💼" },
              { name: "Accounts", icon: "🧾" },
              { name: "CRK", icon: "✝️" },
              { name: "More soon…", icon: "🔜" },
            ].map((s, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl p-4 hover:border-indigo-500/30 transition-colors group"
              >
                <span className="text-xl">{s.icon}</span>
                <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{s.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── LITERATURE SPOTLIGHT ── */}
      <section id="prose" className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            variants={slideInLeft}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
              Literature Spotlight
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">Master<br />The Lekki Headmaster</h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-lg">
              Don&apos;t lose marks on prose. Our platform has the most comprehensive guide to every UTME literature text.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                "Full plot summaries & chapter breakdowns",
                "In-depth character analysis",
                "Thematic explorations",
                "Predicted exam questions with answers",
              ].map((l, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs">✓</span>
                  {l}
                </li>
              ))}
            </ul>
            <Link href="/register" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3.5 rounded-2xl transition-colors">
              Get Literature Guide
            </Link>
          </motion.div>

          <motion.div
            variants={slideInRight}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="relative"
          >
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <Image
                src="/images/520596414_739489019062965_5923685459460735498_n.jpg"
                alt="Students in CBT exam hall"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-br from-emerald-900/40 to-transparent" />
            </div>
            <div className="absolute -bottom-5 -right-5 bg-[#09090b] border border-white/10 rounded-2xl p-5 shadow-xl max-w-55 hidden md:block">
              <p className="text-sm font-bold text-white mb-1">90%+ Accuracy</p>
              <p className="text-xs text-slate-400">Predicting JAMB literature questions since 2022.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="demo" className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-16 mb-20">
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="relative overflow-hidden rounded-[2.5rem] bg-indigo-600 p-10 md:p-16 text-center"
        >
          <div className="absolute inset-0 opacity-10">
            <Image src="/images/520231975_1062352099320762_1989502761018549539_n.jpg" alt="" fill className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-indigo-600/80" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-white">Your student journey starts here.</h2>
            <p className="text-indigo-200 text-lg max-w-2xl mx-auto mb-10">
              Join Nigerian students who use Acadmate to ace their exams, find scholarships, and build a path beyond admission.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto bg-white text-indigo-700 font-bold px-10 py-4 rounded-2xl hover:shadow-xl hover:scale-105 transition-all text-base">
                Create Free Account
              </Link>
              <Link href="/login" className="w-full sm:w-auto bg-white/10 border border-white/20 text-white font-medium px-10 py-4 rounded-2xl hover:bg-white/20 transition-all text-base">
                Sign In
              </Link>
            </div>
            <p className="mt-6 text-indigo-300 text-sm">A free platform for practice Start instantly.</p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-10 px-4 md:px-6 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left: Acadmate Brand */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/images/logo.jpg" alt="Acadmate" width={22} height={22} className="rounded" />
              <span className="font-bold text-slate-300 text-lg">Acadmate</span>
            </Link>
            <p className="text-sm text-slate-500 max-w-xs text-center md:text-left">
              Helping Nigerian students ace their exams, find opportunities, and build their future.
            </p>
          </div>

        {/*Center: Social/Contact Icons */}
          <div className="flex flex-col items-center gap-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">Connect with us</span>
              {footerSocials.map((item) => (
                <Link 
                  key={item.name}
                  href={item.href}
                  className="group flex flex-col items-center gap-2"
                  target="_blank"
                  >
                    <div className="p-2.5 rounded-full bg-white/5 border border-white/5 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all">
                      <item.icon className="size-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </Link>
              )
            )}
          </div>
          {/* Right: Copyright */}
          <div className="flex flex-col items-center md:items-end gap-3 text-sm">
            <nav className="flex gap-4 text-slate-500 text-xs">
              <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            </nav>
            <p className="text-slate-500 text-xs">© {new Date().getFullYear()} Acadmate Business Consult. All rights reserved.</p>
          </div>
         
        </div>
      </footer>
    </div>
  );
}
