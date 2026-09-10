/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Tag,
  ChevronRight,
  LayoutGrid,
  RotateCcw,
  SkipForward,
  X
} from "lucide-react";
import { Question, UserAnswerSubmission, UserProgress } from "../types";
import { resolveExamForEntry } from "../../shared/exams";
import RichText from "./RichText";

type Confidence = "Guess" | "Somewhat Sure" | "Very Sure";

/**
 * Per-question state, keyed by position in the set (not question id — mixed
 * revision/mistake packs can repeat ids across chapters). Keeping a record
 * instead of one "current answer" is what makes going back, re-reading an
 * earlier explanation, and jumping around the set possible.
 */
interface QuestionState {
  selected: string | null;
  confidence: Confidence;
  answered: boolean;
  fromEarlierSession: boolean;
}

const DEFAULT_STATE: QuestionState = {
  selected: null,
  confidence: "Very Sure",
  answered: false,
  fromEarlierSession: false
};

interface PracticeSessionProps {
  questions: Question[];
  mode: 'practice' | 'revision' | 'mistakes';
  chapterId: string;
  chapterName: string;
  subject: string;
  /** Where to open the set — the resume point picked on the chapter screen. */
  startIndex?: number;
  /** When true, ignore earlier session answers so user can retake fresh. */
  clearPreviousAnswers?: boolean;
  /** Used to pre-fill questions already answered in an earlier session. */
  progress?: UserProgress;
  onFinish: () => void;
  onSubmitAnswer: (submission: UserAnswerSubmission) => Promise<any>;
}

