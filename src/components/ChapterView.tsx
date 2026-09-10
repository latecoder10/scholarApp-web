/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  ChevronLeft, 
  Layers, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  HelpCircle,
  Gauge,
  Sparkles,
  GraduationCap,
  BookOpen,
  ListOrdered,
  RotateCcw,
  Shuffle
} from "lucide-react";
import { Chapter, UserProgress, Question, parseProgressKey } from "../types";
import { fetchChapter } from "../lib/contentStore";
import { shuffled, withShuffledOptions } from "../lib/shuffle";
import { resolveExamForEntry } from "../../shared/exams";

const SHUFFLE_PREF_KEY = "exam_scholar_shuffle_questions";

/**
 * Master switch for the chapter's AI question generator.
 * Allows students to generate questions up to 100+ on-demand.
 * The server route enforces its capability check and Gemini API key requirement.
 */
const AI_EXPANSION_ENABLED = true;

interface ChapterViewProps {
  subjectName: string;
  chapter: Chapter;
  progress: UserProgress;
  onBack: () => void;
  onStartSession: (
    questions: Question[],
    mode: 'practice' | 'revision' | 'mistakes',
    chapterId: string,
    chapterName: string,
    subject: string,
    startIndex?: number,
    clearPreviousAnswers?: boolean
  ) => void;
}

