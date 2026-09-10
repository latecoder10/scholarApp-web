/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight,
  Play, 
  RotateCcw,
  Share2,
  Code2,
  Database,
  Wrench,
  Box,
  FileText,
  MessageSquare
} from "lucide-react";
import { Subject, Chapter, UserProgress, parseProgressKey } from "../types";
import { resolveExamForSubject } from "../../shared/exams";
import { compareChapters } from "../../shared/sorting";
import { getExamColorClasses } from "../lib/examTheme";

function getChapterVisual(chapterName: string, index: number) {
  const name = chapterName.toLowerCase();
  if (name.includes("agent") || name.includes("orchestrat") || name.includes("network") || name.includes("graph") || name.includes("architecture")) {
    return { Icon: Share2, bg: "bg-indigo-50/70", text: "text-indigo-600" };
  }
  if (name.includes("configuration") || name.includes("code") || name.includes("workflow") || name.includes("sort") || name.includes("algorithm") || name.includes("parsing")) {
    return { Icon: Code2, bg: "bg-sky-50", text: "text-sky-600" };
  }
  if (name.includes("context") || name.includes("reliab") || name.includes("database") || name.includes("memory") || name.includes("cache") || name.includes("data")) {
    return { Icon: Database, bg: "bg-emerald-50", text: "text-emerald-600" };
  }
  if (name.includes("tool design") || name.includes("tool") || name.includes("mcp integration") || name.includes("optimization") || name.includes("pipeline")) {
    return { Icon: Wrench, bg: "bg-amber-50", text: "text-amber-600" };
  }
  if (name.includes("mcp & tool") || name.includes("mcp") || name.includes("system") || name.includes("operating") || name.includes("hardware") || name.includes("box")) {
    return { Icon: Box, bg: "bg-rose-50", text: "text-rose-600" };
  }
  if (name.includes("structured") || name.includes("prompt") && name.includes("output") || name.includes("schema") || name.includes("doc") || name.includes("theory")) {
    return { Icon: FileText, bg: "bg-violet-50", text: "text-violet-600" };
  }
  if (name.includes("extract") || name.includes("chat") || name.includes("message") || name.includes("eval") || name.includes("prompt")) {
    return { Icon: MessageSquare, bg: "bg-teal-50", text: "text-teal-600" };
  }

  const fallbacks = [
    { Icon: Share2, bg: "bg-indigo-50/70", text: "text-indigo-600" },
    { Icon: Code2, bg: "bg-sky-50", text: "text-sky-600" },
    { Icon: Database, bg: "bg-emerald-50", text: "text-emerald-600" },
    { Icon: Wrench, bg: "bg-amber-50", text: "text-amber-600" },
    { Icon: Box, bg: "bg-rose-50", text: "text-rose-600" },
    { Icon: FileText, bg: "bg-violet-50", text: "text-violet-600" },
    { Icon: MessageSquare, bg: "bg-teal-50", text: "text-teal-600" },
  ];
  return fallbacks[index % fallbacks.length];
}

interface SubjectViewProps {
  subject: Subject;
  progress: UserProgress;
  onBack: () => void;
  onSelectChapter: (subjectName: string, chapter: Chapter) => void;
  onQuickPractice: (subjectName: string, chapter: Chapter) => void;
}

