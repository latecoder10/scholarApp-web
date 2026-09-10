/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo } from "react";
import {
  Play,
  Award,
  BookOpen,
  AlertTriangle,
  Clock,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  XCircle,
  Sparkles,
  Lightbulb
} from "lucide-react";
import { Subject, UserProgress, Chapter, parseProgressKey } from "../types";
import { EXAM_REGISTRY, getExamById, resolveExamForSubject, resolveExamForEntry } from "../../shared/exams";
import { compareSubjects } from "../../shared/sorting";
import { getExamIcon, getExamColorClasses, getColorClasses } from "../lib/examTheme";

interface DashboardProps {
  subjects: Subject[];
  progress: UserProgress;
  selectedExam: string; // 'all' or an ExamDefinition.id from shared/exams.ts
  onOpenExamSelector: () => void;
  onSelectChapter: (subject: string, chapter: Chapter) => void;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ 
  subjects, 
  progress, 
  selectedExam, 
  onOpenExamSelector, 
  onSelectChapter, 
  onNavigate 
}: DashboardProps) {
  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedExam]);

  // Filter subjects according to selectedExam
  const filteredSubjects = useMemo(
    () =>
      subjects.filter((s) => {
        if (selectedExam === "all") return true;
        return resolveExamForSubject(s).id === selectedExam;
      }),
    [subjects, selectedExam]
  );

  // Mock Tests is a subject bucket, not a curriculum domain — exclude it from the domain grid display.
  const domainSubjects = useMemo(
    () =>
      filteredSubjects
        .filter((s) => s.name !== "Mock Tests" && !s.name.toLowerCase().includes("mock"))
        .slice()
        .sort(compareSubjects),
    [filteredSubjects]
  );

  const currentExamConfig = getExamById(selectedExam) || EXAM_REGISTRY[0];
  const ActiveExamIcon = getExamIcon(currentExamConfig);
  const activeColors = getExamColorClasses(currentExamConfig);

  // 1. Calculate overall stats for active view
  const totalQuestions = filteredSubjects.reduce((sum, s) => sum + s.totalQuestions, 0);

  // Filter attempted keys to active subjects
  const activeAttemptedKeys = useMemo(() => {
    const subjectNames = new Set(filteredSubjects.map(s => s.name));
    return Object.keys(progress.answeredQuestions).filter(key => {
      const entry = progress.answeredQuestions[key];
      const parsed = parseProgressKey(key, entry);
      return subjectNames.has(parsed.subject);
    });
  }, [progress.answeredQuestions, filteredSubjects]);

  const totalAttempted = activeAttemptedKeys.length;
  
  const correctCount = activeAttemptedKeys.filter(
    (key) => progress.answeredQuestions[key].isCorrect
  ).length;

  const overallAccuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
  const overallCoverage = totalQuestions > 0 ? Math.round((totalAttempted / totalQuestions) * 100) : 0;

  // Filter mistakes count by selected exam track
  const filteredMistakes = useMemo(
    () =>
      (progress.mistakes || []).filter(m => {
        if (selectedExam === "all") return true;
        return resolveExamForEntry(m).id === selectedExam;
      }),
    [progress.mistakes, selectedExam]
  );

  // Calculate very sure percentage
  const verySureCount = activeAttemptedKeys.filter(
    (key) => progress.answeredQuestions[key].confidence === "Very Sure"
  ).length;
  const verySureRatio = totalAttempted > 0 ? verySureCount / totalAttempted : 0;

  // Readiness Score: Weighted combination of coverage (40%), accuracy (40%), and high confidence ratio (20%)
  const readinessScore = Math.round(
    (overallCoverage * 0.4) + (overallAccuracy * 0.4) + (verySureRatio * 100 * 0.2)
  );

  // 2. Identify weak chapters (< 60% accuracy or heavily missed)
  const chaptersWithAttempts = useMemo(() => {
    // One pass over attempted keys to tally per-chapter stats, instead of
    // rescanning all attempted keys for every chapter (was O(attempted x chapters)).
    const statsByChapterKey = new Map<string, { attempted: number; correct: number }>();
    activeAttemptedKeys.forEach((key) => {
      const entry = progress.answeredQuestions[key];
      const parsed = parseProgressKey(key, entry);
      const chapterKey = `${parsed.subject}:${parsed.chapterId}`;
      const stats = statsByChapterKey.get(chapterKey) || { attempted: 0, correct: 0 };
      stats.attempted++;
      if (entry.isCorrect) stats.correct++;
      statsByChapterKey.set(chapterKey, stats);
    });

    const result: { chapter: Chapter; attempted: number; correct: number; accuracy: number }[] = [];
    filteredSubjects.forEach((subj) => {
      subj.chapters.forEach((chap) => {
        const stats = statsByChapterKey.get(`${subj.name}:${chap.id}`);
        if (stats && stats.attempted > 0) {
          result.push({
            chapter: chap,
            attempted: stats.attempted,
            correct: stats.correct,
            accuracy: Math.round((stats.correct / stats.attempted) * 100)
          });
        }
      });
    });
    return result;
  }, [activeAttemptedKeys, progress.answeredQuestions, filteredSubjects]);

  // Sort by accuracy (lowest first) to find weak chapters
  const weakChapters = chaptersWithAttempts
    .filter((c) => c.accuracy < 60 || (c.attempted - c.correct) > 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // 3. Continue Learning: Find chapter with recent activity in filtered subjects OR first unattempted
  let continueChapter: { subjectName: string; chapter: Chapter } | null = null;
  
  if (progress.recentActivity.length > 0) {
    for (const recent of progress.recentActivity) {
      const matchSubject = filteredSubjects.find((s) => s.name === recent.subject);
      if (matchSubject) {
        const matchChapter = matchSubject.chapters.find((c) => c.id === recent.chapterId);
        if (matchChapter) {
          continueChapter = { subjectName: matchSubject.name, chapter: matchChapter };
          break;
        }
      }
    }
  }

  // Fallback: If no activity, suggest first unattempted chapter in filtered list
  if (!continueChapter && filteredSubjects.length > 0) {
    for (const subj of filteredSubjects) {
      for (const chap of subj.chapters) {
        const chapKeys = activeAttemptedKeys.filter(k => k.startsWith(`${subj.name}:${chap.id}:`));
        if (chapKeys.length < chap.questionsCount) {
          continueChapter = { subjectName: subj.name, chapter: chap };
          break;
        }
      }
      if (continueChapter) break;
    }
  }

  // Fallback 2: Grab the first chapter
  if (!continueChapter && filteredSubjects.length > 0 && filteredSubjects[0].chapters.length > 0) {
    continueChapter = { subjectName: filteredSubjects[0].name, chapter: filteredSubjects[0].chapters[0] };
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 w-full max-w-7xl mx-auto">
      {/* 1. Page Header matching AnalyticsView convention */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            {selectedExam === "all" ? "OVERVIEW" : `${currentExamConfig.shortName} OVERVIEW`}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Dashboard
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            {currentExamConfig.description}
          </p>
        </div>
      </div>

      {/* 2. Top Stats Grid - Proportional, Uniform Height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Coverage Widget */}
        <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6366F1] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {overallCoverage}%
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Syllabus Coverage ({totalAttempted}/{totalQuestions})
            </div>
          </div>
        </div>

        {/* Accuracy Widget */}
        <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#E0EEFD] text-[#2563EB] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {overallAccuracy}%
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Test Accuracy ({correctCount} solved)
            </div>
          </div>
        </div>

        {/* Readiness Score Widget */}
        <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#10B981] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {readinessScore}%
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Readiness Index ({currentExamConfig.readinessTargetLabel || "Mastery Level"})
            </div>
          </div>
        </div>

        {/* Mistakes Widget */}
        <div 
          onClick={() => onNavigate("mistakes")}
          className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5 cursor-pointer hover:border-orange-200 transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FEE8D8] text-[#EA580C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {filteredMistakes.length}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate flex items-center gap-1 group-hover:text-orange-600 transition-colors">
              Mistake Book <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Track-Specific Domain / Paper Overview */}
      {selectedExam !== "all" && (!currentExamConfig.papers || currentExamConfig.papers.length === 0) ? (
        <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#4F46E5]" />
              <h3 className="font-display text-base font-bold text-slate-900">
                {currentExamConfig.name} Curriculum Domains
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-lg">
              {domainSubjects.length} domains • {totalQuestions} questions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {domainSubjects.map((sub, idx) => {
              const subQuestions = sub.totalQuestions;
              const subAttempted = activeAttemptedKeys.filter(k => k.startsWith(`${sub.name}:`)).length;
              const subCoverage = subQuestions > 0 ? Math.round((subAttempted / subQuestions) * 100) : 0;

              return (
                <div
                  key={sub.name}
                  onClick={() => onNavigate("subjects")}
                  className="p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${activeColors.badgeBg} ${activeColors.badgeText}`}>
                      {sub.paper ? sub.paper.replace(/-/g, " ") : `Domain ${idx + 1}`}
                    </span>
                    <span className="text-xs font-mono text-slate-400 font-semibold">{sub.chapters.length} Modules</span>
                  </div>
                  <h4 className="font-display font-bold text-slate-800 text-sm mt-2 group-hover:text-indigo-600 transition-colors">
                    {sub.name}
                  </h4>
                  <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span>{subAttempted}/{subQuestions} solved</span>
                    <span className="font-bold text-slate-700">{subCoverage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${activeColors.solidBg}`} style={{ width: `${subCoverage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : selectedExam !== "all" && currentExamConfig.papers ? (
        <div className={`grid grid-cols-1 gap-6 ${currentExamConfig.papers.length > 1 ? "md:grid-cols-2" : ""}`}>
          {currentExamConfig.papers.map((paper) => {
            const paperColors = getColorClasses(paper.color || currentExamConfig.color);
            return (
              <div key={paper.id} className="bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs relative overflow-hidden">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#4F46E5]" />
                    <div>
                      {paper.stageLabel && (
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md uppercase border ${paperColors.badgeBg} ${paperColors.badgeBorder} ${paperColors.badgeText} mr-2`}>
                          {paper.stageLabel}
                        </span>
                      )}
                      <span className="font-display font-bold text-slate-900 text-sm">{paper.fullLabel || paper.label}</span>
                    </div>
                  </div>
                  {paper.tag && (
                    <span className="text-xs font-mono text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-md">{paper.tag}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold font-mono block tracking-wider">COVERAGE</span>
                    <span className="text-xl font-bold text-slate-800 font-display">{overallCoverage}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold font-mono block tracking-wider">ACCURACY</span>
                    <span className="text-xl font-bold text-slate-800 font-display">{overallAccuracy}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${paperColors.solidBg}`} style={{ width: `${overallCoverage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* All Examinations View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EXAM_REGISTRY.map((exam) => {
            const Icon = getExamIcon(exam);
            const colors = getExamColorClasses(exam);
            return (
              <div
                key={exam.id}
                onClick={() => onNavigate("subjects")}
                className={`bg-white border border-slate-100 hover:border-indigo-200 p-5 sm:p-6 rounded-2xl shadow-3xs hover:shadow-2xs transition-all cursor-pointer relative overflow-hidden group`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl ${colors.iconBg} ${colors.iconText}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${colors.badgeBg} ${colors.badgeText}`}>
                      {exam.category}
                    </span>
                    <h4 className="font-display font-bold text-slate-900 text-base">{exam.shortName}</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {exam.tagline}
                </p>
                <div className={`mt-4 flex items-center justify-between text-xs font-mono font-bold ${colors.badgeText}`}>
                  <span>{exam.trackCardCta || `Explore ${exam.shortName} Curriculum`}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Action and Info Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Continue Learning & Weak Areas */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Continue Learning */}
          {continueChapter && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold tracking-wide uppercase">
                      {continueChapter.subjectName}
                    </span>
                    {continueChapter.chapter.exam && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-mono font-semibold">
                        {continueChapter.chapter.exam}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">
                    {continueChapter.chapter.name}
                  </h3>
                  <p className="text-slate-500 text-xs line-clamp-1">
                    {continueChapter.chapter.description || "Pick up where you left off to accelerate your exam readiness."}
                  </p>
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                    <span>Questions: <strong>{continueChapter.chapter.questionsCount}</strong></span>
                    <span>•</span>
                    <span>Attempted: <strong>{
                      activeAttemptedKeys.filter(k => k.startsWith(`${continueChapter!.subjectName}:${continueChapter!.chapter.id}:`)).length
                    }</strong></span>
                  </div>
                </div>
                <button 
                  onClick={() => onSelectChapter(continueChapter!.subjectName, continueChapter!.chapter)}
                  className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-3xs hover:shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white text-white" /> Continue Practice
                </button>
              </div>
            </div>
          )}

          {/* Weak Chapters (If any exist) */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#EA580C]" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Areas to Focus On
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">Accuracy below 60%</span>
            </div>

            {weakChapters.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {weakChapters.map(({ chapter, attempted, correct, accuracy }) => (
                  <div key={chapter.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 font-display">{chapter.name}</span>
                        <span className="text-xs text-slate-400 font-mono">({chapter.subject})</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span>Attempted: <strong>{attempted}</strong></span>
                        <span>•</span>
                        <span>Correct: <strong className="text-emerald-500">{correct}</strong></span>
                        <span>•</span>
                        <span>Accuracy: <strong className="text-rose-500">{accuracy}%</strong></span>
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectChapter(chapter.subject, chapter)}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all shrink-0 self-start sm:self-center cursor-pointer"
                    >
                      Practice <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
                <p className="text-sm text-slate-500 mt-2 font-medium">No weak areas yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Keep practicing and we'll flag chapters that need more work.</p>
              </div>
            )}
          </div>

          {/* Quick Help / Exam Guide Info */}
          <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl flex items-start gap-3.5">
            <div className="p-2 bg-[#EDE9FE] text-[#6366F1] rounded-xl shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 font-display">
                {currentExamConfig.strategyTip?.title || "Study Strategy Tip"}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                {currentExamConfig.strategyTip?.body ||
                  "Exam Scholar covers both technical disciplines and AI architecture certifications. Use the Revision Engine to build custom multi-topic practice sets and the Mistakes page to eliminate recurring errors."}
              </p>
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Recent Activity Feed */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs h-full flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="font-display text-base font-bold text-slate-900">
                  Recent Activity
                </h3>
              </div>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Live</span>
            </div>

            {progress.recentActivity.length > 0 ? (
              <div className="space-y-4 overflow-y-auto max-h-[420px] pr-1 flex-1">
                {progress.recentActivity.slice(0, 10).map((activity, idx) => (
                  <div key={idx} className="flex gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className="z-10">
                        {activity.isCorrect ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500 bg-white rounded-full" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500 bg-white rounded-full" />
                        )}
                      </div>
                      {idx !== progress.recentActivity.slice(0, 10).length - 1 && (
                        <div className="w-0.5 bg-slate-100 flex-1 my-1" />
                      )}
                    </div>
                    <div className="pb-4 last:pb-0 space-y-1">
                      <div className="text-xs font-semibold text-slate-800 leading-none">
                        Question #{activity.questionId} in {activity.chapterName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {activity.subject} • {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex gap-1.5 pt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          activity.confidence === "Very Sure" 
                            ? "bg-indigo-50 text-indigo-700" 
                            : activity.confidence === "Somewhat Sure"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                        }`}>
                          {activity.confidence}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/30 flex-1">
                <Clock className="w-8 h-8 text-slate-300 stroke-1" />
                <p className="text-sm text-slate-500 mt-2 font-medium">No activity yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Your recent answers will show up here.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
