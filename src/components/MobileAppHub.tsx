/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Download,
  CheckCircle2,
  Copy,
  Zap,
  BookOpen,
  Layers,
  Clock,
  Award,
  ChevronRight,
  Flame,
  Cpu,
  Database,
  Package,
  QrCode,
  ExternalLink,
  X,
  Bookmark,
  Lightbulb,
  Tag,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BarChart,
  RotateCcw,
  Apple,
  Wifi,
  WifiOff,
  SignalHigh,
  BatteryFull,
  RefreshCw,
  Sparkles,
  Code2,
  MoreHorizontal,
  Home as HomeIcon,
  Info
} from "lucide-react";
import { Question } from "../types";
import RichText from "./RichText";

interface MobileAppHubProps {
  questions?: Question[];
}

/** Direct EAS build artifact — installs on Android without a Play Store account. */
const APK_DOWNLOAD_URL = "https://expo.dev/artifacts/eas/eEJvmxfvmTe9WAc5a1VrpFv95Nk8lVXiWssiJIifkzg.apk";

/**
 * Real question counts baked into mobile/src/data/content.json
 * (src/lib generates it via scripts/build-mobile-content.ts). Keep these in
 * sync with that bundle rather than the old hand-typed 425/703 guesses.
 */
const CCAF_COUNT = 1037;
const CIL_COUNT = 703;
const TOTAL_COUNT = CCAF_COUNT + CIL_COUNT;

const HERO_FEATURES = [
  { icon: WifiOff, color: "text-blue-600", bg: "bg-blue-50", title: "100% Offline", subtitle: "Study anywhere" },
  { icon: Package, color: "text-purple-600", bg: "bg-purple-50", title: "Same Content", subtitle: "as Web App" },
  { icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50", title: "Fast & Lightweight", subtitle: "Built with React Native" },
  { icon: RefreshCw, color: "text-amber-600", bg: "bg-amber-50", title: "Regular Updates", subtitle: "New features & content" }
] as const;

const BOTTOM_TABS = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "quiz", label: "Practice", icon: Zap },
  { key: "flashcard", label: "Revision", icon: RotateCcw },
  { key: "mock", label: "More", icon: MoreHorizontal }
] as const;

/** The Android "bugdroid" silhouette — no equivalent brand mark ships in lucide-react. */
function AndroidGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="8.3" y="1.9" width="1.5" height="4.1" rx="0.75" transform="rotate(-28 9.05 3.95)" />
      <rect x="14.2" y="1.9" width="1.5" height="4.1" rx="0.75" transform="rotate(28 14.95 3.95)" />
      <path d="M6.4 10.1a5.6 5.6 0 0 1 11.2 0v0.4H6.4v-0.4Z" />
      <rect x="5.6" y="10.7" width="12.8" height="7.4" rx="2.2" />
      <rect x="3.4" y="11.3" width="1.9" height="6.2" rx="0.95" />
      <rect x="18.7" y="11.3" width="1.9" height="6.2" rx="0.95" />
      <rect x="8.3" y="18.8" width="1.9" height="3.3" rx="0.95" />
      <rect x="13.8" y="18.8" width="1.9" height="3.3" rx="0.95" />
    </svg>
  );
}