export default function SubjectView({ subject, progress, onBack, onSelectChapter, onQuickPractice }: SubjectViewProps) {
  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [subject.name]);

  const attemptedKeys = Object.keys(progress.answeredQuestions);
  const subExam = resolveExamForSubject(subject);
  const subColors = getExamColorClasses(subExam);

  // Calculate subject-specific stats
  let totalQuestions = 0;
  let totalAttempted = 0;
  let correctCount = 0;

  const sortedChapters = [...subject.chapters].sort(compareChapters);
  const chaptersWithStats = sortedChapters.map((chap) => {
    let chapAttempted = 0;
    let chapCorrect = 0;

    attemptedKeys.forEach((key) => {
      const entry = progress.answeredQuestions[key];
      const parsed = parseProgressKey(key, entry);
      if (parsed.subject === subject.name && parsed.chapterId === chap.id) {
        chapAttempted++;
        if (entry.isCorrect) {
          chapCorrect++;
        }
      }
    });

    totalQuestions += chap.questionsCount;
    totalAttempted += chapAttempted;
    correctCount += chapCorrect;

    const accuracy = chapAttempted > 0 ? Math.round((chapCorrect / chapAttempted) * 100) : 0;
    const coverage = chap.questionsCount > 0 ? Math.round((chapAttempted / chap.questionsCount) * 100) : 0;

    let status: "Not Started" | "In Progress" | "Completed" = "Not Started";
    if (chapAttempted === chap.questionsCount && chap.questionsCount > 0) {
      status = "Completed";
    } else if (chapAttempted > 0) {
      status = "In Progress";
    }

    return {
      ...chap,
      attempted: chapAttempted,
      correct: chapCorrect,
      accuracy,
      coverage,
      status,
    };
  });

  const inProgressChapter = chaptersWithStats.find((c) => c.status === "In Progress");
  const nextNotStartedChapter = chaptersWithStats.find((c) => c.status === "Not Started");
  const nextChapter = inProgressChapter || nextNotStartedChapter;
  const nextChapterIndex = nextChapter ? chaptersWithStats.findIndex((c) => c.id === nextChapter.id) + 1 : 1;
  const allCompleted = chaptersWithStats.length > 0 && chaptersWithStats.every((c) => c.status === "Completed");

  const subjectAccuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
  const subjectCoverage = totalQuestions > 0 ? Math.round((totalAttempted / totalQuestions) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto pb-12">
      {/* Navigation back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to All Subjects</span>
        </button>
      </div>

      {/* Subject Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            SUBJECT CURRICULUM
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            {subject.name}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Curated <strong className="text-slate-800 font-semibold">{subject.chapters.length}</strong> active content chapters containing <strong className="text-slate-800 font-semibold">{subject.totalQuestions}</strong> questions total.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">

          {nextChapter && !allCompleted && (
            <button
              onClick={() => onQuickPractice(subject.name, nextChapter)}
              title={`${inProgressChapter ? "Resume" : "Start"}: ${nextChapter.name}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-4 py-2.5 rounded-xl transition-all shadow-3xs cursor-pointer group whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>
                {inProgressChapter 
                  ? `Resume Q${inProgressChapter.attempted + 1}` 
                  : "Start Practice"}
              </span>
              <span className="text-[10px] font-medium text-indigo-100 bg-indigo-700/70 px-1.5 py-0.5 rounded">
                Ch {nextChapterIndex}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* 4-Card Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Questions */}
        <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6366F1] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {totalQuestions}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Total Subject MCQs
            </div>
          </div>
        </div>

        {/* Card 2: Attempted & Coverage */}
        <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#10B981] flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 fill-[#10B981]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {totalAttempted}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Attempted ({subjectCoverage}%)
            </div>
          </div>
        </div>

        {/* Card 3: Accuracy */}
        <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#E0EEFD] text-[#2563EB] flex items-center justify-center shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {subjectAccuracy}%
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Subject Accuracy
            </div>
          </div>
        </div>

        {/* Card 4: Chapters */}
        <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FEE8D8] text-[#EA580C] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {subject.chapters.length}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Curriculum Chapters
            </div>
          </div>
        </div>
      </div>

      {/* Chapters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {chaptersWithStats.map((chapter, idx) => {
          const visual = getChapterVisual(chapter.name, idx);
          const ChapterIcon = visual.Icon;

          return (
            <div
              key={chapter.id}
              onClick={() => onSelectChapter(subject.name, chapter)}
              className="bg-white border border-slate-100 hover:border-slate-300 p-5 sm:p-6 rounded-2xl shadow-3xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-4">
                  {/* Visual Chapter Icon */}
                  <div className={`p-3.5 rounded-2xl shrink-0 ${visual.bg} ${visual.text}`}>
                    <ChapterIcon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        chapter.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100 border"
                          : chapter.status === "In Progress"
                          ? "bg-amber-50 text-amber-700 border-amber-100 border"
                          : `${subColors.badgeBg} ${subColors.badgeBorder} ${subColors.badgeText} border`
                      }`}>
                        {chapter.status === "Completed"
                          ? "COMPLETED"
                          : chapter.status === "In Progress"
                          ? "IN PROGRESS"
                          : `CHAPTER ${String(idx + 1).padStart(2, "0")}`}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 shrink-0">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        {chapter.questionsCount} Questions
                      </span>
                    </div>

                    <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mt-2 leading-snug">
                      {chapter.name}
                    </h3>

                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                      {chapter.description || (
                        <>
                          Auto-discovered <strong className="text-slate-800 font-semibold">{chapter.questionsCount}</strong> active practice questions containing step-by-step solutions and exam tricks.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-0 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Total Coverage</span>
                  <span className="font-bold text-slate-800 font-mono">{chapter.coverage}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${chapter.coverage === 100 ? "bg-emerald-500" : subColors.solidBg}`}
                    style={{ width: `${chapter.coverage}%` }}
                  />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickPractice(subject.name, chapter);
                  }}
                  className={`w-full mt-3 flex items-center justify-center relative font-semibold text-xs py-3 px-5 rounded-xl transition-all shadow-xs cursor-pointer group/btn ${
                    chapter.status === "Completed"
                      ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                      : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {chapter.status === "Completed" ? (
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-white text-white" />
                    )}
                    <span>
                      {chapter.status === "Completed"
                        ? "Review Chapter"
                        : chapter.status === "In Progress"
                        ? `Resume Practice (Q${chapter.attempted + 1})`
                        : "Practice"}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform absolute right-4 ${
                    chapter.status === "Completed" ? "text-slate-400" : "text-white/80"
                  }`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
