/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  AlertTriangle,
  RefreshCw,
  BarChart,
  Upload,
  CheckCircle,
  HelpCircle,
  Menu,
  X,
  Play,
  Award,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Trash2,
  Sparkles,
  Smartphone,
  Share2,
  Code2,
  Database,
  Wrench,
  Box,
  FileText,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

import { Subject, Chapter, Question, UserProgress, UserAnswerSubmission } from "./types";
import Dashboard from "./components/Dashboard";
import SubjectView from "./components/SubjectView";
import ChapterView from "./components/ChapterView";
import PracticeSession from "./components/PracticeSession";
import MistakeBook from "./components/MistakeBook";
import RevisionEngine from "./components/RevisionEngine";
import AnalyticsView from "./components/AnalyticsView";
import ContentPackManager from "./components/ContentPackManager";
import MockTestArena from "./components/MockTestArena";
import MobileAppHub from "./components/MobileAppHub";
import ExamSelectorModal from "./components/ExamSelectorModal";
import { EXAM_REGISTRY, ExamDefinition, getExamById, resolveExamForSubject, resolveExamForEntry } from "../shared/exams";
import { compareSubjects, compareChapters } from "../shared/sorting";
import { getExamIcon, getExamColorClasses, ExamColorClasses } from "./lib/examTheme";
import { getProgressStore } from "./lib/progressStore";
import { getCapabilities } from "./lib/capabilityStore";
import { fetchSubjects, fetchChapter } from "./lib/contentStore";
import { shuffled } from "./lib/shuffle";
import { NO_CAPABILITIES, type AppCapabilities } from "../shared/capabilities";

// Nav items double as the route map — each id's path is the single source of truth
// for both the sidebar links and the <Routes> below.
const navItems = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "subjects", name: "Subjects", icon: BookOpen, path: "/subjects" },
  { id: "mock-tests", name: "Mock Tests", icon: Award, path: "/mock-tests" },
  { id: "mistakes", name: "Mistakes", icon: AlertTriangle, path: "/mistakes", badgeKey: "mistakes" as const },
  { id: "revision", name: "Revision", icon: RefreshCw, path: "/revision" },
  { id: "analytics", name: "Analytics", icon: BarChart, path: "/analytics" },
  { id: "mobile-app", name: "Mobile App", icon: Smartphone, path: "/mobile-app" },
  { id: "content-manager", name: "Content Manager", icon: Upload, path: "/content-manager" },
];

// ---------------------------------------------------------------------------
// Route pages that need URL params — kept in this file since they're small
// and only used here, but declared at module scope (not nested closures)
// so they don't remount on every App() render.
// ---------------------------------------------------------------------------