/** A hand-drawn-style curved arrow, used as a decorative accent in the hero illustration. */
function DoodleArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M4 34C10 20 22 10 34 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M27 4 L35 6 L32 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MobileAppHub({ questions = [] }: MobileAppHubProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [simulatorScreen, setSimulatorScreen] = useState<"home" | "quiz" | "flashcard" | "mock">("home");
  const [selectedExamTrack, setSelectedExamTrack] = useState<"ccaf" | "cil">("ccaf");
  const [selectedTab, setSelectedTab] = useState<"download" | "eas-apk" | "expo-go">("eas-apk");
  const [quizIdx, setQuizIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [confidence, setConfidence] = useState<"Guess" | "Somewhat Sure" | "Very Sure">("Very Sure");
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  const ccafSampleQuestions = [
    {
      id: 101,
      question: "When designing an agentic tool in Anthropic Claude architecture, which constraint strictly guarantees deterministic runtime parsing?",
      options: [
        "Specifying strict JSON Schema with explicit types, required properties, and enums",
        "Using natural language markdown instructions inside system prompt",
        "Relying on temperature = 0.0 without schema validation",
        "Passing arbitrary raw string payloads and parsing with regex"
      ],
      answer: "A",
      explanation: "Explicit JSON Schema validation with typed enum definitions guarantees that the LLM parameters conform deterministically to the execution contract.",
      examTrick: "Always choose strict JSON Schema / enum constraints over prompt text guidance for input safety.",
      difficulty: "Medium",
      importance: "High",
      tags: ["Tool use", "Schema design"]
    },
    {
      id: 102,
      question: "What is the minimum token threshold required for Prompt Caching to activate on Anthropic Claude 3.5 Sonnet?",
      options: ["1,024 tokens", "256 tokens", "512 tokens", "4,096 tokens"],
      answer: "A",
      explanation: "Anthropic Prompt Caching requires a minimum prefix length of 1,024 tokens for Claude 3.5 Sonnet and Opus (2,048 for Haiku).",
      examTrick: "Sonnet/Opus = 1024 tokens; Haiku = 2048 tokens. Caching gives 90% cost reduction on cached reads.",
      difficulty: "Hard",
      importance: "High",
      tags: ["Prompt caching", "Cost optimization"]
    }
  ];

  const cilSampleQuestions = [
    {
      id: 201,
      question: "In relational database normalization, a table with no partial functional dependencies on any candidate key is in:",
      options: ["2nd Normal Form (2NF)", "1st Normal Form (1NF)", "3rd Normal Form (3NF)", "Boyce-Codd Normal Form (BCNF)"],
      answer: "A",
      explanation: "2NF eliminates partial dependency (where a non-prime attribute depends on a proper subset of a candidate key).",
      examTrick: "1NF = Atomic values; 2NF = No Partial Dependency; 3NF = No Transitive Dependency; BCNF = Determinants must be superkeys.",
      difficulty: "Medium",
      importance: "Medium",
      tags: ["DBMS", "Normalization"]
    },
    {
      id: 202,
      question: "What is the worst-case time complexity of QuickSort when the pivot is always chosen as the smallest element in a sorted array?",
      options: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
      answer: "A",
      explanation: "Choosing an extreme element on an already sorted list yields unbalanced partitions of size 0 and n-1, leading to quadratic O(n²) complexity.",
      examTrick: "Unbalanced partition recurrence T(n) = T(n-1) + O(n) = O(n²). Randomized pivot guarantees O(n log n) average.",
      difficulty: "Hard",
      importance: "High",
      tags: ["Algorithms", "Sorting"]
    }
  ];

  const activeQuestions = selectedExamTrack === "ccaf" ? ccafSampleQuestions : cilSampleQuestions;
  const currentQ = activeQuestions[quizIdx % activeQuestions.length];
  const accent = selectedExamTrack === "ccaf" ? "purple" : "amber";

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const resetQuizState = () => {
    setIsAnswered(false);
    setSelectedOpt(null);
    setConfidence("Very Sure");
  };

  const goToTab = (screen: typeof simulatorScreen) => {
    setSimulatorScreen(screen);
    if (screen !== "home") resetQuizState();
    if (screen === "flashcard") setFlashcardFlipped(false);
  };

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto pb-12">
      {/* Hero */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-3xs">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 max-w-2xl">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              CROSS-PLATFORM ECOSYSTEM
            </span>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Exam Scholar Mobile Edition
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-2 leading-relaxed">
              One curriculum, every device. All <strong className="text-slate-800 font-semibold">{TOTAL_COUNT.toLocaleString()} questions</strong> ({CCAF_COUNT.toLocaleString()} Claude CCAF, {CIL_COUNT.toLocaleString()} CIL MT) bundled directly on-device — 100% offline, with the same UI and Exam Tricks as the web application.
            </p>

            {/* Feature pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6">
              {HERO_FEATURES.map((f) => (
                <div key={f.title} className="bg-slate-50/70 border border-slate-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-3xs">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${f.bg}`}>
                    <f.icon className={`w-3.5 h-3.5 ${f.color}`} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="text-[11px] font-bold text-slate-800 truncate">{f.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{f.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <a
                href={APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-3xs cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                Download for Android
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </a>
              <button
                onClick={() => setSelectedTab("expo-go")}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-3xs cursor-pointer"
              >
                <Apple className="w-4 h-4 shrink-0" />
                Get it on iOS
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Illustration: two overlapping phone mockups */}
          <div className="hidden lg:flex w-[360px] h-[340px] shrink-0 relative items-center justify-center">
            <Sparkles className="absolute left-0 top-2 w-6 h-6 text-emerald-500 rotate-[-8deg]" />

            {/* Back phone — practice progress */}
            <div className="absolute right-0 top-0 w-[140px] rotate-[8deg]">
              <div className="bg-slate-900 rounded-[26px] p-1.5 shadow-2xl">
                <div className="bg-white rounded-[20px] overflow-hidden h-[260px] flex flex-col">
                  <div className="px-3 pt-3 pb-1 text-[8px] font-bold text-slate-900">9:41</div>
                  <div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-3">
                    <div className="text-[10px] font-bold text-slate-700">Practice MCQ</div>
                    <div className="relative w-14 h-14">
                      <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="75 100" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-emerald-600">75%</div>
                    </div>
                    <div className="text-[8px] text-slate-400">Exam Progress</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Front phone — brand splash */}
            <div className="relative w-[168px] rotate-[-6deg] z-10">
              <div className="bg-slate-900 rounded-[30px] p-2 shadow-2xl">
                <div className="bg-gradient-to-b from-indigo-50 to-white rounded-[22px] overflow-hidden h-[310px] flex flex-col items-center justify-center gap-3 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                    <Layers className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Exam Scholar</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Learn • Practice • Succeed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating callouts */}
            <div className="absolute left-0 bottom-10 bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2 rotate-[-3deg] z-20">
              <div className="text-[10px] font-bold text-slate-800">Study Smarter</div>
              <div className="text-[9px] text-slate-400">Anytime, Anywhere</div>
            </div>

            <div className="absolute right-0 bottom-0 text-right">
              <div className="text-[10px] font-semibold text-indigo-500 italic leading-snug">
                Your exam companion<br />on the go
              </div>
            </div>

            <DoodleArrow className="absolute right-16 bottom-10 w-8 h-8 text-indigo-300 rotate-[20deg]" />
          </div>
        </div>
      </div>

      {/* Main 2-Column: Live Mobile Simulator vs Packaging / Installation Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Mobile Phone Simulator */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full mb-3 px-2">
            <h3 className="font-display text-sm font-bold text-slate-900">Live Interactive Mobile Simulator</h3>
            <p className="text-xs text-slate-400 mt-0.5">Try the real app experience</p>
          </div>

          {/* Phone Frame — modern punch-hole silhouette with side buttons */}
          <div className="relative w-full max-w-[320px] mx-auto">
            <div className="absolute -left-[3px] top-[104px] w-[3px] h-9 bg-slate-800 rounded-l-sm" />
            <div className="absolute -left-[3px] top-[150px] w-[3px] h-14 bg-slate-800 rounded-l-sm" />
            <div className="absolute -right-[3px] top-[124px] w-[3px] h-16 bg-slate-800 rounded-r-sm" />

            <div className="bg-slate-950 rounded-[44px] p-2.5 shadow-2xl ring-1 ring-slate-800/60">
              {/* Inner Mobile Screen Container — light theme, matching mobile/src/theme.ts */}
              <div className="relative bg-slate-50 rounded-[34px] overflow-hidden h-[600px] flex flex-col text-slate-800 select-none">
                {/* Punch-hole camera */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-950 z-30" />

                {/* Status bar */}
                <div className="relative z-20 shrink-0 flex items-center justify-between px-6 pt-2.5 pb-1">
                  <span className="text-[10px] font-bold text-slate-900">9:41</span>
                  <div className="flex items-center gap-1 text-slate-900">
                    <SignalHigh className="w-3 h-3" />
                    <Wifi className="w-3 h-3" />
                    <BatteryFull className="w-3.5 h-3.5" />
                  </div>
                </div>

              {simulatorScreen === "home" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
                  {/* Brand row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                        accent === "purple" ? "bg-purple-50 border-purple-200" : "bg-amber-50 border-amber-200"
                      }`}>
                        <Layers className={`w-5 h-5 ${accent === "purple" ? "text-purple-600" : "text-amber-500"}`} />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">Exam Scholar</div>
                        <div className={`text-[10px] font-bold tracking-wide ${accent === "purple" ? "text-purple-700" : "text-amber-700"}`}>
                          {selectedExamTrack === "ccaf" ? "CLAUDE CCAF" : "CIL MT"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-bold text-amber-800">3d</span>
                    </div>
                  </div>

                  {/* Exam chips */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setSelectedExamTrack("ccaf"); setQuizIdx(0); resetQuizState(); }}
                      className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                        selectedExamTrack === "ccaf" ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      Claude CCAF ({CCAF_COUNT.toLocaleString()})
                    </button>
                    <button
                      onClick={() => { setSelectedExamTrack("cil"); setQuizIdx(0); resetQuizState(); }}
                      className={`px-3 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                        selectedExamTrack === "cil" ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      CIL MT ({CIL_COUNT.toLocaleString()})
                    </button>
                  </div>

                  {/* Readiness summary card */}
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="p-3.5 pb-2.5">
                      <div className="text-sm font-bold text-slate-900">
                        {selectedExamTrack === "ccaf" ? "Claude Certified Architect (CCAF)" : "CIL MT Computer Science / GATE"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {selectedExamTrack === "ccaf" ? CCAF_COUNT.toLocaleString() : CIL_COUNT.toLocaleString()} questions loaded on this device
                      </div>
                    </div>
                    <div className="flex gap-2 px-3.5 pb-3.5">
                      {[
                        { value: "0", label: "Completed" },
                        { value: "—", label: "Accuracy", color: "text-emerald-600" },
                        { value: "0", label: "Mistakes", color: "text-rose-600" }
                      ].map((tile) => (
                        <div key={tile.label} className="flex-1 bg-slate-50 rounded-xl py-3 text-center">
                          <div className={`text-lg font-bold ${tile.color || "text-slate-900"}`}>{tile.value}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mt-0.5">{tile.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-700 pt-1">Practice Modes</div>

                  {/* Launcher rows */}
                  {[
                    { icon: Zap, title: "Quick Practice", subtitle: "25 questions with instant feedback & exam tips.", bg: "bg-emerald-50", border: "border-emerald-100", color: "text-emerald-600", onClick: () => goToTab("quiz") },
                    { icon: BookOpen, title: "Subjects", subtitle: "Browse the full curriculum by chapter.", bg: "bg-indigo-50", border: "border-indigo-100", color: "text-indigo-600", onClick: () => goToTab("quiz") },
                    { icon: Layers, title: "Flashcards", subtitle: "Swipe through exam tips and core patterns.", bg: "bg-indigo-50", border: "border-indigo-100", color: "text-indigo-600", onClick: () => goToTab("flashcard") },
                    { icon: Award, title: "Mock Test Arena", subtitle: "Timed simulation with instant scoring.", bg: "bg-amber-50", border: "border-amber-100", color: "text-amber-600", onClick: () => goToTab("mock") }
                  ].map((row) => (
                    <button
                      key={row.title}
                      onClick={row.onClick}
                      className="w-full text-left p-3 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${row.bg} ${row.border}`}>
                        <row.icon className={`w-4.5 h-4.5 ${row.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800">{row.title}</div>
                        <div className="text-[10px] text-slate-400 leading-snug">{row.subtitle}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  ))}

                  <div className="flex gap-2.5">
                    <div className="flex-1 bg-white border border-slate-100 rounded-xl shadow-sm p-3 space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">Mistakes</div>
                      <div className="text-[10px] text-slate-400">0 to review</div>
                    </div>
                    <div className="flex-1 bg-white border border-slate-100 rounded-xl shadow-sm p-3 space-y-1.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <BarChart className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">Analytics</div>
                      <div className="text-[10px] text-slate-400">— accuracy</div>
                    </div>
                  </div>
                </div>
              )}

              {simulatorScreen === "quiz" && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="px-4 pt-3 pb-2.5 flex items-center justify-between bg-white border-b border-slate-100">
                    <button onClick={() => goToTab("home")} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4.5 h-4.5" />
                    </button>
                    <div className="text-center">
                      <div className="text-[11px] text-slate-500">
                        Question <strong className="text-slate-800">{quizIdx + 1}</strong> of <strong className="text-slate-800">{activeQuestions.length}</strong>
                      </div>
                    </div>
                    <Bookmark className="w-4.5 h-4.5 text-slate-300" />
                  </div>
                  <div className="px-4 pb-3 pt-2 bg-white border-b border-slate-100">
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${((quizIdx) / activeQuestions.length) * 100}%` }} />
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          currentQ.difficulty === "Hard" ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-indigo-50 border-indigo-100 text-indigo-700"
                        }`}>
                          {currentQ.difficulty}
                        </span>
                        {currentQ.importance === "High" && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 border border-amber-100 text-amber-700">
                            High priority
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-800 leading-relaxed">
                        <RichText inline>{currentQ.question}</RichText>
                      </div>

                      <div className="space-y-2">
                        {currentQ.options.map((opt, oIdx) => {
                          const letter = String.fromCharCode(65 + oIdx);
                          const isChosen = selectedOpt === letter;
                          const isCorrect = letter === currentQ.answer;

                          let cardStyle = "bg-white border-slate-100";
                          let chipStyle = "bg-slate-50 border-slate-100 text-slate-500";
                          if (isAnswered) {
                            if (isCorrect) { cardStyle = "bg-emerald-50 border-emerald-300"; chipStyle = "bg-emerald-500 border-emerald-500 text-white"; }
                            else if (isChosen) { cardStyle = "bg-rose-50 border-rose-300"; chipStyle = "bg-rose-500 border-rose-500 text-white"; }
                            else { cardStyle = "bg-white border-slate-100 opacity-50"; }
                          } else if (isChosen) {
                            cardStyle = "bg-indigo-50 border-indigo-500";
                            chipStyle = "bg-indigo-600 border-indigo-600 text-white";
                          }

                          return (
                            <button
                              key={letter}
                              disabled={isAnswered}
                              onClick={() => { setSelectedOpt(letter); }}
                              className={`w-full text-left p-2.5 rounded-lg border flex items-start gap-2.5 transition-all ${cardStyle}`}
                            >
                              <span className={`w-6 h-6 rounded-md border flex items-center justify-center font-bold text-[10px] shrink-0 ${chipStyle}`}>
                                {letter}
                              </span>
                              <span className="flex-1 text-[11px] text-slate-600"><RichText inline>{opt}</RichText></span>
                            </button>
                          );
                        })}
                      </div>

                      {!isAnswered && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="text-[10px] font-semibold text-slate-400">How confident are you?</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(["Guess", "Somewhat Sure", "Very Sure"] as const).map((level) => (
                              <button
                                key={level}
                                onClick={() => setConfidence(level)}
                                className={`py-1.5 rounded-lg border text-[9px] font-semibold ${
                                  confidence === level
                                    ? level === "Guess" ? "bg-amber-50 border-amber-300 text-amber-700"
                                      : level === "Somewhat Sure" ? "bg-blue-50 border-blue-300 text-blue-700"
                                      : "bg-emerald-50 border-emerald-300 text-emerald-700"
                                    : "bg-white border-slate-100 text-slate-400"
                                }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                          <button
                            disabled={!selectedOpt}
                            onClick={() => setIsAnswered(true)}
                            className="w-full py-2 bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl text-xs font-semibold text-white shadow-3xs"
                          >
                            Submit answer
                          </button>
                        </div>
                      )}
                    </div>

                    {isAnswered && (
                      <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedOpt === currentQ.answer ? "bg-emerald-500" : "bg-rose-500"}`}>
                            {selectedOpt === currentQ.answer ? <CheckCircle className="w-4.5 h-4.5 text-white" /> : <XCircle className="w-4.5 h-4.5 text-white" />}
                          </div>
                          <div>
                            <div className={`text-xs font-bold ${selectedOpt === currentQ.answer ? "text-emerald-700" : "text-rose-700"}`}>
                              {selectedOpt === currentQ.answer ? "Correct!" : "Incorrect"}
                            </div>
                            <div className="text-[10px] text-slate-400">Answered with {confidence.toLowerCase()} confidence.</div>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-[10px] text-slate-600 leading-relaxed">
                          <RichText>{currentQ.explanation}</RichText>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-start gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="text-[10px] text-amber-800 leading-relaxed font-medium">
                            <RichText>{currentQ.examTrick}</RichText>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {currentQ.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 text-[9px] font-medium bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                              <Tag className="w-2.5 h-2.5" /> {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                    <button disabled className="flex-1 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5">
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    <button
                      onClick={() => { setQuizIdx((quizIdx + 1) % activeQuestions.length); resetQuizState(); }}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 text-[11px] font-semibold text-white flex items-center justify-center gap-1.5"
                    >
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {simulatorScreen === "flashcard" && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="px-4 py-2.5 flex items-center justify-between bg-white border-b border-slate-100">
                    <button onClick={() => goToTab("home")} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4.5 h-4.5" />
                    </button>
                    <div className="text-[11px] text-slate-500">
                      Card <strong className="text-slate-800">{quizIdx + 1}</strong> of {activeQuestions.length}
                    </div>
                    <div className="w-4.5" />
                  </div>

                  <div className="flex-1 p-4 space-y-4">
                    <div
                      onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                      className={`min-h-[220px] p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between shadow-sm ${
                        flashcardFlipped ? "bg-amber-50 border-amber-200" : "bg-white border-slate-100"
                      }`}
                    >
                      <div>
                        <span className={`text-[9px] font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2 ${flashcardFlipped ? "text-amber-700" : "text-indigo-600"}`}>
                          {flashcardFlipped ? <><Lightbulb className="w-3 h-3" /> Exam Tip</> : "Question"}
                        </span>
                        <div className={`text-xs font-medium leading-relaxed ${flashcardFlipped ? "text-amber-800" : "text-slate-700"}`}>
                          <RichText inline>{flashcardFlipped ? currentQ.examTrick : currentQ.question}</RichText>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-3">
                        <RotateCcw className="w-3 h-3" /> Tap to {flashcardFlipped ? "see the question" : "reveal the tip"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setQuizIdx((quizIdx - 1 + activeQuestions.length) % activeQuestions.length); setFlashcardFlipped(false); }}
                        className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 flex items-center justify-center gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Previous
                      </button>
                      <button
                        onClick={() => { setQuizIdx((quizIdx + 1) % activeQuestions.length); setFlashcardFlipped(false); }}
                        className="flex-1 py-2 bg-indigo-600 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5"
                      >
                        Next <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {simulatorScreen === "mock" && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="px-4 py-2.5 flex items-center bg-white border-b border-slate-100">
                    <button onClick={() => goToTab("home")} className="text-slate-400 hover:text-slate-700">
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>
                  <div className="flex-1 p-5 space-y-4 text-center">
                    <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
                      <Clock className="w-7 h-7 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Full-Length Mock Arena</h4>
                      <p className="text-xs text-slate-400 mt-1">50 Questions • 60 Minutes • Negative Marking</p>
                    </div>
                    <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-left text-[11px] text-slate-600 space-y-1.5">
                      <div>✓ Real-time countdown clock</div>
                      <div>✓ Question grid palette (visited, flagged)</div>
                      <div>✓ Automated score report</div>
                    </div>
                    <button
                      onClick={() => { setSimulatorScreen("quiz"); resetQuizState(); }}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-xs text-white"
                    >
                      Start Mock Exam
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom tab bar — persistent across every simulator screen */}
              <div className="shrink-0 border-t border-slate-100 bg-white px-2 py-2 flex items-center justify-around">
                {BOTTOM_TABS.map((tab) => {
                  const active = simulatorScreen === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => goToTab(tab.key)}
                      className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${active ? "text-indigo-600" : "text-slate-400"}`}
                    >
                      <tab.icon className="w-4.5 h-4.5" />
                      <span className="text-[9px] font-semibold">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Download & Installation Options */}
        <div className="lg:col-span-7 space-y-6">
          {/* Featured direct APK download */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">Fastest way to install</div>
                <h3 className="text-slate-900 text-lg font-bold">Download the prebuilt Android APK</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-md">No build step, no Expo account needed — just install the file on your Android phone.</p>
              </div>
            </div>
            <a
              href={APK_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              Download .apk
            </a>
          </div>

          {/* Installation Method Selector */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1.5">
            <button
              onClick={() => setSelectedTab("eas-apk")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                selectedTab === "eas-apk"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <AndroidGlyph className={`w-3.5 h-3.5 ${selectedTab === "eas-apk" ? "text-emerald-400" : "text-emerald-600"}`} />
              Android APK
            </button>
            <button
              onClick={() => setSelectedTab("expo-go")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                selectedTab === "expo-go"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              Expo Go (Instant)
            </button>
            <button
              onClick={() => setSelectedTab("download")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                selectedTab === "download"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Build It Yourself
            </button>
          </div>

          {/* TAB: Android APK */}
          {selectedTab === "eas-apk" && (
            <div className="bg-white border border-slate-100 shadow-3xs rounded-2xl p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <span className="text-lg">📱</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Install the standalone Android APK</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct installable build for any Android device — no Google Play Store or Expo account needed.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <code className="text-[11px] text-emerald-400 font-mono break-all">{APK_DOWNLOAD_URL}</code>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyToClipboard(APK_DOWNLOAD_URL, 300)}
                    className="p-2 text-slate-400 hover:text-white"
                    title="Copy link"
                  >
                    {copiedIndex === 300 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={APK_DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-white"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-3 h-3 text-white" />
                </div>
                <div className="text-xs text-blue-900">
                  <strong>How it installs:</strong> Open the link above on your Android phone (or scan/share it there), tap <em>Download</em>, then <em>Install</em>. You may need to allow "Install unknown apps" for your browser once.
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-semibold text-slate-500">Need a fresh build instead? Run it yourself via Expo Cloud:</div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 flex items-center justify-between">
                  <span>cd mobile &amp;&amp; npx eas build -p android --profile preview</span>
                  <button
                    onClick={() => copyToClipboard("cd mobile && npx eas build -p android --profile preview", 100)}
                    className="p-1 text-slate-400 hover:text-white shrink-0"
                  >
                    {copiedIndex === 100 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Instant Expo Go (Scan & Play) */}
          {selectedTab === "expo-go" && (
            <div className="bg-white border border-slate-100 shadow-3xs rounded-2xl p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <span className="text-lg">⚡</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Instant Live Run via Expo Go (30 Seconds)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Test the native app on your physical iPhone or Android device instantly without compiling.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    step: "1",
                    title: "Install 'Expo Go' app from Play Store or iOS App Store on your phone",
                    cmd: "Free on App Store & Google Play"
                  },
                  {
                    step: "2",
                    title: "Start Expo in the /mobile directory",
                    cmd: "cd mobile && npx expo start"
                  },
                  {
                    step: "3",
                    title: "Scan the terminal QR code with your phone camera",
                    cmd: "Instant live reload on device"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                        {item.step}
                      </span>
                      {item.title}
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <code className="text-xs text-emerald-300 font-mono font-bold">{item.cmd}</code>
                      <button
                        onClick={() => copyToClipboard(item.cmd, 200 + idx)}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Copy command"
                      >
                        {copiedIndex === 200 + idx ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Build from source */}
          {selectedTab === "download" && (
            <div className="bg-white border border-slate-100 shadow-3xs rounded-2xl p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-lg">🔧</span>
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Build the app from source</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    The complete standalone mobile codebase — all assets, configs, and the same {TOTAL_COUNT.toLocaleString()}-question bundle used on the web — lives in the <code className="font-mono text-slate-700 bg-slate-100 px-1 rounded">mobile/</code> folder of this repository.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-600">Run on your machine:</div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 flex items-center justify-between">
                  <span>cd mobile &amp;&amp; npm install &amp;&amp; npx expo start</span>
                  <button
                    onClick={() => copyToClipboard("cd mobile && npm install && npx expo start", 99)}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedIndex === 99 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Architecture Highlights */}
          <div className="bg-white border border-slate-100 shadow-3xs rounded-2xl p-6">
            <h3 className="font-display text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-slate-400" />
              One Curriculum, Bundled On-Device
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-purple-50 border border-purple-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-500 flex items-center justify-center shrink-0">
                    <Database className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-purple-800">Claude CCAF</span>
                </div>
                <div className="text-purple-700/80">{CCAF_COUNT.toLocaleString()} questions across 8 subjects, generated from the same content/ tree as the web build.</div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                    <Database className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-amber-800">CIL MT CS</span>
                </div>
                <div className="text-amber-700/80">{CIL_COUNT.toLocaleString()} questions across 17 subjects, kept in sync via scripts/build-mobile-content.ts.</div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-blue-800">No network fetch</span>
                </div>
                <div className="text-blue-700/80">The whole bundle ships inside the app binary — instant startup, fully offline, no loading spinners.</div>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-bold text-emerald-800">Shared design system</span>
                </div>
                <div className="text-emerald-700/80">Colors, spacing, and components mirror the web's Tailwind palette exactly — one product, two shells.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
