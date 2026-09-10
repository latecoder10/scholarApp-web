/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  RefreshCw, 
  HelpCircle, 
  CheckCircle, 
  Settings, 
  Play, 
  Sliders, 
  Sparkles, 
  BookOpen, 
  AlertTriangle,
  Compass
} from "lucide-react";
import { Subject, UserProgress, Question, Chapter, parseProgressKey } from "../types";
import { resolveExamForSubject } from "../../shared/exams";
import RichText from "./RichText";
import { fetchChapter } from "../lib/contentStore";
import { shuffled, withShuffledOptions } from "../lib/shuffle";

interface RevisionEngineProps {
  subjects: Subject[];
  progress: UserProgress;
  selectedExam?: string;
  onStartSession: (questions: Question[], mode: 'practice' | 'revision' | 'mistakes', chapterId: string, chapterName: string, subject: string) => void;
}

export default function RevisionEngine({ subjects, progress, selectedExam = "all", onStartSession }: RevisionEngineProps) {
  const [includeMistakes, setIncludeMistakes] = useState(true);
  const [includeWeakChapters, setIncludeWeakChapters] = useState(true);
  const [includeLowConfidence, setIncludeLowConfidence] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [maxCount, setMaxCount] = useState(15);
  const [assembledSet, setAsassembledSet] = useState<(Question & { chapterId: string, chapterName: string, subject: string })[] | null>(null);

  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedExam, subjectFilter]);

  // Filter subjects based on selectedExam track
  const filteredSubjects = subjects.filter((s) => {
    if (selectedExam === "all") return true;
    return resolveExamForSubject(s).id === selectedExam;
  });

  // Retrieve subject list
  const subjectList = ["All", ...filteredSubjects.map((s) => s.name)];

  // Helper: Find all questions across all subjects/chapters
  // In our full-stack we fetch chapters on demand, but we can pre-populate questions that are in the mistakes book,
  // or fetch them from the already loaded metadata if available. 
  // Wait! To ensure we have access to the actual Question objects, we can load them or assemble them from 
  // the mistakes book (which contains the full question structures for wrong answers),
  // and we can simulate/construct the rest or let the user revise from active mistakes & low confidence items 
  // that are stored inside progress!
  // Yes! The mistakes book has full question text, options, explanation, exam trick.
  // And we can also easily fetch/resolve questions for low confidence items!
  // Let's build a truly solid, self-contained compiler:
  const handleAssemble = async () => {
    const compiledQuestions: (Question & { chapterId: string, chapterName: string, subject: string })[] = [];

    // 1. Gather from Mistake Book (Mistakes contain complete Question structures)
    if (includeMistakes && progress.mistakes && progress.mistakes.length > 0) {
      progress.mistakes.forEach((m) => {
        if (subjectFilter === "All" || m.subject === subjectFilter) {
          compiledQuestions.push({
            id: m.questionId,
            question: m.questionText,
            options: m.options,
            answer: m.correctAnswer,
            difficulty: 'Medium',
            source: 'Mistake Book',
            explanation: m.explanation,
            examTrick: m.examTrick,
            importance: 'High',
            tags: [],
            chapterId: m.chapterId,
            chapterName: m.chapterName,
            subject: m.subject
          });
        }
      });
    }

    // 2. Gather from Low Confidence / Guess items that are currently solved but marked as "Guess" or "Somewhat Sure" in progress
    // We can extract them from active mistakes or preloaded sets. 
    // To ensure full coverage, we can also perform fetch calls to the chapters in the background to grab their questions,
    // or compile them on the backend if preferred. 
    // Wait! A super robust way is to make an API call or load the questions of the weak chapters!
    // Let's check which chapters are weak (< 60% accuracy).
    const attemptedKeys = Object.keys(progress.answeredQuestions);
    const weakChaptersMetadata: { subject: string, chapterId: string, name: string }[] = [];

    filteredSubjects.forEach((subj) => {
      subj.chapters.forEach((chap) => {
        let chapAttempted = 0;
        let chapCorrect = 0;
        attemptedKeys.forEach((key) => {
          const entry = progress.answeredQuestions[key];
          const parsed = parseProgressKey(key, entry);
          if (parsed.subject === subj.name && parsed.chapterId === chap.id) {
            chapAttempted++;
            if (entry?.isCorrect) {
              chapCorrect++;
            }
          }
        });
        const accuracy = chapAttempted > 0 ? (chapCorrect / chapAttempted) * 100 : 100;
        if (chapAttempted > 0 && accuracy < 60) {
          weakChaptersMetadata.push({ subject: subj.name, chapterId: chap.id, name: chap.name });
        }
      });
    });

    // To load the full question content, let's fetch chapters that are relevant!
    // Since we want this to be incredibly robust, let's load relevant chapters concurrently!
    const chaptersToFetch: { subject: string, chapterId: string, name: string }[] = [];

    if (includeWeakChapters) {
      weakChaptersMetadata.forEach((c) => {
        if (subjectFilter === "All" || c.subject === subjectFilter) {
          chaptersToFetch.push(c);
        }
      });
    }

    // Let's also fetch chapters for low confidence items if they aren't already included
    if (includeLowConfidence) {
      attemptedKeys.forEach((key) => {
        const [sub, chapId] = key.split(":");
        if (subjectFilter === "All" || sub === subjectFilter) {
          const isLowConf = progress.answeredQuestions[key].confidence === "Guess" || progress.answeredQuestions[key].confidence === "Somewhat Sure";
          if (isLowConf) {
            const alreadyAdded = chaptersToFetch.some((c) => c.chapterId === chapId);
            if (!alreadyAdded) {
              const matchedSub = subjects.find((s) => s.name === sub);
              const matchedChap = matchedSub?.chapters.find((c) => c.id === chapId);
              if (matchedChap) {
                chaptersToFetch.push({ subject: sub, chapterId: chapId, name: matchedChap.name });
              }
            }
          }
        }
      });
    }

    // Fetch chapters data concurrently
    try {
      const fetchPromises = chaptersToFetch.map(async (c) => {
        try {
          const data = await fetchChapter(c.subject, c.chapterId);
          return { ...c, questions: (data.questions || []) as Question[] };
        } catch {
          return { ...c, questions: [] as Question[] };
        }
      });

      const fetchedChapters = await Promise.all(fetchPromises);

      fetchedChapters.forEach((fc) => {
        fc.questions.forEach((q) => {
          const progressKey = `${fc.subject}:${fc.chapterId}:${q.id}`;
          const attempt = progress.answeredQuestions[progressKey];

          let shouldInclude = false;

          // Check if weak chapter question is unattempted or wrong
          if (includeWeakChapters && weakChaptersMetadata.some((wc) => wc.chapterId === fc.chapterId)) {
            if (!attempt || !attempt.isCorrect) {
              shouldInclude = true;
            }
          }

          // Check if low confidence
          if (includeLowConfidence && attempt && (attempt.confidence === "Guess" || attempt.confidence === "Somewhat Sure")) {
            shouldInclude = true;
          }

          // Avoid duplicates
          const isDuplicate = compiledQuestions.some((cq) => cq.subject === fc.subject && cq.chapterId === fc.chapterId && cq.id === q.id);

          if (shouldInclude && !isDuplicate) {
            compiledQuestions.push({
              ...q,
              chapterId: fc.chapterId,
              chapterName: fc.name,
              subject: fc.subject
            });
          }
        });
      });
    } catch (e) {
      console.error("Error fetching chapters for compilation", e);
    }

    // Shuffle and slice to max count. Options are permuted here too: the
    // mistake-book entries carry the option order from the attempt that got
    // them wrong, and re-drilling that exact layout rehearses the position
    // rather than the answer.
    const randomized = shuffled(compiledQuestions).slice(0, maxCount).map(withShuffledOptions);
    setAsassembledSet(randomized);
  };

  const handleLaunchRevision = () => {
    if (!assembledSet || assembledSet.length === 0) return;

    // Launch session
    onStartSession(
      assembledSet,
      'revision',
      'custom-revision-pack',
      'Custom Revision Set',
      subjectFilter === 'All' ? 'Multiple Subjects' : subjectFilter
    );
  };

  const attemptedKeys = Object.keys(progress.answeredQuestions);
  const weakChaptersCount = filteredSubjects.reduce((count, subj) => {
    let weakInSubj = 0;
    subj.chapters.forEach((chap) => {
      let chapAttempted = 0;
      let chapCorrect = 0;
      attemptedKeys.forEach((key) => {
        const entry = progress.answeredQuestions[key];
        const parsed = parseProgressKey(key, entry);
        if (parsed.subject === subj.name && parsed.chapterId === chap.id) {
          chapAttempted++;
          if (entry?.isCorrect) chapCorrect++;
        }
      });
      const acc = chapAttempted > 0 ? (chapCorrect / chapAttempted) * 100 : 100;
      if (chapAttempted > 0 && acc < 60) weakInSubj++;
    });
    return count + weakInSubj;
  }, 0);

  const lowConfidenceCount = attemptedKeys.filter(k => {
    const entry = progress.answeredQuestions[k];
    return entry?.confidence === "Guess" || entry?.confidence === "Somewhat Sure";
  }).length;

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
            ADAPTIVE DRILL
          </span>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Revision Engine
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Synthesize targeted practice sets directly from your mistakes, weak chapters, and low-confidence guesses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleAssemble}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-3xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Set</span>
          </button>
        </div>
      </div>

      {/* 2. Top Stats Grid - Proportional, Uniform Height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Weak Chapters */}
        <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FEE8D8] text-[#EA580C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {weakChaptersCount}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Chapters Below 60%
            </div>
          </div>
        </div>

        {/* Card 2: Unresolved Mistakes */}
        <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6366F1] flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {progress.mistakes?.length || 0}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Unresolved Mistakes
            </div>
          </div>
        </div>

        {/* Card 3: Low Confidence Answers */}
        <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#E0EEFD] text-[#2563EB] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {lowConfidenceCount}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Uncertain Answers
            </div>
          </div>
        </div>

        {/* Card 4: Session Target Capacity */}
        <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#10B981] flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
              {maxCount} MCQs
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
              Drill Batch Size
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Configuration & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Grid: Configuration Sliders (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-6">
          <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-indigo-600" /> Configure Revision Set
          </h3>

          <div className="space-y-4">
            {/* Subject Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Subject Domain</label>
              <select
                value={subjectFilter}
                onChange={(e) => {
                  setSubjectFilter(e.target.value);
                  setAsassembledSet(null);
                }}
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors cursor-pointer"
              >
                {subjectList.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5 pt-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Include Data Sources</label>
              
              {/* Mistakes */}
              <label className="flex items-start gap-3 p-3.5 border border-slate-100 bg-[#F8F7FF] rounded-xl hover:bg-slate-50 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeMistakes}
                  onChange={(e) => {
                    setIncludeMistakes(e.target.checked);
                    setAsassembledSet(null);
                  }}
                  className="mt-0.5 accent-indigo-600 w-4 h-4"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">Include Mistake Book (Wrong Items)</div>
                  <div className="text-[11px] text-slate-500">Pulls active unresolved incorrect questions.</div>
                </div>
              </label>

              {/* Weak Chapters */}
              <label className="flex items-start gap-3 p-3.5 border border-slate-100 bg-[#FFF7F4] rounded-xl hover:bg-slate-50 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeWeakChapters}
                  onChange={(e) => {
                    setIncludeWeakChapters(e.target.checked);
                    setAsassembledSet(null);
                  }}
                  className="mt-0.5 accent-indigo-600 w-4 h-4"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">Include Weak Chapters (&lt; 60% accuracy)</div>
                  <div className="text-[11px] text-slate-500">Extracts challenging items from weak concepts.</div>
                </div>
              </label>

              {/* Guesses */}
              <label className="flex items-start gap-3 p-3.5 border border-slate-100 bg-[#F4F8FE] rounded-xl hover:bg-slate-50 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeLowConfidence}
                  onChange={(e) => {
                    setIncludeLowConfidence(e.target.checked);
                    setAsassembledSet(null);
                  }}
                  className="mt-0.5 accent-indigo-600 w-4 h-4"
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">Include Guesses & Low Confidence</div>
                  <div className="text-[11px] text-slate-500">Pulls questions solved with 'Guess' or 'Somewhat Sure' ratings.</div>
                </div>
              </label>
            </div>

            {/* Max Question slider */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-400 uppercase tracking-wider">Max Batch Size</label>
                <span className="font-bold font-mono text-slate-800">{maxCount} Questions</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={maxCount}
                onChange={(e) => {
                  setMaxCount(parseInt(e.target.value));
                  setAsassembledSet(null);
                }}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
              />
            </div>

            <button
              onClick={handleAssemble}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs"
            >
              <Sparkles className="w-4 h-4" /> Build Revision Set
            </button>
          </div>
        </div>

        {/* Right Grid: Assembled Pack Preview (7 cols) */}
        <div className="lg:col-span-7">
          {assembledSet ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-3xs space-y-6 animate-slide-up">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Your set is assembled</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Review the breakdown below, then begin the session.</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold rounded-lg">
                  {assembledSet.length} Questions
                </span>
              </div>

              {assembledSet.length > 0 ? (
                <>
                  {/* Detailed summary counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-3 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Mistakes</span>
                      <span className="text-lg font-bold text-slate-900 block mt-0.5">
                        {assembledSet.filter(q => q.source === 'Mistake Book').length}
                      </span>
                    </div>
                    <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-3 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Weak Concepts</span>
                      <span className="text-lg font-bold text-slate-900 block mt-0.5">
                        {assembledSet.filter(q => q.source !== 'Mistake Book' && q.difficulty === 'Hard').length}
                      </span>
                    </div>
                    <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-3 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Medium Diff</span>
                      <span className="text-lg font-bold text-slate-900 block mt-0.5">
                        {assembledSet.filter(q => q.difficulty === 'Medium').length}
                      </span>
                    </div>
                    <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-3 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Easy Diff</span>
                      <span className="text-lg font-bold text-slate-900 block mt-0.5">
                        {assembledSet.filter(q => q.difficulty === 'Easy').length}
                      </span>
                    </div>
                  </div>

                  {/* Question listing scroll */}
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                    {assembledSet.map((q, idx) => (
                      <div key={idx} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex items-start gap-3">
                        <span className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded text-[11px] font-mono font-bold text-slate-600 shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                            <RichText inline>{q.question}</RichText>
                          </p>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {q.subject} • {q.chapterName}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Launch */}
                  <button
                    onClick={handleLaunchRevision}
                    className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer shadow-3xs"
                  >
                    <Play className="w-4 h-4 fill-white text-white" /> Start Revision Session
                  </button>
                </>
              ) : (
                <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium mt-2">No questions match these filters.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try widening filters or selecting a different subject.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center flex flex-col items-center justify-center gap-4 shadow-3xs min-h-[420px]">
              <div className="w-16 h-16 rounded-2xl bg-[#F8F7FF] border border-[#EDE9FE] flex items-center justify-center text-indigo-500">
                <Compass className="w-8 h-8 stroke-1.5" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="font-display text-base font-bold text-slate-900">Nothing built yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Configure your filters on the left and click <strong>Build Revision Set</strong> to assemble a custom session.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