export default function PracticeSession({
  questions,
  mode,
  chapterId,
  chapterName,
  subject,
  startIndex = 0,
  clearPreviousAnswers = false,
  progress,
  onFinish,
  onSubmitAnswer
}: PracticeSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(startIndex, 0), Math.max(questions.length - 1, 0))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const [states, setStates] = useState<Record<number, QuestionState>>(() => {
    const seeded: Record<number, QuestionState> = {};
    if (!progress || clearPreviousAnswers) return seeded;
    questions.forEach((q, index) => {
      const entry = progress.answeredQuestions[`${subject}:${chapterId}:${q.id}`];
      if (entry) {
        seeded[index] = {
          selected: entry.userAnswer,
          confidence: entry.confidence,
          answered: true,
          fromEarlierSession: true
        };
      }
    });
    return seeded;
  });

  // Auto-scroll to top on question index change
  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIndex]);

  const answeredCount = useMemo(
    () => questions.reduce((count, _q, index) => (states[index]?.answered ? count + 1 : count), 0),
    [questions, states]
  );

  if (questions.length === 0) {
    return (
      <div className="py-16 text-center space-y-4 bg-white border border-slate-100 rounded-2xl max-w-md mx-auto">
        <HelpCircle className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
        <div>
          <h3 className="font-display text-base font-bold text-slate-800">No Questions Found</h3>
          <p className="text-slate-400 text-xs mt-1 px-4">This session has no questions. Make sure the content pack contains valid questions.</p>
        </div>
        <button
          onClick={onFinish}
          className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl hover:bg-indigo-100"
        >
          Exit Session
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const current = states[currentIndex] || DEFAULT_STATE;
  const selectedOption = current.selected;
  const confidence = current.confidence;
  const isAnswered = current.answered;
  const isCorrect = selectedOption === currentQuestion.answer;

  const patchCurrent = (patch: Partial<QuestionState>) =>
    setStates((prev) => ({
      ...prev,
      [currentIndex]: { ...(prev[currentIndex] || DEFAULT_STATE), ...patch }
    }));

  const goTo = (index: number) => {
    if (index < 0 || index > questions.length - 1) return;
    setCurrentIndex(index);
    setShowPalette(false);
  };

  // Next unattempted question, wrapping around so a skipped early question
  // isn't stranded once you've walked past it.
  const nextUnansweredIndex = () => {
    for (let i = currentIndex + 1; i < questions.length; i++) {
      if (!states[i]?.answered) return i;
    }
    for (let i = 0; i < currentIndex; i++) {
      if (!states[i]?.answered) return i;
    }
    return -1;
  };

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    patchCurrent({ selected: option });
  };

  const handleSubmit = async () => {
    if (!selectedOption || isAnswered || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const resolvedExam = resolveExamForEntry({ subject, chapterId, name: chapterName });

      const submission: UserAnswerSubmission = {
        subject,
        chapterId,
        chapterName,
        questionId: currentQuestion.id,
        questionText: currentQuestion.question,
        options: currentQuestion.options,
        explanation: currentQuestion.explanation,
        examTrick: currentQuestion.examTrick,
        correctAnswer: currentQuestion.answer,
        userAnswer: selectedOption,
        confidence,
        isCorrect,
        exam: resolvedExam.matchExam,
      };

      await onSubmitAnswer(submission);
      patchCurrent({ answered: true, fromEarlierSession: false });
    } catch (e) {
      console.error("Error submitting answer:", e);
      // Proceed locally even if network has issue
      patchCurrent({ answered: true, fromEarlierSession: false });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      goTo(currentIndex + 1);
    } else {
      onFinish();
    }
  };

  /** Clear this question locally so it can be attempted again. */
  const handleAnswerAgain = () => patchCurrent({ ...DEFAULT_STATE });

  const handleRestart = () => {
    setStates({});
    setCurrentIndex(0);
    setShowPalette(false);
  };

  // Keyboard shortcuts: 1-4/A-D pick an option, Enter submits or advances,
  // arrow keys move between questions, Escape closes the question palette.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      if (e.key === "Escape") {
        if (showPalette) {
          e.preventDefault();
          setShowPalette(false);
        }
        return;
      }

      if (!isAnswered) {
        const letterIndex = "abcd".indexOf(e.key.toLowerCase());
        const digitIndex = "1234".indexOf(e.key);
        const optionIndex = digitIndex !== -1 ? digitIndex : letterIndex;
        if (optionIndex !== -1 && optionIndex < currentQuestion.options.length) {
          e.preventDefault();
          handleOptionSelect(currentQuestion.options[optionIndex]);
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          if (selectedOption && !isSubmitting) handleSubmit();
          return;
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goTo(currentIndex - 1);
          return;
        }

        if (e.key === "ArrowRight") {
          e.preventDefault();
          handleNext();
          return;
        }
      } else {
        if (e.key === "Enter" || e.key === "ArrowRight") {
          e.preventDefault();
          handleNext();
          return;
        }

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goTo(currentIndex - 1);
          return;
        }

        if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          handleAnswerAgain();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnswered, selectedOption, isSubmitting, currentIndex, questions.length, showPalette, currentQuestion]);

  const progressPercentage = Math.round((answeredCount / questions.length) * 100);
  const jumpTarget = nextUnansweredIndex();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Session Status Bar */}
      <div className="bg-white border border-slate-100 p-4 sm:p-5 rounded-2xl space-y-3 shadow-3xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {mode.charAt(0).toUpperCase() + mode.slice(1)} session
            </div>
            <div className="text-sm sm:text-base font-bold font-display leading-tight truncate max-w-full md:max-w-md text-slate-900">
              {chapterName}
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <div className="text-xs text-slate-500">
              Question <strong className="text-slate-900 font-bold">{currentIndex + 1}</strong> of <strong className="text-slate-900 font-bold">{questions.length}</strong>
              <span className="text-slate-400"> · {answeredCount} done</span>
            </div>
            <div className="w-full sm:w-28 bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Set-level controls: jump anywhere, skip ahead to what's unfinished, restart. */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowPalette((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
              showPalette
                ? "bg-indigo-600 border-indigo-600 text-white shadow-3xs"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-3xs"
            }`}
          >
            {showPalette ? <X className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            {showPalette ? "Close" : "All questions"}
          </button>
          <button
            onClick={() => jumpTarget >= 0 && goTo(jumpTarget)}
            disabled={jumpTarget < 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-3xs"
          >
            <SkipForward className="w-3.5 h-3.5 text-indigo-500" />
            Next unanswered
          </button>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shadow-3xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            Start over
          </button>
          <button
            onClick={onFinish}
            className="ml-auto text-xs font-semibold text-slate-400 hover:text-slate-600 px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            End session
          </button>
        </div>

        {showPalette && (
          <div className="pt-3 border-t border-slate-50 space-y-3 animate-fade-in">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">
              {questions.map((q, index) => {
                const state = states[index];
                const isCurrent = index === currentIndex;
                let chip = "bg-white border-slate-200 text-slate-500 hover:bg-slate-50";
                if (state?.answered) {
                  chip = state.selected === q.answer
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-rose-50 border-rose-200 text-rose-700";
                }
                return (
                  <button
                    key={index}
                    onClick={() => goTo(index)}
                    title={
                      state?.answered
                        ? `Question ${index + 1} — ${state.selected === q.answer ? "correct" : "incorrect"}`
                        : `Question ${index + 1} — not attempted`
                    }
                    className={`h-10 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${chip} ${
                      isCurrent ? "ring-2 ring-indigo-600 ring-offset-1" : ""
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" /> Correct</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-200" /> Incorrect</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white border border-slate-200" /> Not attempted</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 md:p-8 shadow-3xs">

        {/* Difficulty, Source and Importance */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-5 text-[11px]">
          <span className={`px-2 py-0.5 border rounded-md font-semibold ${
            currentQuestion.difficulty === 'Easy'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : currentQuestion.difficulty === 'Medium'
              ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
              : 'bg-rose-50 border-rose-100 text-rose-700'
          }`}>
            {currentQuestion.difficulty || 'Medium'}
          </span>
          <span className="text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md truncate max-w-full">
            {currentQuestion.source || "Practice question"}
          </span>
          {currentQuestion.importance && (
            <span className={`px-2 py-0.5 rounded-md font-semibold ${
              currentQuestion.importance === 'High'
                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                : 'bg-slate-50 text-slate-500'
            }`}>
              {currentQuestion.importance} priority
            </span>
          )}
        </div>

        {/* Question Statement */}
        <div>
          <h2 className="text-lg md:text-xl font-bold font-display text-slate-800 leading-snug">
            <RichText inline>{currentQuestion.question}</RichText>
          </h2>
        </div>

        {/* Options Selection */}
        <div className="mt-8 space-y-3">
          {currentQuestion.options.map((option, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            const isSelected = selectedOption === option;

            let optionStyle = "border-slate-100 hover:bg-slate-50/50 hover:border-slate-200";
            let letterStyle = "bg-slate-50 text-slate-500 border-slate-100";

            if (isSelected) {
              optionStyle = "border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600";
              letterStyle = "bg-indigo-600 text-white border-indigo-600";
            }

            if (isAnswered) {
              // Highlight correctness after submission
              const isCorrectOption = option === currentQuestion.answer;
              const isUserSelection = option === selectedOption;

              if (isCorrectOption) {
                optionStyle = "border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500";
                letterStyle = "bg-emerald-500 text-white border-emerald-500";
              } else if (isUserSelection && !isCorrectOption) {
                optionStyle = "border-rose-500 bg-rose-50/30 ring-1 ring-rose-500";
                letterStyle = "bg-rose-500 text-white border-rose-500";
              } else {
                optionStyle = "border-slate-100 opacity-60";
                letterStyle = "bg-slate-50 text-slate-400";
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(option)}
                disabled={isAnswered}
                className={`w-full text-left p-4 rounded-xl border flex items-center gap-4 transition-all duration-150 cursor-pointer ${optionStyle}`}
              >
                <span className={`w-7 h-7 flex items-center justify-center rounded-lg border font-mono font-bold text-sm shrink-0 ${letterStyle}`}>
                  {letter}
                </span>
                <span className="text-sm font-medium text-slate-700 leading-relaxed">
                  <RichText inline>{option}</RichText>
                </span>
              </button>
            );
          })}
        </div>

        {/* Confidence Selector (Hidden when already answered) */}
        {!isAnswered && (
          <div className="mt-8 pt-6 border-t border-slate-50 space-y-3">
            <label className="text-xs font-semibold text-slate-400 block">
              How confident are you?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { level: "Guess", color: "border-amber-200 text-amber-700 bg-amber-50/30 ring-amber-500" },
                { level: "Somewhat Sure", color: "border-blue-200 text-blue-700 bg-blue-50/30 ring-blue-500" },
                { level: "Very Sure", color: "border-emerald-200 text-emerald-700 bg-emerald-50/30 ring-emerald-500" }
              ].map((item) => {
                const isActive = confidence === item.level;
                return (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => patchCurrent({ confidence: item.level as Confidence })}
                    className={`p-3 rounded-xl border text-center text-xs font-semibold flex items-center justify-center cursor-pointer transition-all ${
                      isActive
                        ? `${item.color} ring-1 font-bold border-transparent`
                        : "border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-500"
                    }`}
                  >
                    {item.level}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Section (Hidden when already answered) */}
        {!isAnswered && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNext}
                className="px-3 py-3 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedOption || isSubmitting}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                {isSubmitting ? "Submitting…" : "Submit Answer"}
              </button>
            </div>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        {!isAnswered && (
          <div className="hidden sm:flex items-center gap-1.5 justify-end mt-2 text-[10px] text-slate-300">
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">1-4</kbd> select
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">Enter</kbd> submit
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">→</kbd> navigate
          </div>
        )}

      </div>

      {/* Answer Screen / Explanations Panel (Appears after answer submitted) */}
      {isAnswered && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 sm:p-6 md:p-8 space-y-6 animate-slide-up shadow-3xs">

          {/* Correction Banner */}
          <div className="flex items-start gap-4">
            {isCorrect ? (
              <div className="p-2.5 bg-emerald-500 text-white rounded-2xl">
                <CheckCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
            ) : (
              <div className="p-2.5 bg-rose-500 text-white rounded-2xl">
                <XCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
            )}

            <div>
              <h3 className={`font-display text-lg font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isCorrect
                  ? "Correct!"
                  : `Incorrect — the correct answer is: ${currentQuestion.answer}`
                }
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                {current.fromEarlierSession ? "Answered in an earlier session" : "Submitted"} with{" "}
                <strong className="text-slate-600">{confidence}</strong> confidence.
              </p>
            </div>
          </div>

          {/* Explanation Section */}
          <div className="space-y-2 border-t border-slate-200/60 pt-5">
            <span className="text-xs font-semibold text-slate-400 block">Explanation</span>
            <div className="text-slate-600 text-sm leading-relaxed bg-white p-4 rounded-xl border border-slate-100">
              <RichText>{currentQuestion.explanation}</RichText>
            </div>
          </div>

          {/* Exam Trick Section */}
          {currentQuestion.examTrick && (
            <div className="space-y-2">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800 font-display">
                    {resolveExamForEntry({ subject, chapterId, name: chapterName }).questionTipLabel || "Tip"}
                  </h4>
                  <div className="text-xs text-amber-700 leading-relaxed mt-0.5 font-medium">
                    <RichText>{currentQuestion.examTrick}</RichText>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {currentQuestion.tags && currentQuestion.tags.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 block">Topics</span>
              <div className="flex flex-wrap gap-2">
                {currentQuestion.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md">
                    <Tag className="w-3 h-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Nav between questions */}
          <div className="pt-4 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-3 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAnswerAgain}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-3 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Answer again
              </button>
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer shadow-sm shadow-indigo-100"
              >
                {currentIndex < questions.length - 1 ? (
                  <>Next Question <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Complete Session <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 justify-end text-[10px] text-slate-300">
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">Enter</kbd> next
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">→</kbd> navigate
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 font-mono">R</kbd> retry
          </div>

        </div>
      )}
    </div>
  );
}