function getSubjectVisual(subjectName: string, index: number) {
  const name = subjectName.toLowerCase();
  if (name.includes("agent") || name.includes("orchestrat") || name.includes("network") || name.includes("architecture")) {
    return { Icon: Share2, bg: "bg-indigo-50/70", text: "text-indigo-600" };
  }
  if (name.includes("configuration") || name.includes("code") || name.includes("workflow") || name.includes("compiler") || name.includes("algorithm")) {
    return { Icon: Code2, bg: "bg-sky-50", text: "text-sky-600" };
  }
  if (name.includes("context") || name.includes("reliab") || name.includes("database") || name.includes("data")) {
    return { Icon: Database, bg: "bg-emerald-50", text: "text-emerald-600" };
  }
  if (name.includes("tool design") || name.includes("integration") || name.includes("organization")) {
    return { Icon: Wrench, bg: "bg-amber-50", text: "text-amber-600" };
  }
  if (name.includes("mcp & tool") || name.includes("mcp") || name.includes("operating") || name.includes("system")) {
    return { Icon: Box, bg: "bg-rose-50", text: "text-rose-600" };
  }
  if (name.includes("structured") || name.includes("output") || name.includes("doc") || name.includes("theory")) {
    return { Icon: FileText, bg: "bg-violet-50", text: "text-violet-600" };
  }
  if (name.includes("extract") || name.includes("chat") || name.includes("message") || name.includes("prompt")) {
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

interface SubjectsPageProps {
  subjects: Subject[];
  progress: UserProgress;
  selectedExam: string;
  activeExamConfig: ExamDefinition;
  activeExamColors: ExamColorClasses;
  onOpenExamSelector: () => void;
  onQuickPractice: (subjectName: string, chapter: Chapter) => void;
  pickChapterForSubject: (sub: Subject) => Chapter | null;
}

function SubjectsPage({
  subjects,
  progress,
  selectedExam,
  activeExamConfig,
  activeExamColors,
  onOpenExamSelector,
  onQuickPractice,
  pickChapterForSubject,
}: SubjectsPageProps) {
  const navigate = useNavigate();
  const [selectedPaperTab, setSelectedPaperTab] = useState<string>("all");

  // Filter Curriculum Subjects (excluding raw mock test folders from regular curriculum list)
  const curriculumSubjects = useMemo(
    () =>
      subjects
        .filter((s) => s.name !== "Mock Tests" && !s.name.toLowerCase().includes("mock"))
        .slice()
        .sort(compareSubjects),
    [subjects]
  );

  const filteredCurriculumSubjects = useMemo(
    () =>
      curriculumSubjects
        .filter((s) => {
          if (selectedExam === "all") return true;
          return resolveExamForSubject(s).id === selectedExam;
        })
        .slice()
        .sort(compareSubjects),
    [curriculumSubjects, selectedExam]
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb matching screenshot */}
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
        <span>{activeExamConfig.shortName}</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-500">SUBJECTS</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
            Subjects
          </h1>
          <p className="text-slate-500 text-xs">
            Chapters and practice questions for {activeExamConfig.name}.
          </p>
        </div>

        <button
          onClick={onOpenExamSelector}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50/70 border border-indigo-200/80 px-3.5 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors shadow-3xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> {activeExamConfig.shortName}
        </button>
      </div>

      {/* Tab Selection Filter — generic over the exam registry, so a new exam's
          own paper/domain groupings (or lack thereof) "just work" here. */}
      {selectedExam === "all" ? (
        <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
          <button
            onClick={() => setSelectedPaperTab("all")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              selectedPaperTab === "all"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            All Examination Tracks ({filteredCurriculumSubjects.length})
          </button>
          {EXAM_REGISTRY.map((exam) => {
            const colors = getExamColorClasses(exam);
            return (
              <button
                key={exam.id}
                onClick={() => setSelectedPaperTab(exam.id)}
                className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  selectedPaperTab === exam.id
                    ? `${colors.tabActiveBorder} ${colors.tabActiveText} font-bold`
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {exam.shortName} ({filteredCurriculumSubjects.filter(s => resolveExamForSubject(s).id === exam.id).length})
              </button>
            );
          })}
        </div>
      ) : activeExamConfig.papers && activeExamConfig.papers.length > 0 ? (
        <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
          <button
            onClick={() => setSelectedPaperTab("all")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              selectedPaperTab === "all"
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            All Papers ({filteredCurriculumSubjects.length})
          </button>
          {activeExamConfig.papers.map((paper) => (
            <button
              key={paper.id}
              onClick={() => setSelectedPaperTab(paper.id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedPaperTab === paper.id
                  ? "border-indigo-600 text-indigo-600 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {paper.label} ({filteredCurriculumSubjects.filter(s => s.paper === paper.id).length})
            </button>
          ))}
        </div>
      ) : (
        <div className="flex border-b border-slate-200 gap-6">
          <button className={`pb-3 text-sm font-semibold border-b-2 ${activeExamColors.tabActiveBorder} ${activeExamColors.tabActiveText} font-bold`}>
            All {activeExamConfig.shortName} Domains ({filteredCurriculumSubjects.length})
          </button>
        </div>
      )}

      {filteredCurriculumSubjects.length > 0 ? (
        <>
          {(() => {
            const activeShownSubjects = filteredCurriculumSubjects
              .filter(sub => {
                if (selectedExam === "all") {
                  return selectedPaperTab === "all" || resolveExamForSubject(sub).id === selectedPaperTab;
                }
                if (activeExamConfig.papers && activeExamConfig.papers.length > 0) {
                  return selectedPaperTab === "all" || sub.paper === selectedPaperTab;
                }
                return true;
              })
              .slice()
              .sort(compareSubjects);

            return activeShownSubjects.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeShownSubjects.map((sub, idx) => {
                  const attemptedKeys = Object.keys(progress.answeredQuestions);
                  let subAttempted = 0;
                  attemptedKeys.forEach((k) => {
                    if (k.startsWith(`${sub.name}:`)) subAttempted++;
                  });
                  const coveragePct = sub.totalQuestions > 0 ? Math.round((subAttempted / sub.totalQuestions) * 100) : 0;
                  const subExam = resolveExamForSubject(sub);
                  const subColors = getExamColorClasses(subExam);
                  const visual = getSubjectVisual(sub.name, idx);
                  const DomainIcon = visual.Icon;
                  const subBadgeLabel = sub.paper
                    ? `${subExam.shortName}: ${subExam.papers?.find(p => p.id === sub.paper)?.label || sub.paper}`
                    : `${subExam.shortName} Domain`;

                  return (
                    <div
                      key={sub.name}
                      onClick={() => navigate(`/subjects/${encodeURIComponent(sub.name)}`)}
                      className="bg-white border border-slate-200/80 hover:border-indigo-300 p-6 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start gap-4">
                          {/* Visual Domain Icon */}
                          <div className={`p-3.5 rounded-2xl shrink-0 ${visual.bg} ${visual.text}`}>
                            <DomainIcon className="w-6 h-6" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${subColors.badgeBg} ${subColors.badgeBorder} ${subColors.badgeText} border`}>
                                {subBadgeLabel}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 shrink-0">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                {sub.chapters.length} Chapters
                              </span>
                            </div>

                            <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mt-2 leading-snug">
                              {sub.name}
                            </h3>

                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                              Auto-discovered <strong className="text-slate-800 font-semibold">{sub.chapters.length}</strong> active content chapters containing <strong className="text-slate-800 font-semibold">{sub.totalQuestions}</strong> questions total.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-0 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Total Coverage</span>
                          <span className="font-bold text-slate-800 font-mono">{coveragePct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${subColors.solidBg}`} style={{ width: `${coveragePct}%` }} />
                        </div>

                        {(() => {
                          const chap = pickChapterForSubject(sub);
                          const isFullyDone = coveragePct === 100;
                          const isStarted = subAttempted > 0;
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (chap) onQuickPractice(sub.name, chap);
                              }}
                              className={`w-full mt-3 flex items-center justify-center relative font-semibold text-xs py-3 px-5 rounded-xl transition-all shadow-xs cursor-pointer group/btn ${
                                isFullyDone
                                  ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isFullyDone ? (
                                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                                )}
                                <span>
                                  {isFullyDone
                                    ? "Review Domain"
                                    : isStarted && chap
                                    ? `Continue: ${chap.name}`
                                    : "Practice"}
                                </span>
                              </div>
                              <ChevronRight className={`w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform absolute right-4 ${
                                isFullyDone ? "text-slate-400" : "text-white/80"
                              }`} />
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-white border border-dashed border-slate-100 rounded-2xl max-w-xl mx-auto space-y-4">
                <HelpCircle className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                <div className="space-y-1.5">
                  <h3 className="font-display text-base font-bold text-slate-800">Nothing here yet</h3>
                  <p className="text-slate-400 text-xs px-6">
                    No subjects match this filter. Try a different tab.
                  </p>
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <div className="text-center py-20 bg-white border border-dashed border-slate-100 rounded-2xl max-w-xl mx-auto space-y-4">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
          <div className="space-y-1.5">
            <h3 className="font-display text-base font-bold text-slate-800">No content yet</h3>
            <p className="text-slate-400 text-xs px-6">
              Add a content pack to get started, or use the <strong>Content Manager</strong> to upload one.
            </p>
          </div>
          <button
            onClick={() => navigate("/content-manager")}
            className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl hover:bg-indigo-100 cursor-pointer"
          >
            Go to Content Manager
          </button>
        </div>
      )}
    </div>
  );
}

interface SubjectDetailPageProps {
  subjects: Subject[];
  progress: UserProgress;
  onQuickPractice: (subjectName: string, chapter: Chapter) => void;
}

function SubjectDetailPage({ subjects, progress, onQuickPractice }: SubjectDetailPageProps) {
  const navigate = useNavigate();
  const { subjectSlug } = useParams();
  const subject = subjects.find((s) => s.name === decodeURIComponent(subjectSlug || ""));

  if (!subject) {
    // Content may still be loading, or the slug is stale — send back to the list rather than erroring.
    return <Navigate to="/subjects" replace />;
  }

  return (
    <SubjectView
      subject={subject}
      progress={progress}
      onBack={() => navigate("/subjects")}
      onSelectChapter={(subjectName, chapter) =>
        navigate(`/subjects/${encodeURIComponent(subjectName)}/${encodeURIComponent(chapter.id)}`)
      }
      onQuickPractice={onQuickPractice}
    />
  );
}

interface ChapterDetailPageProps {
  subjects: Subject[];
  progress: UserProgress;
  onStartSession: (
    questions: Question[],
    mode: "practice" | "revision" | "mistakes",
    chapterId: string,
    chapterName: string,
    subject: string,
    startIndex?: number
  ) => void;
}

function ChapterDetailPage({ subjects, progress, onStartSession }: ChapterDetailPageProps) {
  const navigate = useNavigate();
  const { subjectSlug, chapterId } = useParams();
  const subject = subjects.find((s) => s.name === decodeURIComponent(subjectSlug || ""));
  const chapter = subject?.chapters.find((c) => c.id === chapterId);

  if (!subject || !chapter) {
    return <Navigate to="/subjects" replace />;
  }

  return (
    <ChapterView
      subjectName={subject.name}
      chapter={chapter}
      progress={progress}
      onBack={() => navigate(`/subjects/${encodeURIComponent(subject.name)}`)}
      onStartSession={onStartSession}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Exam Selection State
  const [selectedExam, setSelectedExam] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("exam_scholar_active_track");
      return saved || "claude-ccaf";
    } catch {
      return "claude-ccaf";
    }
  });

  const [showExamModal, setShowExamModal] = useState(false);

  // Check if first-time visitor to pop open selector modal gently
  useEffect(() => {
    try {
      const hasChosen = localStorage.getItem("exam_scholar_has_chosen");
      if (!hasChosen) {
        setShowExamModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectExamTrack = (examId: string) => {
    setSelectedExam(examId);
    try {
      localStorage.setItem("exam_scholar_active_track", examId);
      localStorage.setItem("exam_scholar_has_chosen", "true");
    } catch (e) {
      console.error(e);
    }
  };

  // Navigation State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("cil_sidebar_collapsed");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cil_sidebar_collapsed", JSON.stringify(sidebarCollapsed));
    } catch (e) {
      console.error(e);
    }
  }, [sidebarCollapsed]);

  // Reset progress custom states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 4000);
  };

  // Content & Progress State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    answeredQuestions: {},
    recentActivity: [],
    mistakes: [],
  });

  // The only piece of "flow" state that can't live in the URL — an assembled,
  // ephemeral question set (custom revision/mistakes sets aren't reconstructable
  // from a route param). Entering it still pushes a real history entry.
  const [activeSession, setActiveSession] = useState<{
    questions: Question[];
    mode: "practice" | "revision" | "mistakes";
    chapterId: string;
    chapterName: string;
    subject: string;
    startIndex: number;
    clearPreviousAnswers?: boolean;
  } | null>(null);

  // Main workspace scroll container ref
  const workspaceScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on every navigation/view change
  useEffect(() => {
    if (workspaceScrollRef.current) {
      workspaceScrollRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, activeSession?.chapterId, selectedExam]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [capabilities, setCapabilities] = useState<AppCapabilities>(NO_CAPABILITIES);

  // Fetch all curriculum subjects & chapters (Auto Discovery API)
  const fetchCurriculum = async () => {
    try {
      const data = await fetchSubjects();
      const sorted = (data || [])
        .map((s) => ({
          ...s,
          chapters: (s.chapters || []).slice().sort(compareChapters),
        }))
        .sort(compareSubjects);
      setSubjects(sorted);
    } catch (e) {
      console.error("Error fetching discovered content packs", e);
    }
  };

  // Fetch active user stats & mistake books
  const fetchProgress = async () => {
    try {
      const data = await getProgressStore().getProgress();
      setProgress(data);
    } catch (e) {
      console.error("Error fetching student progress", e);
    }
  };

  // Which authoring features this deployment offers. Never rejects — a static
  // deploy with no server resolves to NO_CAPABILITIES.
  const fetchCapabilities = async () => {
    setCapabilities(await getCapabilities());
  };

  // Initial Boot loader
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCurriculum(), fetchProgress(), fetchCapabilities()]);
      setLoading(false);
    };
    init();
  }, []);

  // Synchronize on demand
  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchCurriculum(), fetchProgress()]);
    setRefreshing(false);
    showToastNotification("Content and progress refreshed.");
  };

  // Handle question submission from Practice/Exam session
  const handleSubmitAnswer = async (submission: UserAnswerSubmission) => {
    try {
      const updatedProgress = await getProgressStore().submitAnswer(submission);
      setProgress(updatedProgress);
      return updatedProgress;
    } catch (e) {
      console.error("Failed to persist answer record", e);
    }
  };

  // Handle clearing mistake book
  const handleClearMistakes = async () => {
    try {
      const updatedProgress = await getProgressStore().clearMistakes();
      setProgress(updatedProgress);
      showToastNotification("Mistakes cleared.");
    } catch (e) {
      console.error("Failed to clear mistake logs", e);
    }
  };

  // Reset all saved progress
  const handleClearProgress = () => {
    setShowResetConfirm(true);
  };

  const confirmClearProgress = async () => {
    setShowResetConfirm(false);
    try {
      const updatedProgress = await getProgressStore().clearProgress();
      setProgress(updatedProgress);
      showToastNotification("Progress reset.");
    } catch (e) {
      console.error("Failed to reset progress", e);
    }
  };

  // Handlers for subject & chapter selection — these keep the exact same
  // signatures the child components already expect; only the internals
  // changed from setState(tab) to navigate(path).
  const handleSelectChapter = (subjectName: string, chapter: Chapter) => {
    navigate(`/subjects/${encodeURIComponent(subjectName)}/${encodeURIComponent(chapter.id)}`);
  };

  const handleStartSession = (
    questions: Question[],
    mode: "practice" | "revision" | "mistakes",
    chapterId: string,
    chapterName: string,
    subject: string,
    startIndex: number = 0,
    clearPreviousAnswers: boolean = false
  ) => {
    setActiveSession({
      questions,
      mode,
      chapterId,
      chapterName,
      subject,
      startIndex,
      clearPreviousAnswers,
    });
    navigate("/practice-session");
  };

  const handleFinishSession = () => {
    setActiveSession(null);
    handleRefreshAll();
    // Return to whatever screen launched the session (a chapter, mistakes, revision, etc.)
    // instead of hardcoding a single fallback — this is what real history makes possible.
    navigate(-1);
  };

  // Pick which chapter to jump into for a subject-level "Practice" shortcut:
  // 1. If recent chapter in this subject is unfinished, resume it.
  // 2. If recent chapter was finished, automatically advance to the NEXT unfinished chapter in sequence.
  // 3. Otherwise, pick the first unfinished chapter in sequence.
  // 4. If all chapters are 100% completed, pick the chapter with lowest accuracy / most mistakes to review.
  const pickChapterForSubject = (sub: Subject): Chapter | null => {
    if (sub.chapters.length === 0) return null;
    const attemptedKeys = Object.keys(progress.answeredQuestions);

    const isChapFinished = (chap: Chapter) => {
      if (chap.questionsCount <= 0) return false;
      const attempted = attemptedKeys.filter((k) => k.startsWith(`${sub.name}:${chap.id}:`)).length;
      return attempted >= chap.questionsCount;
    };

    // 1. Check recent activity in this subject
    const recent = progress.recentActivity.find((r) => r.subject === sub.name);
    if (recent) {
      const recentIndex = sub.chapters.findIndex((c) => c.id === recent.chapterId);
      if (recentIndex !== -1) {
        const recentChap = sub.chapters[recentIndex];
        // If the recent chapter is still in progress (not finished), resume it!
        if (!isChapFinished(recentChap)) {
          return recentChap;
        }
        // If the recent chapter WAS finished, seamlessly advance to the NEXT unfinished chapter!
        for (let i = recentIndex + 1; i < sub.chapters.length; i++) {
          if (!isChapFinished(sub.chapters[i])) {
            return sub.chapters[i];
          }
        }
        // Also check any preceding chapters if user had skipped any:
        for (let i = 0; i < recentIndex; i++) {
          if (!isChapFinished(sub.chapters[i])) {
            return sub.chapters[i];
          }
        }
      }
    }

    // 2. Otherwise, find the first unfinished chapter in sequence:
    for (const chap of sub.chapters) {
      if (!isChapFinished(chap)) {
        return chap;
      }
    }

    // 3. If all chapters in the domain are completed, pick the chapter with lowest accuracy:
    let lowestAccChap: Chapter | null = null;
    let lowestAcc = 101;
    for (const chap of sub.chapters) {
      const prefix = `${sub.name}:${chap.id}:`;
      const chapKeys = attemptedKeys.filter((k) => k.startsWith(prefix));
      let correct = 0;
      chapKeys.forEach((k) => {
        if (progress.answeredQuestions[k]?.isCorrect) correct++;
      });
      const acc = chapKeys.length > 0 ? (correct / chapKeys.length) * 100 : 100;
      if (acc < lowestAcc) {
        lowestAcc = acc;
        lowestAccChap = chap;
      }
    }

    return lowestAccChap || sub.chapters[0];
  };

  // Skip the chapter-detail screen and jump straight into a practice session,
  // resuming at the first question this chapter hasn't been answered yet.
  const handleQuickPractice = async (subjectName: string, chapter: Chapter, retake: boolean = false) => {
    try {
      const data = await fetchChapter(subjectName, chapter.id);
      const chapterQuestions = (data.questions || []) as Question[];
      const firstUnanswered = chapterQuestions.findIndex(
        (q) => !progress.answeredQuestions[`${subjectName}:${chapter.id}:${q.id}`]
      );
      const isComplete = firstUnanswered < 0;
      handleStartSession(
        chapterQuestions,
        "practice",
        chapter.id,
        chapter.name,
        subjectName,
        isComplete ? 0 : firstUnanswered,
        retake
      );
      if (isComplete && !retake) {
        showToastNotification(`All questions in "${chapter.name}" are completed. Reviewing chapter.`);
      }
    } catch (e) {
      console.error("Quick practice failed", e);
      showToastNotification("Couldn't start practice — please try again.");
    }
  };

  const activeExamConfig = getExamById(selectedExam) || EXAM_REGISTRY[0];
  const ActiveExamIcon = getExamIcon(activeExamConfig);
  const activeExamColors = getExamColorClasses(activeExamConfig);

  // Translates the old tab-id vocabulary child components still use for onNavigate
  // props (Dashboard, MockTestArena) into a real route change.
  const navigateToTab = (tabId: string) => {
    const item = navItems.find((i) => i.id === tabId);
    navigate(item ? item.path : "/");
  };

  // Resolve the subject/chapter behind the current URL, purely for the topbar title —
  // the actual routed pages look these up themselves via useParams().
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const headerSubject = pathSegments[0] === "subjects" && pathSegments[1]
    ? subjects.find((s) => s.name === decodeURIComponent(pathSegments[1]))
    : undefined;
  const headerChapter = headerSubject && pathSegments[2]
    ? headerSubject.chapters.find((c) => c.id === decodeURIComponent(pathSegments[2]))
    : undefined;

  // Helper to obtain rich header titles, subtitles, and icons for the topbar
  const getHeaderInfo = () => {
    if (location.pathname === "/practice-session" && activeSession) {
      return {
        title: activeSession.chapterName,
        subtitle: `${activeSession.mode.charAt(0).toUpperCase()}${activeSession.mode.slice(1)} session in progress`,
        icon: GraduationCap,
        tag: "In progress"
      };
    }
    if (headerChapter && headerSubject) {
      return {
        title: headerChapter.name,
        subtitle: "Study notes and practice questions for this chapter",
        icon: GraduationCap,
        tag: "Chapter"
      };
    }
    if (headerSubject) {
      return {
        title: headerSubject.name,
        subtitle: `${headerSubject.chapters.length} chapters available`,
        icon: BookOpen,
        tag: "Subject"
      };
    }

    const activeItem = navItems.find(item =>
      item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
    );
    if (activeItem) {
      let subtitle = "";
      switch (activeItem.id) {
        case "dashboard":
          subtitle = `${activeExamConfig.name} — your progress and readiness at a glance`;
          break;
        case "subjects":
          subtitle = "Browse subjects, chapters, and practice questions";
          break;
        case "mock-tests":
          subtitle = "Timed practice exams that mirror the real test format";
          break;
        case "mistakes":
          subtitle = "Review and retry questions you've gotten wrong";
          break;
        case "revision":
          subtitle = "Build a custom practice set from any subject or topic";
          break;
        case "analytics":
          subtitle = "Accuracy, coverage, and progress over time";
          break;
        case "content-manager":
          subtitle = "Add or manage content packs";
          break;
        case "mobile-app":
          subtitle = "The companion offline mobile app (Expo / React Native)";
          break;
        default:
          subtitle = "Exam Scholar";
      }
      return {
        title: activeItem.name,
        subtitle,
        icon: activeItem.icon,
        tag: activeItem.name
      };
    }

    return {
      title: "Exam Scholar",
      subtitle: "Multi-exam preparation platform",
      icon: GraduationCap,
      tag: "Home"
    };
  };

  // Active mistakes for selected exam track
  const activeMistakes = useMemo(
    () =>
      (progress.mistakes || []).filter(m => {
        if (selectedExam === "all") return true;
        return resolveExamForEntry(m).id === selectedExam;
      }),
    [progress.mistakes, selectedExam]
  );

  // Overall questions and accuracy stats for the topbar / sidebar
  const totalQuestionsCount = useMemo(() => {
    let count = 0;
    for (const s of subjects) {
      for (const c of s.chapters) {
        count += c.questionsCount || 0;
      }
    }
    return count;
  }, [subjects]);

  const totalAnswered = useMemo(() => {
    return Object.keys(progress.answeredQuestions || {}).length;
  }, [progress.answeredQuestions]);

  const overallAccuracy = useMemo(() => {
    const answered = Object.values(progress.answeredQuestions || {});
    if (answered.length === 0) return 0;
    const correct = answered.filter((a) => a.isCorrect).length;
    return Math.round((correct / answered.length) * 100);
  }, [progress.answeredQuestions]);

  const isCollapsed = sidebarCollapsed && !isMobile;
  const headerInfo = getHeaderInfo();
  const HeaderIcon = headerInfo.icon;

  return (
    <div className="h-dvh overflow-hidden bg-slate-50/50 flex flex-col md:flex-row font-sans text-slate-700 antialiased">

      {/* 1. Mobile Top Navigation Bar */}
      <div className="md:hidden bg-slate-50 border-b border-slate-200 sticky top-0 z-30 shrink-0 h-16 px-4 flex items-center justify-between shadow-3xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl border ${activeExamColors.iconBg} ${activeExamColors.iconBorder} ${activeExamColors.iconText} shadow-3xs shrink-0`}>
            <ActiveExamIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="font-display font-bold tracking-tight text-sm text-slate-900 block leading-tight truncate">
              Exam Scholar
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block truncate">
              {activeExamConfig.shortName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="inline-flex items-center justify-center min-h-11 min-w-11 bg-white border border-slate-200 rounded-xl text-indigo-600 disabled:opacity-50 active:bg-slate-100 transition-all cursor-pointer shadow-3xs"
            title={refreshing ? "Refreshing…" : "Refresh"}
            aria-label="Refresh content"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex items-center justify-center min-h-11 min-w-11 hover:bg-slate-100 border border-slate-200 active:bg-slate-200 rounded-xl text-slate-600 transition-all cursor-pointer shadow-3xs"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-35 transition-opacity duration-300"
        />
      )}

      {/* 2. Responsive Left Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-slate-50 text-slate-700 flex flex-col justify-between border-r border-slate-200/90
        transition-all duration-300 ease-in-out transform md:translate-x-0 md:static md:inset-auto md:h-full shrink-0 select-none
        ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:shadow-none"}
        ${isCollapsed ? "w-64 md:w-20" : "w-64"}
      `}>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Unified Sidebar Header & Workspace Track Switcher */}
          <div className={`border-b border-slate-200/80 flex items-center shrink-0 transition-all ${
            isCollapsed ? "h-16 justify-center px-3" : "h-16 justify-between px-3"
          }`}>
            {isCollapsed ? (
              <button
                onClick={() => setShowExamModal(true)}
                className={`p-2 rounded-xl border ${activeExamColors.iconBg} ${activeExamColors.iconBorder} ${activeExamColors.iconText} hover:scale-105 shadow-3xs transition-all cursor-pointer`}
                title={`Active Track: ${activeExamConfig.shortName} (Click to switch)`}
              >
                <ActiveExamIcon className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex items-center justify-between w-full gap-1 min-w-0">
                <button
                  onClick={() => setShowExamModal(true)}
                  className="flex items-center gap-2.5 min-w-0 p-1.5 -ml-1 rounded-xl hover:bg-slate-200/60 transition-all text-left group cursor-pointer flex-1"
                  title="Click to switch exam track"
                >
                  <div className={`p-2 rounded-xl border ${activeExamColors.iconBg} ${activeExamColors.iconBorder} ${activeExamColors.iconText} shadow-3xs shrink-0 group-hover:scale-105 transition-transform`}>
                    <ActiveExamIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block leading-none">
                      Exam Scholar
                    </span>
                    <div className="flex items-center gap-1 mt-1 min-w-0">
                      <span className="font-display font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors truncate block leading-tight">
                        {activeExamConfig.shortName}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0 transition-transform group-hover:translate-y-0.5" />
                    </div>
                  </div>
                </button>

                {/* Single collapse toggle on desktop */}
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden md:flex p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-700 border border-transparent hover:border-slate-200 transition-all cursor-pointer shrink-0"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>

                {/* Close button on mobile */}
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden p-2 hover:bg-slate-200/60 rounded-lg text-slate-500 active:bg-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Clean Navigation Links */}
          <nav className={`p-3 flex-1 overflow-y-auto ${isCollapsed ? "space-y-2" : "space-y-1"}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
              const badge = item.badgeKey === "mistakes" ? activeMistakes.length : undefined;

              return (
                <button
                  key={item.id}
                  title={isCollapsed ? item.name : undefined}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                    setActiveSession(null);
                  }}
                  className={`w-full flex items-center transition-all cursor-pointer ${
                    isCollapsed
                      ? "justify-center p-2.5 rounded-xl relative"
                      : "justify-between px-3 py-2 rounded-xl"
                  } text-xs font-semibold ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/20 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium"
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5"} min-w-0`}>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </div>

                  {/* Badges */}
                  {badge !== undefined && badge > 0 && (
                    isCollapsed ? (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[8px] font-bold font-mono rounded-full flex items-center justify-center border-2 border-slate-50 shadow-xs">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : (
                      <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded shrink-0 ${
                        isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700 border border-rose-200/60"
                      }`}>
                        {badge}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Operations */}
        <div className={`border-t border-slate-200/80 bg-slate-100/50 shrink-0 transition-all ${
          isCollapsed ? "p-2 space-y-2 flex flex-col items-center text-center" : "p-3 space-y-2"
        }`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500">
                <div className="flex items-center gap-2 min-w-0" title="All curriculum data up to date">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="truncate font-medium text-slate-600">Curriculum Ready</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 font-semibold shrink-0">
                  {totalQuestionsCount} Qs
                </span>
              </div>

              <button
                onClick={handleClearProgress}
                className="group w-full text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 border border-transparent hover:border-rose-100 rounded-lg py-1.5 px-2.5 text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
                title="Clear all saved answers and test history"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 shrink-0" />
                <span className="truncate">Reset progress</span>
              </button>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 my-1 shrink-0" title="Curriculum ready and synced" />
              <button
                onClick={handleClearProgress}
                className="group p-2 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                title="Reset progress"
              >
                <Trash2 className="w-4 h-4 group-hover:text-rose-600" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* 3. Main Workspace Area */}
      <div
        ref={workspaceScrollRef}
        id="main-workspace-scroll"
        className="flex-1 flex flex-col min-w-0 overflow-y-auto scroll-smooth"
      >

        {/* Dynamic Topbar — desktop only */}
        <header className="bg-white border-b border-slate-200/80 px-6 h-16 hidden md:flex justify-between items-center gap-4 shrink-0 shadow-2xs sticky top-0 z-10">
          {/* Left: View Title & Context */}
          <div className="flex items-center gap-3 min-w-0">
            {isCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-1.5 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 shadow-3xs"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-indigo-50 border border-indigo-100/80 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-3xs">
                <HeaderIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-bold text-base text-slate-900 tracking-tight leading-tight truncate">
                    {headerInfo.title}
                  </h1>
                  {headerInfo.tag && (
                    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shrink-0">
                      {headerInfo.tag}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-[11px] font-medium leading-none mt-1 truncate">
                  {headerInfo.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Quick Progress Stats and Sync */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Progress Stats Chip */}
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs shadow-3xs">
              <div className="flex items-center gap-1.5" title="Total questions completed">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-mono font-bold text-slate-800">{totalAnswered}</span>
                <span className="text-slate-400 text-[11px]">solved</span>
              </div>
              <div className="h-3 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5" title="Overall accuracy">
                <span className="text-slate-400 text-[11px]">Accuracy:</span>
                <span className={`font-mono font-bold text-xs ${
                  overallAccuracy >= 70 ? "text-emerald-600" : overallAccuracy >= 40 ? "text-amber-600" : "text-slate-700"
                }`}>
                  {overallAccuracy}%
                </span>
              </div>
            </div>

            {/* Synchronize / Refresh button */}
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-3xs active:scale-95 disabled:opacity-50"
              title="Refresh curriculum content and progress"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
              <span className="hidden xl:inline">{refreshing ? "Syncing…" : "Sync"}</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Body router */}
        <main className="p-4 sm:p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="py-32 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-slate-800">Loading Exam Scholar</h3>
                <p className="text-xs text-slate-400">Fetching your subjects and progress…</p>
              </div>
            </div>
          ) : (
            <Routes>
              <Route
                path="/practice-session"
                element={
                  activeSession ? (
                    <PracticeSession
                      questions={activeSession.questions}
                      mode={activeSession.mode}
                      chapterId={activeSession.chapterId}
                      chapterName={activeSession.chapterName}
                      subject={activeSession.subject}
                      startIndex={activeSession.startIndex}
                      clearPreviousAnswers={activeSession.clearPreviousAnswers}
                      progress={progress}
                      onFinish={handleFinishSession}
                      onSubmitAnswer={handleSubmitAnswer}
                    />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />

              <Route
                path="/"
                element={
                  <Dashboard
                    subjects={subjects}
                    progress={progress}
                    selectedExam={selectedExam}
                    onOpenExamSelector={() => setShowExamModal(true)}
                    onSelectChapter={handleSelectChapter}
                    onNavigate={navigateToTab}
                  />
                }
              />

              <Route
                path="/subjects"
                element={
                  <SubjectsPage
                    subjects={subjects}
                    progress={progress}
                    selectedExam={selectedExam}
                    activeExamConfig={activeExamConfig}
                    activeExamColors={activeExamColors}
                    onOpenExamSelector={() => setShowExamModal(true)}
                    onQuickPractice={handleQuickPractice}
                    pickChapterForSubject={pickChapterForSubject}
                  />
                }
              />

              <Route
                path="/subjects/:subjectSlug"
                element={
                  <SubjectDetailPage
                    subjects={subjects}
                    progress={progress}
                    onQuickPractice={handleQuickPractice}
                  />
                }
              />

              <Route
                path="/subjects/:subjectSlug/:chapterId"
                element={
                  <ChapterDetailPage
                    subjects={subjects}
                    progress={progress}
                    onStartSession={handleStartSession}
                  />
                }
              />

              <Route
                path="/mock-tests"
                element={
                  <MockTestArena
                    subjects={subjects}
                    progress={progress}
                    selectedExam={selectedExam}
                    onSubmitAnswer={handleSubmitAnswer}
                    onRefreshContent={handleRefreshAll}
                    onNavigate={navigateToTab}
                    canExpandWithAi={capabilities.aiExpand}
                  />
                }
              />

              <Route
                path="/mistakes"
                element={
                  <MistakeBook
                    progress={progress}
                    selectedExam={selectedExam}
                    onClearMistakes={handleClearMistakes}
                    onStartSession={handleStartSession}
                  />
                }
              />

              <Route
                path="/revision"
                element={
                  <RevisionEngine
                    subjects={subjects}
                    progress={progress}
                    selectedExam={selectedExam}
                    onStartSession={handleStartSession}
                  />
                }
              />

              <Route
                path="/analytics"
                element={
                  <AnalyticsView
                    subjects={subjects}
                    progress={progress}
                    selectedExam={selectedExam}
                    onNavigate={navigateToTab}
                    onOpenExamSelector={() => setShowExamModal(true)}
                  />
                }
              />

              <Route path="/mobile-app" element={<MobileAppHub />} />

              <Route
                path="/content-manager"
                element={
                  <ContentPackManager
                    subjects={subjects}
                    onRefreshContent={handleRefreshAll}
                    canUpload={capabilities.contentUpload}
                  />
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>

      {/* Exam Selection Modal Popup */}
      <ExamSelectorModal
        isOpen={showExamModal}
        onClose={() => setShowExamModal(false)}
        selectedExamId={selectedExam}
        onSelectExam={handleSelectExamTrack}
      />

      {/* Reset Progress Confirmation Dialog Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-150 shadow-xl animate-scale-up text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl shrink-0 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-slate-900">Reset all progress?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This permanently deletes your answer history, accuracy stats, and mistake list. This can't be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearProgress}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast notification banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-800 px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-2.5 max-w-sm animate-slide-up text-xs font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
