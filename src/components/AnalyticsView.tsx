/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  FileText,
  HelpCircle,
  Target,
  Compass,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Check,
  Calendar,
  Sparkles,
  Info,
  ShieldCheck,
  Wrench,
  Layers,
  MessageSquare,
  Box,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
} from "recharts";
import { Subject, UserProgress, parseProgressKey } from "../types";
import { getExamById, resolveExamForSubject, ALL_TRACKS_OPTION } from "../../shared/exams";

interface AnalyticsViewProps {
  subjects: Subject[];
  progress: UserProgress;
  selectedExam?: string;
  onNavigate?: (tab: string) => void;
  onOpenExamSelector?: () => void;
}

type DateRangeKey = "7d" | "30d" | "90d" | "all";

const DATE_RANGES: { key: DateRangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "all", label: "All Time", days: null },
];

type AnsweredEntry = UserProgress["answeredQuestions"][string];

function dayKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekKey(ts: string): string {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatSubjectDisplayName(fullName: string): { title: string; trackPrefix?: string } {
  const match = fullName.match(/^(Claude CCAF|CIL MT|GATE CS|UPSC CSAT|UPSC Civil Services|AWS SAA):\s*(.+)$/i);
  if (match) {
    return { trackPrefix: match[1], title: match[2].trim() };
  }
  return { title: fullName };
}

// Visual icons and color accents matching the wireframe specification
interface SubjectVisualConfig {
  icon: LucideIcon;
  bg: string;
  text: string;
  barColor: string;
}

function getSubjectVisual(name: string): SubjectVisualConfig {
  const n = name.toLowerCase();
  if (n.includes("agentic") || n.includes("architecture")) {
    return { icon: Layers, bg: "bg-purple-50", text: "text-purple-600", barColor: "bg-[#4F46E5]" };
  }
  if (n.includes("claude code") || n.includes("workflow")) {
    return { icon: FileText, bg: "bg-blue-50", text: "text-blue-600", barColor: "bg-blue-600" };
  }
  if (n.includes("context") || n.includes("reliability")) {
    return { icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-600", barColor: "bg-emerald-500" };
  }
  if (n.includes("mcp integration") || n.includes("tool design & mcp")) {
    return { icon: Wrench, bg: "bg-orange-50", text: "text-orange-600", barColor: "bg-orange-500" };
  }
  if (n.includes("mcp & tool design") || n.includes("mcp")) {
    return { icon: Box, bg: "bg-purple-50", text: "text-purple-600", barColor: "bg-[#4F46E5]" };
  }
  if (n.includes("mock")) {
    return { icon: Target, bg: "bg-purple-50", text: "text-purple-600", barColor: "bg-slate-300" };
  }
  if (n.includes("structured output") || n.includes("prompt engineering & structured")) {
    return { icon: FileText, bg: "bg-blue-50", text: "text-blue-600", barColor: "bg-blue-600" };
  }
  if (n.includes("extraction") || n.includes("prompt engineering & extraction")) {
    return { icon: MessageSquare, bg: "bg-emerald-50", text: "text-emerald-600", barColor: "bg-slate-300" };
  }
  return { icon: BookOpen, bg: "bg-indigo-50", text: "text-indigo-600", barColor: "bg-indigo-600" };
}

export default function AnalyticsView({
  subjects,
  progress,
  selectedExam = "claude-ccaf",
  onNavigate,
  onOpenExamSelector,
}: AnalyticsViewProps) {
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"readiness" | "accuracy" | "coverage" | "name">("readiness");

  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedExam]);

  const currentExamConfig =
    selectedExam === "all" ? ALL_TRACKS_OPTION : getExamById(selectedExam) || ALL_TRACKS_OPTION;

  const activeRange = DATE_RANGES.find((r) => r.key === dateRange) || DATE_RANGES[1];

  const rangeStart = useMemo(() => {
    if (activeRange.days == null) return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (activeRange.days - 1));
    return d;
  }, [activeRange]);

  const prevRangeStart = useMemo(() => {
    if (!rangeStart || activeRange.days == null) return null;
    const d = new Date(rangeStart);
    d.setDate(d.getDate() - activeRange.days);
    return d;
  }, [rangeStart, activeRange]);

  // Filter curriculum subjects according to active exam
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (selectedExam === "all") return true;
      return resolveExamForSubject(s).id === selectedExam;
    });
  }, [subjects, selectedExam]);

  const allAttemptedKeys = Object.keys(progress.answeredQuestions);

  // Filter attempted keys strictly to the active subjects
  const activeAttemptedKeysAll = useMemo(() => {
    return allAttemptedKeys.filter((key) => {
      if (selectedExam === "all") return true;
      const entry = progress.answeredQuestions[key];
      const parsed = parseProgressKey(key, entry);
      return filteredSubjects.some((s) => s.name === parsed.subject);
    });
  }, [allAttemptedKeys, progress.answeredQuestions, selectedExam, filteredSubjects]);

  const inRange = (entry: AnsweredEntry | undefined, start: Date | null, end: Date | null): boolean => {
    if (!entry) return false;
    if (!start) return true;
    const t = new Date(entry.timestamp).getTime();
    if (Number.isNaN(t)) return true;
    if (t < start.getTime()) return false;
    if (end && t >= end.getTime()) return false;
    return true;
  };

  const activeAttemptedKeys = useMemo(() => {
    if (!rangeStart) return activeAttemptedKeysAll;
    return activeAttemptedKeysAll.filter((key) => {
      const entry = progress.answeredQuestions[key];
      return inRange(entry, rangeStart, null);
    });
  }, [activeAttemptedKeysAll, progress.answeredQuestions, rangeStart]);

  const prevRangeAttemptedKeys = useMemo(() => {
    if (!rangeStart || !prevRangeStart) return [];
    return activeAttemptedKeysAll.filter((key) => {
      const entry = progress.answeredQuestions[key];
      return inRange(entry, prevRangeStart, rangeStart);
    });
  }, [activeAttemptedKeysAll, progress.answeredQuestions, prevRangeStart, rangeStart]);

  // Top 4 card numbers: Domains, Chapters, Practice Questions, Readiness Score
  const totalDomainsCount = useMemo(() => {
    const nonMock = filteredSubjects.filter((s) => !s.name.toLowerCase().includes("mock"));
    return nonMock.length;
  }, [filteredSubjects]);

  const totalChaptersCount = useMemo(() => {
    return filteredSubjects.reduce((acc, s) => acc + (s.chapters?.length || 0), 0);
  }, [filteredSubjects]);

  const totalQuestionsCount = useMemo(() => {
    return filteredSubjects.reduce((acc, s) => {
      const chQ = (s.chapters || []).reduce((cAcc, ch) => cAcc + (ch.questionsCount || 0), 0);
      return acc + (s.totalQuestions || chQ || 0);
    }, 0);
  }, [filteredSubjects]);

  // Total attempted & Accuracy calculations
  const totalAttempted = useMemo(() => {
    return activeAttemptedKeys.length;
  }, [activeAttemptedKeys.length]);

  const correctAnswers = useMemo(() => {
    return activeAttemptedKeys.filter((key) => progress.answeredQuestions[key]?.isCorrect).length;
  }, [activeAttemptedKeys, progress.answeredQuestions]);

  const overallAccuracy = useMemo(() => {
    if (totalAttempted === 0) return 0;
    return Math.round((correctAnswers / totalAttempted) * 100);
  }, [totalAttempted, correctAnswers]);

  // Previous window accuracy for delta calculation
  const accuracyDelta = useMemo(() => {
    if (prevRangeAttemptedKeys.length === 0) return null;
    const prevCorrect = prevRangeAttemptedKeys.filter(
      (key) => progress.answeredQuestions[key]?.isCorrect
    ).length;
    const prevAccuracy = Math.round((prevCorrect / prevRangeAttemptedKeys.length) * 100);
    return overallAccuracy - prevAccuracy;
  }, [prevRangeAttemptedKeys, progress.answeredQuestions, overallAccuracy]);

  // Overall Readiness calculation
  const readinessScore = useMemo(() => {
    if (totalQuestionsCount === 0) return 0;
    const coverageFactor = Math.min(totalAttempted / totalQuestionsCount, 1);
    const accuracyFactor = totalAttempted > 0 ? correctAnswers / totalAttempted : 0;
    return Math.min(100, Math.round(coverageFactor * 40 + accuracyFactor * 60));
  }, [totalQuestionsCount, totalAttempted, correctAnswers]);

  const readinessDelta = useMemo(() => {
    if (prevRangeAttemptedKeys.length === 0) return null;
    const prevCorrect = prevRangeAttemptedKeys.filter(
      (key) => progress.answeredQuestions[key]?.isCorrect
    ).length;
    const prevAttempted = prevRangeAttemptedKeys.length;
    const prevAccuracy = prevAttempted > 0 ? Math.round((prevCorrect / prevAttempted) * 100) : 0;
    if (totalQuestionsCount === 0) return null;
    const prevCoverageFactor = Math.min(prevAttempted / totalQuestionsCount, 1);
    const prevAccuracyFactor = prevAttempted > 0 ? prevCorrect / prevAttempted : 0;
    const prevReadiness = Math.min(100, Math.round(prevCoverageFactor * 40 + prevAccuracyFactor * 60));
    return readinessScore - prevReadiness;
  }, [prevRangeAttemptedKeys, progress.answeredQuestions, readinessScore, totalQuestionsCount]);

  // Readiness Tier & Motivation text
  const readinessTier = useMemo(() => {
    if (readinessScore >= 80) return "Mastery Level";
    if (readinessScore >= 50) return "Building Momentum";
    if (readinessScore >= 25) return "Developing Foundation";
    return "Getting Started";
  }, [readinessScore]);

  const readinessHeadline = useMemo(() => {
    if (totalAttempted === 0) return "Start practicing to build your readiness score.";
    if (readinessScore >= 80) return "Excellent progress! You're well prepared for the exam.";
    if (readinessScore >= 50) return "Good momentum! Keep practicing to push your readiness higher.";
    return "You're on the right track! Keep increasing your chapter coverage to improve your readiness.";
  }, [readinessScore, totalAttempted]);

  const rankDesc = useMemo(() => {
    if (readinessScore >= 80) return "Outstanding mastery. Consistently high accuracy across key concepts.";
    if (readinessScore >= 50) return "Good foundation. Keep increasing chapter coverage to move up.";
    return "Start practicing chapters and mock tests to build your readiness.";
  }, [readinessScore]);

  // Subject Performance table data
  const subjectStats = useMemo(() => {
    return filteredSubjects.map((sub) => {
      const subKeys = activeAttemptedKeys.filter((key) => {
        const entry = progress.answeredQuestions[key];
        const parsed = parseProgressKey(key, entry);
        return parsed.subject === sub.name;
      });

      const attempted = subKeys.length;
      const correct = subKeys.filter((k) => progress.answeredQuestions[k]?.isCorrect).length;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;

      // Distinct chapters attempted
      const attemptedChapterIds = new Set<string>();
      subKeys.forEach((key) => {
        const entry = progress.answeredQuestions[key];
        const parsed = parseProgressKey(key, entry);
        if (parsed.chapterId) attemptedChapterIds.add(parsed.chapterId);
      });
      const attemptedChapters = attemptedChapterIds.size;
      const totalChapters = sub.chapters?.length || 0;

      const progressPercentage =
        totalChapters > 0 ? Math.round((attemptedChapters / totalChapters) * 100) : 0;

      let statusLabel = "Not Started";
      let statusClasses = "bg-[#F1F5F9] text-[#64748B]";

      if (attemptedChapters > 0) {
        if (accuracy !== null && accuracy >= 80 && progressPercentage >= 40) {
          statusLabel = "On Track";
          statusClasses = "bg-[#ECFDF5] text-[#059669]";
        } else if (accuracy !== null && accuracy < 75) {
          statusLabel = "Needs Focus";
          statusClasses = "bg-[#FEF2F2] text-[#DC2626]";
        } else {
          statusLabel = "Keep Going";
          statusClasses = "bg-[#EFF6FF] text-[#2563EB]";
        }
      }

      return {
        name: sub.name,
        chapters: totalChapters,
        progressPercentage,
        accuracy,
        attemptedChapters,
        attempted,
        statusLabel,
        statusClasses,
        visual: getSubjectVisual(sub.name),
      };
    });
  }, [filteredSubjects, activeAttemptedKeys, progress.answeredQuestions]);

  // Sort subject stats according to current selector
  const sortedSubjectStats = useMemo(() => {
    return [...subjectStats].sort((a, b) => {
      if (sortBy === "accuracy") {
        return (b.accuracy ?? -1) - (a.accuracy ?? -1);
      }
      if (sortBy === "coverage") {
        return b.attemptedChapters - a.attemptedChapters;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return b.progressPercentage - a.progressPercentage;
    });
  }, [subjectStats, sortBy]);

  // Confidence Breakdown
  const confidenceStats = useMemo(() => {
    const levels = ["Guess", "Somewhat Sure", "Very Sure"] as const;
    return levels.map((level) => {
      const keys = activeAttemptedKeys.filter(
        (key) => progress.answeredQuestions[key]?.confidence === level
      );
      const count = keys.length;
      const correct = keys.filter((key) => progress.answeredQuestions[key]?.isCorrect).length;
      const accuracy = count > 0 ? Math.round((correct / count) * 100) : 0;
      let color = "bg-[#EA580C]";
      if (level === "Somewhat Sure") color = "bg-[#2563EB]";
      if (level === "Very Sure") color = "bg-[#10B981]";
      return { level, count, accuracy, color };
    });
  }, [activeAttemptedKeys, progress.answeredQuestions]);

  // Progress Over Time Chart Data
  const trendData = useMemo(() => {
    if (activeAttemptedKeys.length === 0) return [];

    const daysCount = activeRange.days ?? 30;
    const isWeekly = daysCount > 30;
    const grouping = new Map<string, { attempted: number; correct: number }>();

    activeAttemptedKeys.forEach((key) => {
      const item = progress.answeredQuestions[key];
      if (!item || !item.timestamp) return;
      const groupKey = isWeekly ? weekKey(item.timestamp) : dayKey(item.timestamp);
      const curr = grouping.get(groupKey) || { attempted: 0, correct: 0 };
      curr.attempted++;
      if (item.isCorrect) curr.correct++;
      grouping.set(groupKey, curr);
    });

    const entries = Array.from(grouping.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    return entries.map(([k, v]) => ({
      label: formatDayLabel(k),
      questions: v.attempted,
      accuracy: v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0,
    }));
  }, [activeAttemptedKeys, progress.answeredQuestions, activeRange]);

  return (
    <div className="space-y-6 animate-fade-in pb-12 w-full max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            ANALYTICS
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Analytics
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Track your coverage, accuracy, and progress over time. Identify your strengths and focus on
            weak areas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Track Selector Pill */}
          <button
            type="button"
            onClick={onOpenExamSelector}
            className="inline-flex items-center gap-2 bg-white border border-slate-200/90 text-slate-700 text-xs px-3.5 py-2 rounded-xl shadow-3xs cursor-pointer hover:bg-slate-50 transition-all max-w-[240px]"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="font-medium text-slate-600 truncate">
              Track: <strong className="font-bold text-slate-900">{currentExamConfig.shortName}</strong>
            </span>
          </button>

          {/* Date Range Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRangeMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-medium px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-3xs"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{activeRange.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
            {rangeMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRangeMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 overflow-hidden">
                  {DATE_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => {
                        setDateRange(r.key);
                        setRangeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between text-left px-3.5 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 ${
                        r.key === dateRange ? "text-indigo-600 font-semibold" : "text-slate-600"
                      }`}
                    >
                      {r.label}
                      {r.key === dateRange && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top 4 Stat Cards - Proportional, Uniform Height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Domains */}
        <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6366F1] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {totalDomainsCount}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">Total Domains</div>
          </div>
        </div>

        {/* Card 2: Total Chapters */}
        <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#E0EEFD] text-[#2563EB] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {totalChaptersCount}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">Total Chapters</div>
          </div>
        </div>

        {/* Card 3: Practice Questions */}
        <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#10B981] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {totalQuestionsCount}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">Practice Questions</div>
          </div>
        </div>

        {/* Card 4: Overall Readiness */}
        <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs flex flex-col justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#FEE8D8] text-[#EA580C] flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
                  {readinessScore}%
                </span>
                {readinessDelta != null && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] shrink-0">
                    +{Math.abs(readinessDelta)}%
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-slate-500 mt-0.5 truncate">
                Overall Readiness
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-[#4F46E5] h-full rounded-full transition-all duration-500"
              style={{ width: `${readinessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Middle Section: Overall Readiness (Left) + Subject Performance (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left Column: Overall Readiness */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs text-center flex flex-col justify-between flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#4F46E5]" />
              <h3 className="font-display text-base font-bold text-slate-900">Overall Readiness</h3>
            </div>

            {/* Donut Gauge */}
            <div className="relative w-40 h-40 sm:w-44 sm:h-44 mx-auto my-1 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 168 168">
                <circle
                  cx="84"
                  cy="84"
                  r="68"
                  stroke="#F1F5F9"
                  strokeWidth="13"
                  fill="none"
                />
                <circle
                  cx="84"
                  cy="84"
                  r="68"
                  stroke="#4F46E5"
                  strokeWidth="13"
                  strokeDasharray={427.26}
                  strokeDashoffset={427.26 - (427.26 * readinessScore) / 100}
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-3xl sm:text-4xl font-extrabold font-display text-slate-900 block leading-none tracking-tight">
                  {readinessScore}%
                </span>
                <span className="text-[10px] font-bold text-slate-400 block mt-1 tracking-widest uppercase">
                  READY
                </span>
              </div>
            </div>

            <p className="text-slate-500 text-xs text-center leading-relaxed max-w-xs mx-auto">
              {readinessHeadline}
            </p>

            {/* Motivation Banner */}
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 text-left flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 font-display">{readinessTier}</h4>
                <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed mt-0.5">{rankDesc}</p>
              </div>
            </div>

            {/* Dual Stats Box */}
            <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-3.5 grid grid-cols-2 text-left divide-x divide-slate-200/60">
              <div className="pr-2.5">
                <span className="text-[11px] text-slate-500 font-medium block leading-tight">
                  Questions Attempted
                </span>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display">
                    {totalAttempted}
                  </strong>
                  <span className="text-[11px] text-slate-400 font-normal">of {totalQuestionsCount}</span>
                </div>
              </div>
              <div className="pl-3 sm:pl-3.5">
                <span className="text-[11px] text-slate-500 font-medium block leading-tight">
                  Average Accuracy
                </span>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display">
                    {overallAccuracy}%
                  </strong>
                  {accuracyDelta != null && (
                    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#ECFDF5] text-[#059669]">
                      +{Math.abs(accuracyDelta)}%
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-normal mt-0.5 block">
                  vs. last period
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Subject Performance */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs flex flex-col justify-between flex-1 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#4F46E5]" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Subject Performance
                </h3>
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl pl-2.5 pr-7 py-1 cursor-pointer appearance-none shadow-3xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="readiness">Sort by: Readiness</option>
                  <option value="accuracy">Sort by: Accuracy</option>
                  <option value="coverage">Sort by: Coverage</option>
                  <option value="name">Sort by: Name</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="overflow-x-auto -mx-1">
              {sortedSubjectStats.length > 0 ? (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-2.5 pb-2.5 font-semibold">Subject</th>
                    <th className="px-2.5 pb-2.5 font-semibold w-28 sm:w-36">Progress</th>
                    <th className="px-2.5 pb-2.5 font-semibold text-right w-16">Accuracy</th>
                    <th className="px-2.5 pb-2.5 font-semibold text-right w-16">Coverage</th>
                    <th className="px-2.5 pb-2.5 font-semibold text-right w-24">Status</th>
                    <th className="w-6 pr-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSubjectStats.map((sub) => {
                    const RowIcon = sub.visual.icon;
                    const { title, trackPrefix } = formatSubjectDisplayName(sub.name);
                    return (
                      <tr
                        key={sub.name}
                        onClick={() => onNavigate && onNavigate("subjects")}
                        className={`group align-middle ${
                          onNavigate ? "cursor-pointer hover:bg-slate-50/70" : ""
                        } transition-colors`}
                      >
                        <td className="px-2.5 py-2.5 sm:py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${sub.visual.bg} ${sub.visual.text}`}
                            >
                              <RowIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </div>
                            <div className="min-w-0 pr-1 flex-1">
                              <div
                                className="text-xs sm:text-[13px] font-bold text-slate-900 font-display leading-snug truncate"
                                title={sub.name}
                              >
                                {title}
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                                {trackPrefix && <span>{trackPrefix} • </span>}
                                {sub.chapters > 0 ? `${sub.chapters} Chapters` : "Full Mock"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 sm:py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-14 sm:w-20 bg-slate-100 h-2 rounded-full overflow-hidden shrink-0">
                              <div
                                className={`${sub.visual.barColor} h-full rounded-full transition-all duration-300`}
                                style={{ width: `${sub.progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-7 text-right font-mono">
                              {sub.progressPercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 sm:py-3 text-right text-xs font-bold font-mono">
                          {sub.accuracy !== null ? (
                            <span className="text-emerald-600">{sub.accuracy}%</span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 sm:py-3 text-right text-xs font-mono text-slate-600 font-medium whitespace-nowrap">
                          {sub.attemptedChapters} / {sub.chapters}
                        </td>
                        <td className="px-2.5 py-2.5 sm:py-3 text-right">
                          <span
                            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${sub.statusClasses}`}
                          >
                            {sub.statusLabel}
                          </span>
                        </td>
                        <td className="pr-1 py-2.5 sm:py-3 text-right">
                          {onNavigate && (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors ml-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                <BookOpen className="w-10 h-10 text-slate-200" />
                <p className="text-xs text-slate-400 font-medium">No subjects found</p>
                <p className="text-[11px] text-slate-300">Add content packs to see subject performance data.</p>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Progress Over Time (Left) + Confidence vs. Accuracy (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Progress Over Time */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs flex flex-col justify-between flex-1">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
                <h3 className="font-display text-base font-bold text-slate-900">Progress Over Time</h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#818CF8] inline-block" /> Questions Attempted
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7] inline-block" /> Accuracy
                </span>
              </div>
            </div>

            <div className="h-60 sm:h-64 w-full">
              {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    width={32}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #F1F5F9",
                      fontSize: 12,
                      boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                    }}
                    labelStyle={{ fontWeight: 700, color: "#1E293B" }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="questions"
                    name="Questions Attempted"
                    fill="#818CF8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy"
                    stroke="#A855F7"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#A855F7", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                <BarChart3 className="w-10 h-10 text-slate-200" />
                <p className="text-xs text-slate-400 font-medium">No practice data yet</p>
                <p className="text-[11px] text-slate-300">Start answering questions to see your progress over time.</p>
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Confidence vs. Accuracy - Proportional 2-Line Layout */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs flex flex-col justify-between flex-1 space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#8B5CF6]" />
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Confidence vs. Accuracy
                  </h3>
                </div>
                <div className="group relative">
                  <button
                    type="button"
                    aria-label="Metacognitive Calibration info"
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-slate-500 text-xs leading-relaxed mt-2.5">
                How well your confidence matches your actual performance. Ideally, &quot;Very Sure&quot;
                answers should have the highest accuracy and &quot;Guess&quot; the lowest.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {confidenceStats.map((item) => (
                <div
                  key={item.level}
                  className="p-3 bg-slate-50/80 border border-slate-100/90 rounded-xl space-y-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {item.level}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        • {item.count > 0 ? `${item.count} response${item.count === 1 ? "" : "s"}` : "No responses"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-extrabold text-slate-900 font-mono">
                        {item.count > 0 ? `${item.accuracy}%` : "—"}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">acc</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${item.count > 0 ? item.accuracy : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