export default function ChapterView({ subjectName, chapter, progress, onBack, onStartSession }: ChapterViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expanding, setExpanding] = useState(false);
  const [expansionStatus, setExpansionStatus] = useState<string | null>(null);
  const [showJumpList, setShowJumpList] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem(SHUFFLE_PREF_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  // Bumped by "Reshuffle" to force a fresh draw without changing the preference.
  const [shuffleNonce, setShuffleNonce] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(SHUFFLE_PREF_KEY, String(shuffleQuestions));
    } catch {
      // Private-mode storage restrictions — the toggle still works for this visit.
    }
  }, [shuffleQuestions]);

  const resolvedExam = resolveExamForEntry({ exam: chapter.exam, subject: subjectName, chapterId: chapter.id });

  async function handleExpandChapter(targetCount: number = 15) {
    if (!AI_EXPANSION_ENABLED) return;
    try {
      setExpanding(true);
      setExpansionStatus("Generating new questions…");
      const res = await fetch(`/api/chapter/${encodeURIComponent(subjectName.replace(/\s+/g, "-"))}/${encodeURIComponent(chapter.id)}/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: targetCount })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to expand chapter.");
      }
      const data = await res.json();
      setQuestions((data.questions || []).map(withShuffledOptions));
      // Update chapter counts in the user's view
      chapter.questionsCount = data.totalCount;
      setExpansionStatus(`Done: added ${data.addedCount} questions. This chapter now has ${data.totalCount}.`);
      setTimeout(() => setExpansionStatus(null), 8000);
    } catch (err: any) {
      console.error(err);
      setExpansionStatus(`Error: ${err.message}`);
    } finally {
      setExpanding(false);
    }
  }

  useEffect(() => {
    async function loadChapterQuestions() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchChapter(subjectName, chapter.id);
        setQuestions((data.questions || []) as Question[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Could not load questions. Check file integrity.");
      } finally {
        setLoading(false);
      }
    }

    loadChapterQuestions();
  }, [subjectName, chapter.id]);

  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [chapter.id]);

  // One ordering shared by every mode on this page and by the jump grid, so a
  // "Resume at Q7" label always points at the question the session will open.
  const orderedQuestions = useMemo(
    () => (shuffleQuestions ? shuffled(questions) : questions),
    [questions, shuffleQuestions, shuffleNonce]
  );

  // Determine mistakes and revision questions for this chapter
  const chapterKeys = Object.keys(progress.answeredQuestions).filter((key) => {
    const entry = progress.answeredQuestions[key];
    const parsed = parseProgressKey(key, entry);
    return parsed.subject === subjectName && parsed.chapterId === chapter.id;
  });

  const answeredQuestionsCount = chapterKeys.length;

  const mistakesListForChapter = progress.mistakes.filter(
    (m) => (m.subject === subjectName || !m.subject) && m.chapterId === chapter.id
  );

  const mistakesQuestions = orderedQuestions.filter((q) =>
    mistakesListForChapter.some((m) => m.questionId === q.id)
  );

  // Revision set: either incorrect ones or ones solved with low confidence ('Guess')
  const lowConfidenceOrWrongQIds = chapterKeys
    .filter((key) => {
      const entry = progress.answeredQuestions[key];
      return !entry.isCorrect || entry.confidence === "Guess";
    })
    .map((key) => {
      const entry = progress.answeredQuestions[key];
      return parseProgressKey(key, entry).questionId;
    });

  const revisionQuestions = orderedQuestions.filter((q) =>
    lowConfidenceOrWrongQIds.includes(String(q.id))
  );

  // Resume support: which of this chapter's questions have already been
  // attempted, and where an unfinished pass should pick back up.
  const attemptedQuestionIds = new Set(
    chapterKeys.map((key) => parseProgressKey(key, progress.answeredQuestions[key]).questionId)
  );
  const attemptedFlags = orderedQuestions.map((q) => attemptedQuestionIds.has(String(q.id)));
  const attemptedInChapter = attemptedFlags.filter(Boolean).length;
  const resumeIndex = attemptedFlags.indexOf(false); // -1 once nothing is left
  const hasStarted = attemptedInChapter > 0;
  const isComplete = questions.length > 0 && resumeIndex === -1;

  const correctCount = chapterKeys.filter(key => progress.answeredQuestions[key]?.isCorrect).length;
  const chapterAccuracy = answeredQuestionsCount > 0 ? Math.round((correctCount / answeredQuestionsCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto pb-12">
      {/* 1. Header & Back Navigation */}
      <div className="space-y-3">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to {subjectName}</span>
          </button>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            CHAPTER DRILL
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            {chapter.name}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            {chapter.description || "Interactive exam workspace. Practice concepts with immediate feedback, key tactics, and detailed solutions."}
          </p>
        </div>
      </div>

      {/* 2. Top Stats Grid - Proportional, Uniform Height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Question Pool */}
        <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6366F1] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {questions.length}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Chapter Question Pool
            </div>
          </div>
        </div>

        {/* Card 2: Completed & Progress */}
        <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#10B981] flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {answeredQuestionsCount}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Attempted ({questions.length > 0 ? Math.round((answeredQuestionsCount / questions.length) * 100) : 0}%)
            </div>
          </div>
        </div>

        {/* Card 3: Accuracy */}
        <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#E0EEFD] text-[#2563EB] flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {chapterAccuracy}%
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Chapter Accuracy
            </div>
          </div>
        </div>

        {/* Card 4: Mistakes in Chapter */}
        <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FEE8D8] text-[#EA580C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {mistakesQuestions.length}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Unresolved Mistakes
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center space-y-3 bg-white border border-slate-100 rounded-2xl shadow-3xs">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading questions…</p>
        </div>
      ) : error ? (
        <div className="p-6 border border-rose-100 bg-rose-50/50 rounded-2xl max-w-xl mx-auto text-center space-y-4 shadow-3xs">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800 font-display">Couldn't load this chapter</h4>
            <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-bold text-indigo-600 bg-white border border-slate-100 px-4 py-2 rounded-xl shadow-3xs hover:shadow-md transition-all cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Block (5 cols): Chapter Overview & Difficulty Breakdown */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-6">
              <h3 className="font-display text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
                Chapter Overview
              </h3>

              {/* Progress Summary */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Attempted Progress</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {answeredQuestionsCount} / {questions.length} ({questions.length > 0 ? Math.round((answeredQuestionsCount / questions.length) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{ width: `${questions.length > 0 ? (answeredQuestionsCount / questions.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Difficulty Breakdown */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" /> Difficulty Balance
                </span>
                <div className="space-y-2.5">
                  {Object.entries(chapter.difficultyBreakdown).map(([level, count]) => {
                    const pct = questions.length > 0 ? Math.round((count / questions.length) * 100) : 0;
                    const barColor = level === 'Easy' ? 'bg-emerald-500' : level === 'Medium' ? 'bg-indigo-600' : 'bg-rose-500';
                    const textColor = level === 'Easy' ? 'text-emerald-700' : level === 'Medium' ? 'text-indigo-700' : 'text-rose-700';
                    return (
                      <div key={level} className="flex items-center justify-between text-xs font-mono">
                        <span className={`w-16 font-semibold ${textColor}`}>{level}</span>
                        <div className="flex-1 mx-3 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`${barColor} h-full rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-slate-500 w-14 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI Question Generator Box */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    Expand Question Pool
                    {!AI_EXPANSION_ENABLED && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        Off for now
                      </span>
                    )}
                  </h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {AI_EXPANSION_ENABLED ? (
                      <>
                        This chapter has <strong className="text-slate-800">{questions.length} MCQs</strong>. Expand up to <strong className="text-slate-800">100+ questions</strong> on-demand with step-by-step solutions and exam tricks.
                      </>
                    ) : (
                      <>
                        This chapter has <strong className="text-slate-800">{questions.length} questions</strong>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {expansionStatus && (
                <div className={`p-3 rounded-xl text-xs border leading-relaxed ${
                  expansionStatus.startsWith("Error")
                    ? "bg-rose-50 border-rose-100 text-rose-700"
                    : expansionStatus.startsWith("Done")
                      ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                      : "bg-indigo-50/50 border-indigo-100/50 text-indigo-700"
                }`}>
                  {expansionStatus}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  onClick={() => handleExpandChapter(15)}
                  disabled={expanding || !AI_EXPANSION_ENABLED}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-3xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {expanding ? "Generating…" : "Add 15 Questions"}
                </button>
                <button
                  onClick={() => handleExpandChapter(30)}
                  disabled={expanding || !AI_EXPANSION_ENABLED}
                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-3xs cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  {expanding ? "Generating…" : "Add 30 Questions"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Block (7 cols): Practice Modes */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Control Bar: Title & Shuffle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <h3 className="font-display text-base font-bold text-slate-900">
                Practice Modes
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShuffleQuestions((prev) => !prev)}
                  title={shuffleQuestions ? "Questions are shuffled" : "Questions follow the chapter's own order"}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                    shuffleQuestions
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-3xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-3xs"
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  {shuffleQuestions ? "Shuffled" : "Chapter Order"}
                </button>
                {shuffleQuestions && (
                  <button
                    onClick={() => setShuffleNonce((n) => n + 1)}
                    title="Draw a new random order"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-3xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reshuffle
                  </button>
                )}
              </div>
            </div>

            {/* Standard Practice Mode */}
            <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs space-y-4 hover:border-slate-200 transition-all">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" /> Standard Practice
                  </h4>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-md">
                    {isComplete
                      ? `You've attempted all ${questions.length} questions. Run through them again anytime.`
                      : hasStarted
                        ? `${attemptedInChapter} of ${questions.length} attempted. Resume picks up at the first unanswered question.`
                        : `Complete all ${questions.length} questions sequentially with immediate feedback.`}
                  </p>
                  <div className="text-[11px] font-mono text-slate-400 pt-1">
                    {Math.max(questions.length - attemptedInChapter, 0)} questions left to attempt
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0 self-stretch sm:self-center">
                  {hasStarted && !isComplete && (
                    <button
                      onClick={() => onStartSession(orderedQuestions, 'practice', chapter.id, chapter.name, subjectName, resumeIndex, false)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" /> Resume at Q{resumeIndex + 1}
                    </button>
                  )}
                  <button
                    onClick={() => onStartSession(orderedQuestions, 'practice', chapter.id, chapter.name, subjectName, 0, hasStarted)}
                    disabled={questions.length === 0}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                      hasStarted && !isComplete
                        ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-3xs"
                        : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-3xs"
                    }`}
                  >
                    {hasStarted ? (<><RotateCcw className="w-3.5 h-3.5" /> Start Over</>) : "Start Practice"}
                  </button>
                </div>
              </div>

              {/* Start from any question in the chapter */}
              {questions.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <button
                    onClick={() => setShowJumpList((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    {showJumpList ? "Hide Question Navigator" : "Jump to Specific Question"}
                  </button>

                  {showJumpList && (
                    <div className="space-y-2 animate-fade-in bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">
                        {orderedQuestions.map((q, index) => {
                          const attempted = attemptedFlags[index];
                          return (
                            <button
                              key={`${q.id}-${index}`}
                              onClick={() => onStartSession(orderedQuestions, 'practice', chapter.id, chapter.name, subjectName, index)}
                              title={`Start at question ${index + 1}${attempted ? " (already attempted)" : ""}`}
                              className={`h-9 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                                attempted
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {index + 1}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Green indicates already attempted questions. Click any number to begin practice from that question.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Smart Revision Mode */}
            <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs flex flex-col sm:flex-row items-start justify-between gap-4 hover:border-slate-200 transition-all">
              <div className="space-y-1">
                <h4 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-indigo-600" /> Smart Revision
                </h4>
                <p className="text-slate-500 text-xs leading-relaxed max-w-md">
                  Drill questions from this chapter that were answered incorrectly or with low confidence.
                </p>
                <div className="text-[11px] font-mono text-slate-400 pt-0.5">
                  <strong className="text-slate-700">{revisionQuestions.length}</strong> questions queued for review
                </div>
              </div>
              <button
                onClick={() => onStartSession(revisionQuestions, 'revision', chapter.id, chapter.name, subjectName, 0)}
                disabled={revisionQuestions.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs shrink-0 self-stretch sm:self-center"
              >
                Start Revision
              </button>
            </div>

            {/* Mistakes Only Mode */}
            <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs flex flex-col sm:flex-row items-start justify-between gap-4 hover:border-slate-200 transition-all">
              <div className="space-y-1">
                <h4 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#EA580C]" /> Chapter Mistakes
                </h4>
                <p className="text-slate-500 text-xs leading-relaxed max-w-md">
                  Practice only the questions from this chapter logged in your Mistake Book.
                </p>
                <div className="text-[11px] font-mono text-slate-400 pt-0.5">
                  <strong className="text-slate-700">{mistakesQuestions.length}</strong> unresolved chapter mistakes
                </div>
              </div>
              <button 
                onClick={() => onStartSession(mistakesQuestions, 'mistakes', chapter.id, chapter.name, subjectName, 0)}
                disabled={mistakesQuestions.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#EA580C] hover:bg-orange-700 active:bg-orange-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs shrink-0 self-stretch sm:self-center"
              >
                Practice Mistakes
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
