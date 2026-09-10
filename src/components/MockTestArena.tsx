/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Award, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  AlertTriangle, 
  Play,
  Lightbulb,
  BookOpen,
  HelpCircle, 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  XCircle,
  BarChart,
  Bookmark,
  ArrowRight,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { Subject, Chapter, Question, UserProgress, UserAnswerSubmission } from "../types";
import { EXAM_REGISTRY, resolveExamForSubject, resolveExamForEntry } from "../../shared/exams";
import { getExamColorClasses, getColorClasses } from "../lib/examTheme";
import RichText from "./RichText";
import { fetchChapter } from "../lib/contentStore";
import { shuffled, withShuffledOptions } from "../lib/shuffle";

interface MockTestArenaProps {
  subjects: Subject[];
  progress: UserProgress;
  selectedExam?: string;
  onSubmitAnswer: (submission: UserAnswerSubmission) => Promise<any>;
  onRefreshContent: () => Promise<void>;
  onNavigate: (tab: string) => void;
  /** AI expansion writes generated questions back into content/, so it is off
   *  on deployments with a non-persistent disk. See shared/capabilities.ts. */
  canExpandWithAi?: boolean;
}

interface MockExam {
  id: string;
  name: string;
  subject: string;
  chapterId: string;
  exam: string;
  description: string;
  questionsCount: number;
  durationMinutes: number;
  paper: string;
  syllabus: string[];
}

export default function MockTestArena({ 
  subjects, 
  progress, 
  selectedExam = "all",
  onSubmitAnswer,
  onRefreshContent,
  onNavigate,
  canExpandWithAi = false
}: MockTestArenaProps) {
  // Simulator Navigation State
  const [activeView, setActiveView] = useState<"selection" | "instructions" | "simulator" | "results">("selection");
  const [selectedMock, setSelectedMock] = useState<MockExam | null>(null);
  const [selectedPaperFilter, setSelectedPaperFilter] = useState<string>("All");
  
  // Active Exam States
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Track student's selected answers during exam: questionId -> selectedOption
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Track flagged questions: questionId -> boolean
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  // Track visited questions: questionId -> boolean (to see if visited/not answered)
  const [visited, setVisited] = useState<Record<number, boolean>>({});
  
  // Timer States
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [examDuration, setExamDuration] = useState(0); // initial duration in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Modal State
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 4000);
  };
  
  // Results / History State
  const [savedExamResult, setSavedExamResult] = useState<{
    score: number;
    total: number;
    accuracy: number;
    timeSpentSeconds: number;
    subjectStats: Record<string, { total: number; correct: number }>;
    questionReviews: {
      question: Question;
      userAnswer: string;
      isCorrect: boolean;
      savedToMistakes: boolean;
    }[];
  } | null>(null);

  const [visibleReviewsCount, setVisibleReviewsCount] = useState(15);

  // Auto-scroll to top on view or question index change
  useEffect(() => {
    const scrollContainer = document.getElementById("main-workspace-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIndex, activeView]);

  // Content Expansion State & Functionality
  const [expanding, setExpanding] = useState(false);
  const [expansionStatus, setExpansionStatus] = useState<string | null>(null);

  const handleExpandMock = async (targetCount: number = 20) => {
    if (!selectedMock) return;
    try {
      setExpanding(true);
      setExpansionStatus("Virtually tutoring... Curating premium syllabus-mapped questions...");
      const res = await fetch(`/api/chapter/mock-tests/${selectedMock.chapterId}/expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: targetCount })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to expand mock exam.");
      }
      const data = await res.json();
      setQuestions(shuffled((data.questions || []).map(withShuffledOptions)));
      
      // Update selectedMock question count in-place
      selectedMock.questionsCount = data.totalCount;
      selectedMock.durationMinutes = Math.max(15, Math.ceil(data.totalCount * 1.5));
      
      setExpansionStatus(`Virtual Teacher: Curated ${data.addedCount} high-yield questions successfully! Total questions is now ${data.totalCount}.`);
      setTimeout(() => setExpansionStatus(null), 8000);
      
      // Refresh global subjects list so Dashboard metrics are accurate
      await onRefreshContent();
    } catch (err: any) {
      console.error(err);
      setExpansionStatus(`Expansion Error: ${err.message}`);
    } finally {
      setExpanding(false);
    }
  };

  // A paper/track filter chosen for one exam is meaningless in another, so
  // switching the workspace drops back to "All" rather than showing nothing.
  useEffect(() => {
    setSelectedPaperFilter("All");
  }, [selectedExam]);

  // Discover available mock tests from fetched subjects
  const [mockExams, setMockExams] = useState<MockExam[]>([]);

  useEffect(() => {
    const exams: MockExam[] = [];
    
    // Find all mock subjects (e.g., "Mock Tests" under any registered exam track)
    const mockSubjects = subjects.filter(s => s.name === "Mock Tests" || s.name.toLowerCase().includes("mock"));

    mockSubjects.forEach(mockSubject => {
      mockSubject.chapters.forEach(chap => {
        const chapExam = resolveExamForEntry({
          exam: chap.exam || mockSubject.exam,
          subject: mockSubject.name,
          chapterId: chap.id,
          name: chap.name,
        });
        exams.push({
          id: chap.id,
          name: chap.name,
          subject: mockSubject.name,
          chapterId: chap.id,
          exam: chapExam.matchExam,
          description: chap.description || chapExam.defaultMockDescription,
          questionsCount: chap.questionsCount,
          durationMinutes: Math.max(15, Math.ceil(chap.questionsCount * 1.5)), // 1.5 minutes per question
          paper: chap.paper || chapExam.defaultMockPaper || chapExam.id,
          syllabus: chapExam.mockSyllabusTags
        });
      });
    });
    
    // If no dynamically discovered mock exams are present, add pre-built baseline cards
    if (exams.length === 0) {
      exams.push({
        id: "claude-ccaf-mock-exam-1",
        name: "Claude CCAF Full Mock Exam 1 (Foundations & Architecture)",
        subject: "Mock Tests",
        chapterId: "claude-ccaf-mock-exam-1",
        exam: "Claude CCAF",
        description: "Comprehensive 60-question simulated practice exam covering Agentic Orchestration, MCP Tool Design, Claude Code Workflows, Prompt Engineering, and Context Reliability.",
        questionsCount: 60,
        durationMinutes: 90,
        paper: "CCAF-Simulation",
        syllabus: ["Agentic Loops", "Subagent Spawning", "MCP Tools & Schemas", "Claude Code Workflows", "Prompt Caching", "Context Reliability"]
      });
      exams.push({
        id: "mock-sheet-1",
        name: "CIL MT Mock Sheet-1 (Domain Systems)",
        subject: "Mock Tests",
        chapterId: "mock-sheet-1",
        exam: "CIL MT",
        description: "Comprehensive 20-question Mock Sheet covering technical Computer Science syllabus, modeled exactly after CIL MT exam series.",
        questionsCount: 20,
        durationMinutes: 20,
        paper: "Paper-II",
        syllabus: ["Digital Logic", "COA", "Algorithms", "Programming & DS", "TOC", "Compiler", "OS", "DBMS", "Networks"]
      });
    }
    
    setMockExams(exams);
  }, [subjects]);

  // Load questions for selected mock test
  const handleSelectMock = async (exam: MockExam) => {
    setSelectedMock(exam);
    setLoadingQuestions(true);
    setActiveView("instructions");
    
    try {
      const data = await fetchChapter(exam.subject, exam.chapterId);
      setQuestions(shuffled((data.questions || []) as Question[]));
    } catch (e) {
      console.error("Error loading mock questions:", e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Start exam simulator
  const handleStartExam = () => {
    if (!selectedMock || questions.length === 0) return;
    
    // Reset test taker states
    setAnswers({});
    setFlagged({});
    const initialVisited: Record<number, boolean> = {};
    initialVisited[questions[0].id] = true;
    setVisited(initialVisited);
    setCurrentIndex(0);
    
    // Initialize timer (minutes to seconds)
    const durationSeconds = selectedMock.durationMinutes * 60;
    setExamDuration(durationSeconds);
    setTimeRemaining(durationSeconds);
    setActiveView("simulator");
  };

  // Timer interval hook
  useEffect(() => {
    if (activeView === "simulator") {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeView]);

  // Auto submit when timer runs out
  const handleAutoSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    showToast("Time's up — your exam was submitted automatically.");
    processSubmission();
  };

  // Process the final calculation of scores
  const processSubmission = () => {
    if (!selectedMock || questions.length === 0) return;
    
    let correctCount = 0;
    const timeSpent = examDuration - timeRemaining;
    const subjStats: Record<string, { total: number; correct: number }> = {};
    
    const reviews = questions.map((q) => {
      const userAnswer = answers[q.id] || "";
      const isCorrect = userAnswer === q.answer;
      
      if (isCorrect) correctCount++;
      
      // Classify subject from question tags or default to "CS Systems"
      const subjectTag = q.tags && q.tags.length > 0 ? q.tags[0] : "General Core";
      if (!subjStats[subjectTag]) {
        subjStats[subjectTag] = { total: 0, correct: 0 };
      }
      subjStats[subjectTag].total++;
      if (isCorrect) {
        subjStats[subjectTag].correct++;
      }

      // Automatically submit results server-side to save in student progress & analytics history!
      // This maps mock test performance directly to the system's global dashboard metrics!
      const submission: UserAnswerSubmission = {
        subject: "Mock Tests",
        chapterId: selectedMock.chapterId,
        chapterName: selectedMock.name,
        questionId: q.id,
        questionText: q.question,
        options: q.options,
        explanation: q.explanation,
        examTrick: q.examTrick,
        correctAnswer: q.answer,
        userAnswer: userAnswer,
        confidence: "Very Sure",
        isCorrect: isCorrect
      };
      
      // Persist asynchronously; failures are logged but don't block the results screen
      onSubmitAnswer(submission).catch(err => console.error("Error submitting mock answer:", err));

      return {
        question: q,
        userAnswer,
        isCorrect,
        savedToMistakes: false
      };
    });

    setSavedExamResult({
      score: correctCount,
      total: questions.length,
      accuracy: Math.round((correctCount / questions.length) * 100) || 0,
      timeSpentSeconds: timeSpent,
      subjectStats: subjStats,
      questionReviews: reviews
    });
    
    setVisibleReviewsCount(15);
    setActiveView("results");
  };

  // Manual Submit button click
  const handleManualSubmit = () => {
    setShowSubmitConfirm(true);
  };

  const confirmSubmit = () => {
    setShowSubmitConfirm(false);
    if (timerRef.current) clearInterval(timerRef.current);
    processSubmission();
  };

  // Question navigation helpers
  const handleSelectQuestion = (index: number) => {
    setCurrentIndex(index);
    const q = questions[index];
    setVisited((prev) => ({ ...prev, [q.id]: true }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      handleSelectQuestion(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectQuestion(currentIndex - 1);
    }
  };

  const handleSelectOption = (option: string) => {
    const q = questions[currentIndex];
    setAnswers((prev) => ({ ...prev, [q.id]: option }));
  };

  const handleClearOption = () => {
    const q = questions[currentIndex];
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[q.id];
      return copy;
    });
  };

  const handleToggleFlag = () => {
    const q = questions[currentIndex];
    setFlagged((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
  };

  // Save specific missed mock question directly to standard Mistake Book
  const handleSaveToMistakes = async (reviewIndex: number) => {
    if (!savedExamResult) return;
    const review = savedExamResult.questionReviews[reviewIndex];
    if (review.savedToMistakes) return;

    try {
      // Send answer as incorrect to force it into the Mistake Book system-wide
      const submission: UserAnswerSubmission = {
        subject: "Mock Tests",
        chapterId: selectedMock?.chapterId || "mock",
        chapterName: selectedMock?.name || "Mock Test",
        questionId: review.question.id,
        questionText: review.question.question,
        options: review.question.options,
        explanation: review.question.explanation,
        examTrick: review.question.examTrick,
        correctAnswer: review.question.answer,
        userAnswer: review.userAnswer || "Skipped",
        confidence: "Guess",
        isCorrect: false // Forcing false forces inclusion into progress.mistakes
      };

      await onSubmitAnswer(submission);
      
      // Update state to show saved
      setSavedExamResult(prev => {
        if (!prev) return prev;
        const copyReviews = [...prev.questionReviews];
        copyReviews[reviewIndex] = { ...copyReviews[reviewIndex], savedToMistakes: true };
        return { ...prev, questionReviews: copyReviews };
      });
      showToast("Added to Mistakes.");
    } catch (e) {
      console.error("Failed to sync mistake", e);
    }
  };

  // Formatting helpers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Count states for grid display
  const totalAnswered = Object.keys(answers).length;
  const totalFlaged = Object.keys(flagged).filter(k => flagged[Number(k)]).length;
  const totalUnvisited = questions.length - Object.keys(visited).length;

  return (
    <div className="space-y-6">
      
      {/* 1. MOCK TEST SELECTION TAB SCREEN */}
      {activeView === "selection" && (() => {
        const resolveMockExam = (exam: MockExam) =>
          resolveExamForEntry({ exam: exam.exam, subject: exam.subject, chapterId: exam.chapterId, name: exam.name });

        // Everything on this screen is scoped to the selected workspace: with a
        // track chosen, the other exam's mocks, filters, counts, and syllabus
        // tags must not appear at all. "all" is the only case that shows both.
        const examsInScope = selectedExam === "all"
          ? EXAM_REGISTRY
          : EXAM_REGISTRY.filter(e => e.id === selectedExam);
        const scopedMocks = selectedExam === "all"
          ? mockExams
          : mockExams.filter(e => resolveMockExam(e).id === selectedExam);
        const scopeLabel = selectedExam === "all"
          ? "All Tracks"
          : examsInScope[0]?.shortName || "All Tracks";

        // One filter option per exam without paper groupings, or one per paper for exams that declare them.
        const filterOptions: { value: string; label: string; count: number; colorKey: string }[] = [];
        examsInScope.forEach((exam) => {
          if (exam.papers && exam.papers.length > 0) {
            exam.papers.forEach((paper) => {
              filterOptions.push({
                value: paper.id,
                label: paper.label,
                count: scopedMocks.filter(e => e.paper === paper.id).length,
                colorKey: paper.color || exam.color,
              });
            });
          } else {
            filterOptions.push({
              value: exam.id,
              label: `${exam.shortName} Mocks`,
              count: scopedMocks.filter(e => resolveMockExam(e).id === exam.id).length,
              colorKey: exam.color,
            });
          }
        });
        const activeFilterOption = filterOptions.find(o => o.value === selectedPaperFilter);

        const filteredExams = scopedMocks.filter((exam) => {
          if (selectedPaperFilter === "All") return true;
          const examDef = resolveMockExam(exam);
          if (examDef.papers && examDef.papers.length > 0) {
            return exam.paper === selectedPaperFilter;
          }
          return examDef.id === selectedPaperFilter;
        });

        const totalMockQuestions = scopedMocks.reduce((sum, m) => sum + m.questionsCount, 0);
        const allSyllabusTopics = Array.from(new Set(examsInScope.flatMap(e => e.mockBannerTags || e.mockSyllabusTags)));

        return (
          <div className="space-y-6 animate-fade-in pb-12 w-full max-w-7xl mx-auto">
            {/* 1. Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                  SIMULATOR
                </span>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                  Mock Tests
                </h1>
                <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
                  Timed practice exams for {examsInScope.map(e => e.shortName).join(" and ")} with full performance diagnostics.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onRefreshContent}
                  className="inline-flex items-center gap-2 bg-white border border-slate-200/90 text-slate-700 text-xs px-3.5 py-2 rounded-xl shadow-3xs cursor-pointer hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-medium">Refresh Content</span>
                </button>
              </div>
            </div>

            {/* 2. Top Stats Grid - Proportional, Uniform Height */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Available Mocks */}
              <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#6366F1] flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
                    {scopedMocks.length}
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
                    Available Mock Series
                  </div>
                </div>
              </div>

              {/* Card 2: Total Questions */}
              <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#E0EEFD] text-[#2563EB] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
                    {totalMockQuestions}
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
                    Curated Simulation MCQs
                  </div>
                </div>
              </div>

              {/* Card 3: Standard Timer */}
              <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#10B981] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
                    60 Mins
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
                    Standard Exam Window
                  </div>
                </div>
              </div>

              {/* Card 4: High-Yield Topics */}
              <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#FEE8D8] text-[#EA580C] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 leading-tight">
                    {allSyllabusTopics.length}
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-0.5 truncate">
                    High-Yield Topics Covered
                  </div>
                </div>
              </div>
            </div>

            {/* Syllabus Banner */}
            <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-2xl shadow-3xs">
              <div className="space-y-2.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                  <h2 className="font-display text-base font-bold text-slate-900">Official Exam Simulation Engine</h2>
                </div>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                  Real exam conditions with live countdown timers, a question palette to flag and jump between items, instant scoring, and one-click export of missed questions to your Mistakes book.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {allSyllabusTopics.map((topic) => (
                    <span key={topic} className="text-[11px] font-semibold bg-[#F8F7FF] text-indigo-700 border border-[#EDE9FE] px-2.5 py-0.5 rounded-md">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Sub-Sidebar Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Left Sidebar Sections */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white border border-slate-100 p-4 sm:p-5 rounded-2xl space-y-3 shadow-3xs">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide block border-b border-slate-100 pb-2.5">
                    Filter Series
                  </h3>
                  <nav className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                    <button
                      onClick={() => setSelectedPaperFilter("All")}
                      className={`w-full text-left px-3.5 py-2.5 min-h-11 sm:min-h-0 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 shrink-0 cursor-pointer ${
                        selectedPaperFilter === "All"
                          ? "bg-indigo-600 text-white shadow-3xs"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>All Mock Series</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        selectedPaperFilter === "All" ? "bg-white/20 text-white" : "bg-slate-150 text-slate-500"
                      }`}>
                        {scopedMocks.length}
                      </span>
                    </button>

                    {filterOptions.map((opt) => {
                      const optColors = getColorClasses(opt.colorKey);
                      const isActive = selectedPaperFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedPaperFilter(opt.value)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 shrink-0 cursor-pointer ${
                            isActive
                              ? `${optColors.solidBg} text-white shadow-3xs`
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{opt.label}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isActive ? "bg-white/20 text-white" : "bg-slate-150 text-slate-500"
                          }`}>
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Strategy Insight Card */}
                <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 rounded-2xl hidden lg:block space-y-2">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide block">
                    Simulation Tip
                  </span>
                  <p className="text-xs text-indigo-950/80 leading-relaxed">
                    The timer and question palette match the real exam. Flag questions you're unsure of and return to them before submitting.
                  </p>
                </div>
              </div>

              {/* Right Mock Sheet Grid */}
              <div className="lg:col-span-3 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Available Exams ({selectedPaperFilter === "All" ? scopeLabel : activeFilterOption?.label || selectedPaperFilter})
                </h3>

                {filteredExams.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-slate-400 text-sm">
                    {scopedMocks.length === 0
                      ? `No mock tests in the ${scopeLabel} track yet.`
                      : "No exams match this filter."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredExams.map((exam) => {
                      const examDef = resolveMockExam(exam);
                      const paper = examDef.papers?.find(p => p.id === exam.paper);
                      const cardColors = getColorClasses(paper?.color || examDef.color);
                      const badgeLabel = paper
                        ? `${examDef.shortName.toUpperCase()}: ${(paper.tag || paper.label).toUpperCase()}`
                        : `${examDef.shortName.toUpperCase()} CERTIFICATION`;
                      return (
                        <div
                          key={exam.id}
                          className="bg-white border border-slate-100 hover:border-indigo-200 rounded-2xl p-5 sm:p-6 shadow-3xs hover:shadow-2xs transition-all flex flex-col justify-between space-y-5 group"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 border text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-lg ${cardColors.badgeBg} ${cardColors.badgeBorder} ${cardColors.badgeText}`}>
                                {badgeLabel}
                              </span>
                              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {exam.durationMinutes} Mins
                              </span>
                            </div>

                            <h4 className="font-display text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {exam.name}
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                              {exam.description}
                            </p>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {exam.syllabus.slice(0, 4).map(s => (
                                <span key={s} className="text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-150 px-2 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                            <div className="text-xs text-slate-500">
                              Pool: <strong className="text-slate-800 font-bold font-mono">{exam.questionsCount} MCQs</strong>
                            </div>
                            <button
                              onClick={() => handleSelectMock(exam)}
                              className={`inline-flex items-center gap-2 text-xs font-bold text-white px-4 py-2.5 min-h-11 sm:min-h-0 rounded-xl shadow-3xs transition-all cursor-pointer ${cardColors.solidBg} ${cardColors.solidHoverBg}`}
                            >
                              Start Exam <Play className="w-3 h-3 text-white fill-white" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 2. PRE-EXAM INSTRUCTIONS SCREEN */}
      {activeView === "instructions" && selectedMock && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-2xl p-8 shadow-sm space-y-6 animate-fade-in">
          
          {/* Header */}
          <div className="border-b border-slate-100 pb-5 text-center space-y-2">
            <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-800">
              Exam Instructions
            </h2>
            <p className="text-xs text-slate-400">
              {selectedMock.name}
            </p>
          </div>

          {/* Exam Specs Grid */}
          <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">Duration</span>
              <span className="text-base font-display font-extrabold text-slate-800">{selectedMock.durationMinutes} min</span>
            </div>
            <div className="space-y-1 border-x border-slate-200">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">Questions</span>
              <span className="text-base font-display font-extrabold text-slate-800">{loadingQuestions ? "Loading…" : questions.length}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block">Marking</span>
              <span className="text-base font-display font-extrabold text-emerald-600">+1 / 0</span>
            </div>
          </div>

          {/* Instructions List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Guidelines</h3>
            <ul className="text-xs text-slate-600 space-y-2.5 list-disc pl-5 leading-relaxed">
              <li>This is a <strong>strictly timed</strong> exam. Once started, the countdown timer cannot be paused.</li>
              <li>There is <strong>no negative marking</strong>. Unanswered questions receive 0 marks.</li>
              <li>The <strong>question palette</strong> on the right lets you jump between questions and see which ones you've visited or flagged.</li>
              <li>Click <strong>"Mark for Review & Next"</strong> to flag a question to revisit later.</li>
              <li>Explanations and exam tips stay hidden until you <strong>submit the exam</strong>.</li>
              <li>When the timer hits zero, your saved answers are submitted automatically.</li>
            </ul>
          </div>

          {/* AI Question Expansion — hidden unless the deployment can persist
              the generated questions (shared/capabilities.ts). */}
          {canExpandWithAi && (
          <div className="bg-indigo-50/60 border border-indigo-100 p-5 rounded-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-700" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-extrabold text-indigo-950 text-sm">
                  Need more questions?
                </h4>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  This {resolveExamForEntry({ exam: selectedMock?.exam, subject: selectedMock?.subject, chapterId: selectedMock?.chapterId, name: selectedMock?.name }).shortName} mock has {questions.length} questions loaded by default. Use AI to expand it to a full 100-question set.
                </p>
              </div>
            </div>

            {expansionStatus && (
              <div className="p-3 bg-white border border-indigo-100 rounded-xl text-xs font-mono text-indigo-700 font-semibold animate-pulse">
                {expansionStatus}
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleExpandMock(20)}
                disabled={expanding || questions.length >= 100}
                className="inline-flex items-center gap-1.5 text-xs font-bold font-mono bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 px-3.5 py-2.5 min-h-11 sm:min-h-0 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${expanding ? "animate-spin" : ""}`} />
                Add 20 MCQs
              </button>
              <button
                onClick={() => handleExpandMock(40)}
                disabled={expanding || questions.length >= 100}
                className="inline-flex items-center gap-1.5 text-xs font-bold font-mono bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 px-4 py-2.5 min-h-11 sm:min-h-0 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Add 40 MCQs
              </button>
              {questions.length >= 100 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 min-h-11 sm:min-h-0 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Fully Expanded Master (100 MCQ Series)
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 self-center">
                  Target: {questions.length} / 100 Questions
                </span>
              )}
            </div>
          </div>
          )}

          {/* Action Buttons */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
            <button
              onClick={() => setActiveView("selection")}
              className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-slate-400 hover:text-slate-700 bg-white border border-slate-200 px-4 py-3 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Selection
            </button>
            <button
              onClick={handleStartExam}
              disabled={loadingQuestions}
              className="inline-flex items-center gap-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer"
            >
              {loadingQuestions ? "Preparing Engine..." : "Initialize Simulation"}
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 3. ACTIVE SIMULATOR CONSOLE */}
      {activeView === "simulator" && questions.length > 0 && (
        <div className="space-y-6">
          
          {/* Main Dark Simulator HUD */}
          <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between text-white gap-4 shadow-lg">
            <div className="space-y-1 text-center md:text-left min-w-0 w-full md:w-auto">
              <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide flex items-center justify-center md:justify-start gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Exam in progress
              </div>
              <h2 className="text-sm sm:text-base font-bold font-display leading-tight truncate max-w-full md:max-w-xl">
                {selectedMock?.name}
              </h2>
            </div>
            
            {/* Ticking Clock with low-time warning alerts */}
            <div className={`flex items-center gap-3 px-4 py-2 border rounded-xl font-mono shrink-0 ${
              timeRemaining < 300 
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse font-bold" 
                : "bg-slate-800/50 border-slate-800 text-slate-200"
            }`}>
              <Clock className={`w-4 h-4 ${timeRemaining < 300 ? "text-rose-400" : "text-indigo-400"}`} />
              <div className="text-right">
                <span className="text-[10px] block font-semibold leading-none text-slate-500 mb-0.5">TIME REMAINING</span>
                <span className="text-base leading-none tracking-wider">{formatTime(timeRemaining)}</span>
              </div>
            </div>
          </div>

          {/* Double Column Grid: Left is Question Card, Right is Question Palette */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Left Column (Main Question panel - Span 3) */}
            <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between min-h-[500px]">
              
              {/* Question Header Status */}
              <div className="space-y-6">
                <div className="flex items-center justify-between text-[10px] font-mono border-b border-slate-100 pb-4">
                  <span className="text-slate-400 uppercase font-bold">
                    ITEM {currentIndex + 1} OF {questions.length}
                  </span>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 border rounded-md font-bold uppercase tracking-wider ${
                      questions[currentIndex].difficulty === "Easy" 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                        : questions[currentIndex].difficulty === "Medium" 
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                        : "bg-rose-50 border-rose-100 text-rose-700"
                    }`}>
                      {questions[currentIndex].difficulty}
                    </span>
                    <span className="text-slate-400">
                      Syllabus: <strong className="text-slate-600">{questions[currentIndex].tags?.[0] || "General CS"}</strong>
                    </span>
                  </div>
                </div>

                {/* Question Body */}
                <div className="space-y-6">
                  <h3 className="font-display font-bold text-slate-800 text-base leading-relaxed">
                    <RichText>{questions[currentIndex].question}</RichText>
                  </h3>

                  {/* Options Stack */}
                  <div className="grid grid-cols-1 gap-3.5">
                    {questions[currentIndex].options.map((option, idx) => {
                      const letters = ["A", "B", "C", "D", "E"];
                      const isSelected = answers[questions[currentIndex].id] === option;
                      return (
                        <button
                          key={option}
                          onClick={() => handleSelectOption(option)}
                          className={`w-full text-left px-5 py-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10 font-bold"
                              : "bg-slate-50/50 border-slate-150 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <span className={`w-6 h-6 rounded-lg text-[10px] font-bold font-mono flex items-center justify-center border transition-all ${
                              isSelected
                                ? "bg-white/20 text-white border-white/20"
                                : "bg-white text-slate-400 border-slate-200 group-hover:border-slate-300"
                            }`}>
                              {letters[idx]}
                            </span>
                            <span><RichText inline>{option}</RichText></span>
                          </div>
                          {isSelected && (
                            <div className="p-1 bg-white/20 rounded-full">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Card Controls */}
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="inline-flex items-center gap-1 text-xs font-bold font-mono text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 px-3 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> PREV
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentIndex === questions.length - 1}
                    className="inline-flex items-center gap-1 text-xs font-bold font-mono text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 px-3 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    NEXT <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearOption}
                    disabled={!answers[questions[currentIndex].id]}
                    className="text-xs font-bold font-mono text-slate-400 hover:text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl transition-all disabled:opacity-40 cursor-pointer"
                  >
                    CLEAR ANSWER
                  </button>
                  <button
                    onClick={handleToggleFlag}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold font-mono px-3 py-2 rounded-xl transition-all border cursor-pointer ${
                      flagged[questions[currentIndex].id]
                        ? "bg-purple-50 border-purple-200 text-purple-700"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${flagged[questions[currentIndex].id] ? "fill-purple-600" : ""}`} />
                    {flagged[questions[currentIndex].id] ? "FLAGGED" : "MARK REVIEW"}
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column (Question Palette Console - Span 1) */}
            <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 shadow-xs space-y-6">
              
              {/* Stats HUD */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Question Status</h3>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[9px] font-mono text-slate-500 block mb-0.5 uppercase">Answered</span>
                    <strong className="text-sm font-display font-bold text-emerald-400">{totalAnswered}</strong>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/60">
                    <span className="text-[9px] font-mono text-slate-500 block mb-0.5 uppercase">Flagged</span>
                    <strong className="text-sm font-display font-bold text-purple-400">{totalFlaged}</strong>
                  </div>
                </div>
              </div>

              {/* Grid Palette */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase">
                  <span>Questions Palette</span>
                  <span className="text-[9px] text-slate-500">{questions.length} Items</span>
                </div>
                
                <div className="grid grid-cols-5 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {questions.map((q, idx) => {
                    const isCurrent = currentIndex === idx;
                    const isAnswered = !!answers[q.id];
                    const isFlagged = flagged[q.id];
                    
                    let bgStyle = "bg-slate-800 text-slate-400 border border-slate-800/60 hover:border-slate-700";
                    if (isAnswered) {
                      bgStyle = "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20";
                    }
                    if (isFlagged) {
                      bgStyle = "bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30";
                    }
                    if (isCurrent) {
                      bgStyle = "bg-indigo-600 border border-indigo-600 text-white font-bold ring-2 ring-indigo-400/20";
                    }

                    return (
                      <button
                        key={q.id}
                        onClick={() => handleSelectQuestion(idx)}
                        className={`w-full aspect-square flex items-center justify-center text-xs font-mono font-bold rounded-xl transition-all cursor-pointer ${bgStyle}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <button
                  onClick={handleManualSubmit}
                  className="w-full text-center py-3 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-sm text-white"
                >
                  Submit Exam
                </button>
                <p className="text-[10px] text-slate-500 text-center leading-normal">
                  This stops the timer and finalizes your answers.
                </p>
              </div>

            </div>

          </div>

          {/*
            On phones the palette console (and its Submit button) stacks below a
            tall question card, so submitting meant scrolling past the whole
            question. This pins the exam-critical actions to the bottom instead.
          */}
          <div className="lg:hidden sticky bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-sm border-t border-slate-200 flex items-center gap-2 shadow-[0_-2px_12px_rgba(15,23,42,0.06)]">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Previous question"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40 transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              aria-label="Next question"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-40 transition-all cursor-pointer shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center text-[11px] font-mono font-bold text-slate-400 min-w-0 truncate">
              {totalAnswered}/{questions.length} answered
            </div>
            <button
              onClick={handleManualSubmit}
              className="inline-flex items-center justify-center min-h-11 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-sm shrink-0"
            >
              Submit
            </button>
          </div>

        </div>
      )}

      {/* 4. POST-EXAM RESULTS HUB */}
      {activeView === "results" && savedExamResult && selectedMock && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Results Board */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 md:p-8 shadow-3xs space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-6 gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold font-mono text-indigo-600 bg-[#F8F7FF] border border-[#EDE9FE] px-2.5 py-0.5 rounded-md uppercase tracking-wider inline-block">
                  Simulation Finished
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Performance Diagnostics Hub
                </h1>
                <p className="text-slate-500 text-xs sm:text-sm">
                  Reviewing diagnostics for: <strong className="text-slate-800">{selectedMock.name}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveView("selection");
                  setSelectedMock(null);
                  setSavedExamResult(null);
                  setVisibleReviewsCount(15);
                }}
                className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-3xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Return to Mock Tests
              </button>
            </div>

            {/* Results Grid Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F8F7FF] border border-[#EDE9FE] p-4 sm:p-5 rounded-2xl shadow-3xs text-center space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide block">Final Score</span>
                <span className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900">
                  {savedExamResult.score} <span className="text-sm font-medium text-slate-400">/ {savedExamResult.total} Marks</span>
                </span>
              </div>
              <div className="bg-[#F4F8FE] border border-[#E0EEFD] p-4 sm:p-5 rounded-2xl shadow-3xs text-center space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide block">Accuracy</span>
                <span className="text-2xl sm:text-3xl font-display font-extrabold text-[#2563EB]">
                  {savedExamResult.accuracy}%
                </span>
              </div>
              <div className="bg-[#F4FBF7] border border-[#DCFCE7] p-4 sm:p-5 rounded-2xl shadow-3xs text-center space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide block">Time Spent</span>
                <span className="text-2xl sm:text-3xl font-display font-extrabold text-[#10B981]">
                  {formatTime(savedExamResult.timeSpentSeconds)}
                </span>
              </div>
              <div className="bg-[#FFF7F4] border border-[#FEE8D8] p-4 sm:p-5 rounded-2xl shadow-3xs text-center space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide block">Diagnostic Grade</span>
                <span className={`text-xl sm:text-2xl font-display font-extrabold block uppercase ${
                  savedExamResult.accuracy >= 80 
                    ? "text-[#10B981]" 
                    : savedExamResult.accuracy >= 60 
                    ? "text-[#2563EB]" 
                    : "text-[#EA580C]"
                }`}>
                  {savedExamResult.accuracy >= 85
                    ? "Excellent"
                    : savedExamResult.accuracy >= 70
                    ? "Qualified"
                    : "Needs revision"}
                </span>
              </div>
            </div>

            {/* Subject wise Diagnostics breakdown */}
            <div className="space-y-3.5 pt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Breakdown by Domain</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(savedExamResult.subjectStats).map(([subj, statValue]) => {
                  const stat = statValue as { total: number; correct: number };
                  const pct = Math.round((stat.correct / stat.total) * 100) || 0;
                  return (
                    <div key={subj} className="border border-slate-100 p-4 rounded-xl space-y-2 text-xs bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 truncate max-w-[150px]">{subj}</span>
                        <span className="font-semibold text-slate-500">{stat.correct} / {stat.total} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Question-by-Question Solution walkthrough panel */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Academic Solutions & Expert Tricks Walkthrough</h3>
            
            <div className="space-y-4">
              {savedExamResult.questionReviews.slice(0, visibleReviewsCount).map((review, idx) => {
                const letters = ["A", "B", "C", "D", "E"];
                return (
                  <div 
                    key={review.question.id}
                    className={`bg-white border rounded-2xl p-6 md:p-8 shadow-xs space-y-6 ${
                      review.isCorrect 
                        ? "border-emerald-100/80 bg-emerald-50/5" 
                        : review.userAnswer === "" 
                        ? "border-slate-100" 
                        : "border-rose-100/80 bg-rose-50/5"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
                          ITEM {idx + 1}
                        </span>
                        {review.isCorrect ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase text-[10px]">
                            <CheckCircle className="w-3.5 h-3.5" /> Correct
                          </span>
                        ) : review.userAnswer === "" ? (
                          <span className="text-slate-500 font-bold flex items-center gap-1 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded uppercase text-[10px]">
                            Skipped
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-1 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded uppercase text-[10px]">
                            <XCircle className="w-3.5 h-3.5" /> Missed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">
                          Syllabus: <strong className="text-slate-600">{review.question.tags?.[0] || "General CS"}</strong>
                        </span>
                        {!review.isCorrect && (
                          <button
                            onClick={() => handleSaveToMistakes(idx)}
                            disabled={review.savedToMistakes}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              review.savedToMistakes
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            <Bookmark className="w-3 h-3" />
                            {review.savedToMistakes ? "LOGGED IN MISTAKES" : "LOG IN MISTAKE BOOK"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question Statement */}
                    <h4 className="font-display font-bold text-slate-800 text-sm md:text-base leading-relaxed">
                      <RichText>{review.question.question}</RichText>
                    </h4>

                    {/* Options Stack */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                      {review.question.options.map((option, oIdx) => {
                        const isCorrectOption = option === review.question.answer;
                        const isUserOption = option === review.userAnswer;
                        
                        let optionStyle = "border-slate-150 bg-slate-50/50 text-slate-600";
                        if (isCorrectOption) {
                          optionStyle = "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs";
                        } else if (isUserOption) {
                          optionStyle = "bg-rose-50 border-rose-300 text-rose-800 font-bold shadow-xs";
                        }

                        return (
                          <div
                            key={option}
                            className={`px-4 py-3 border rounded-xl flex items-center justify-between gap-3 ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-5 h-5 text-[9px] font-bold font-mono flex items-center justify-center border rounded ${
                                isCorrectOption
                                  ? "bg-emerald-500 text-white border-emerald-500"
                                  : isUserOption
                                  ? "bg-rose-500 text-white border-rose-500"
                                  : "bg-white text-slate-400 border-slate-200"
                              }`}>
                                {letters[oIdx]}
                              </span>
                              <span><RichText inline>{option}</RichText></span>
                            </div>

                            {isCorrectOption && (
                              <span className="text-[10px] bg-emerald-100/60 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                                CORRECT
                              </span>
                            )}
                            {isUserOption && !isCorrectOption && (
                              <span className="text-[10px] bg-rose-100/60 text-rose-800 font-bold px-2 py-0.5 rounded font-mono">
                                YOUR CHOICE
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Expandable Explanation block */}
                    <div className="bg-slate-50 border border-slate-150/60 rounded-2xl p-5 md:p-4 sm:p-6 space-y-4">
                      
                      {/* Detailed Solution */}
                      <div className="space-y-1 text-xs">
                        <h5 className="font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Explanation
                        </h5>
                        <div className="text-slate-600 leading-relaxed pt-1">
                          <RichText>{review.question.explanation}</RichText>
                        </div>
                      </div>

                      {/* Exam Trick */}
                      <div className="border-t border-slate-200/50 pt-4 space-y-1.5 text-xs">
                        <h5 className="font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Tip
                        </h5>
                        <div className="bg-amber-50/60 border border-amber-100 p-3.5 rounded-xl text-amber-900 leading-relaxed">
                          <RichText>{review.question.examTrick}</RichText>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}

              {/* Lazy Loading pagination button control */}
              {visibleReviewsCount < savedExamResult.questionReviews.length && (
                <div className="pt-4 pb-8 text-center">
                  <button
                    onClick={() => setVisibleReviewsCount((prev) => Math.min(prev + 15, savedExamResult.questionReviews.length))}
                    className="inline-flex items-center gap-2 text-xs font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-6 py-3.5 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                    Load More Solutions (+15 of {savedExamResult.questionReviews.length - visibleReviewsCount} remaining)
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 5. SUBMIT CONFIRM MODAL OVERLAY */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-150 rounded-2xl p-4 sm:p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            <div className="text-center space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-800">
                Submit this exam?
              </h3>
              <p className="text-slate-400 text-xs">
                You won't be able to change your answers after submitting.
              </p>
            </div>

            {/* Exam action Audit stats */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Questions:</span>
                <strong className="text-slate-700 font-bold">{questions.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Answered Questions:</span>
                <strong className="text-emerald-600 font-bold">{totalAnswered}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Marked for Review:</span>
                <strong className="text-purple-600 font-bold">{totalFlaged}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Unanswered / Skipped:</span>
                <strong className="text-rose-500 font-extrabold">{questions.length - totalAnswered}</strong>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="w-1/2 py-2.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer"
              >
                CANCEL & RESUME
              </button>
              <button
                onClick={confirmSubmit}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer shadow-sm shadow-rose-600/10"
              >
                YES, SUBMIT EXAM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Toast Banner Overlay */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-800 px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 max-w-sm animate-slide-up text-xs font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
