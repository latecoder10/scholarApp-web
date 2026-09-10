/**
 * Filesystem discovery of the curriculum.
 *
 * Unlike the modules in shared/, this one uses Node built-ins (fs, path) and
 * is therefore never imported by the browser client. It is shared between the
 * two things that *do* run on Node:
 *
 *   - server.ts                      — serves /api/content and /api/chapter
 *   - scripts/build-static-content.ts — bakes the same data into static JSON
 *                                       for hosts with no Node runtime
 *
 * Keeping one implementation is the point: a build script with its own copy of
 * this walk would drift from the server the first time either changed, and the
 * static site would quietly start disagreeing with the dev server.
 */
import fs from "fs";
import path from "path";
import { getExamById } from "../shared/exams";
import { compareSubjects, compareChapters } from "../shared/sorting";

export interface DiscoveredChapter {
  id: string;
  name: string;
  subject: string;
  exam: string;
  description: string;
  questionsCount: number;
  difficultyBreakdown: Record<string, number>;
  paper: string;
}

export interface DiscoveredSubject {
  name: string;
  exam: string;
  chapters: DiscoveredChapter[];
  totalQuestions: number;
  paper: string;
}

/**
 * Last-resort paper assignment for exams that declare papers but whose content
 * omits an explicit `paper` field.
 */
export function getPaperForSubject(subjectName: string): "Paper-I" | "Paper-II" {
  const normalized = subjectName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    normalized.includes("aptitude") ||
    normalized.includes("quantitative") ||
    normalized.includes("numerical") ||
    normalized.includes("reasoning") ||
    normalized.includes("english") ||
    normalized.includes("awareness") ||
    normalized.includes("knowledge") ||
    normalized.includes("gk") ||
    normalized.includes("verbal") ||
    normalized.includes("nontech") ||
    normalized.includes("paper1") ||
    normalized.includes("paperi")
  ) {
    return "Paper-I";
  }
  return "Paper-II";
}

/** Normalise the many spellings of Paper-I / Paper-II found in content packs. */
function cleanPaper(paper: unknown): unknown {
  if (typeof paper !== "string") return paper;
  const cleaned = paper.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleaned === "paperi" || cleaned === "paper1" || cleaned === "stagei" || cleaned === "stage1") {
    return "Paper-I";
  }
  if (cleaned === "paperii" || cleaned === "paper2" || cleaned === "stageii" || cleaned === "stage2") {
    return "Paper-II";
  }
  return paper;
}

/**
 * Walk content/<examId>/modules/<moduleSlug>/*.json.
 *
 * The top-level folder name IS the exam id (it matches ExamDefinition.id in
 * shared/exams.ts), so which exams exist is a direct filesystem fact rather
 * than something inferred from keywords. A brand new exam folder is discovered
 * immediately, even before anyone adds registry metadata for it.
 */
export function discoverSubjects(contentDir: string): DiscoveredSubject[] {
  const subjectsMap: Record<string, DiscoveredSubject> = {};

  if (!fs.existsSync(contentDir)) return [];

  const examFolders = fs.readdirSync(contentDir, { withFileTypes: true }).filter((f) => f.isDirectory());

  for (const examFolder of examFolders) {
    const examId = examFolder.name; // e.g. "claude-ccaf"
    const registeredExam = getExamById(examId);
    const examDisplayName =
      registeredExam?.matchExam || examId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const examPapers = registeredExam?.papers;

    const modulesDir = path.join(contentDir, examId, "modules");
    if (!fs.existsSync(modulesDir)) continue;

    const moduleFolders = fs.readdirSync(modulesDir, { withFileTypes: true }).filter((f) => f.isDirectory());

    moduleFolders.forEach((moduleFolder, moduleIndex) => {
      const moduleName = moduleFolder.name; // e.g. "computer-networks"
      const modulePath = path.join(modulesDir, moduleName);
      const files = fs.readdirSync(modulePath);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(modulePath, file);
        try {
          const chapterData = JSON.parse(fs.readFileSync(filePath, "utf8")) as any;

          const exam = chapterData.exam || examDisplayName;

          let jsonSubject = chapterData.subject || moduleName.replace(/-/g, " ");
          const examPrefix = `${examDisplayName} - `;
          if (jsonSubject.startsWith(examPrefix)) {
            jsonSubject = jsonSubject.slice(examPrefix.length);
          }
          const chapterName = chapterData.chapter || file.replace(".json", "").replace(/-/g, " ");

          let paper = chapterData.paper;
          if (!paper) {
            paper =
              examPapers && examPapers.length > 0
                ? getPaperForSubject(jsonSubject)
                : "Domain-" + (moduleIndex + 1);
          }
          paper = cleanPaper(paper);

          const mapKey = `${exam}:::${jsonSubject}`;
          if (!subjectsMap[mapKey]) {
            subjectsMap[mapKey] = {
              name: jsonSubject,
              exam,
              chapters: [],
              totalQuestions: 0,
              paper: paper as string,
            };
          }

          const questions = chapterData.questions || [];
          const difficultyCount: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
          questions.forEach((q: any) => {
            const diff = q.difficulty || "Medium";
            if (diff === "Easy" || diff === "Medium" || diff === "Hard") difficultyCount[diff]++;
            else difficultyCount["Medium"]++;
          });

          subjectsMap[mapKey].chapters.push({
            id: file.replace(".json", ""),
            name: chapterName,
            subject: jsonSubject,
            exam,
            description: chapterData.description || "",
            questionsCount: questions.length,
            difficultyBreakdown: difficultyCount,
            paper: paper as string,
          });

          subjectsMap[mapKey].totalQuestions += questions.length;
        } catch (err) {
          console.error(`Error parsing JSON file: ${filePath}`, err);
        }
      }
    });
  }

  // Ensure deterministic, natural ordering for all subjects and their nested chapters
  const allSubjects = Object.values(subjectsMap);
  for (const sub of allSubjects) {
    sub.chapters.sort(compareChapters);
  }
  allSubjects.sort(compareSubjects);

  return allSubjects;
}

/**
 * Locate a chapter file by id anywhere in the tree.
 *
 * Chapter ids are unique across the whole content tree, so the subject segment
 * of /api/chapter/:subjectSlug/:chapterId has always been decorative.
 */
export function findChapterFile(contentDir: string, chapterId: string): string | null {
  if (!fs.existsSync(contentDir)) return null;

  const examFolders = fs.readdirSync(contentDir, { withFileTypes: true }).filter((f) => f.isDirectory());
  for (const examFolder of examFolders) {
    const modulesDir = path.join(contentDir, examFolder.name, "modules");
    if (!fs.existsSync(modulesDir)) continue;

    const moduleFolders = fs.readdirSync(modulesDir, { withFileTypes: true }).filter((f) => f.isDirectory());
    for (const moduleFolder of moduleFolders) {
      const filePath = path.join(modulesDir, moduleFolder.name, `${chapterId}.json`);
      if (fs.existsSync(filePath)) return filePath;
    }
  }
  return null;
}

/** Every chapter file in the tree, keyed by its id. Used by the static build. */
export function collectChapterFiles(contentDir: string): Map<string, string> {
  const found = new Map<string, string>();
  if (!fs.existsSync(contentDir)) return found;

  const examFolders = fs.readdirSync(contentDir, { withFileTypes: true }).filter((f) => f.isDirectory());
  for (const examFolder of examFolders) {
    const modulesDir = path.join(contentDir, examFolder.name, "modules");
    if (!fs.existsSync(modulesDir)) continue;

    const moduleFolders = fs.readdirSync(modulesDir, { withFileTypes: true }).filter((f) => f.isDirectory());
    for (const moduleFolder of moduleFolders) {
      const modulePath = path.join(modulesDir, moduleFolder.name);
      for (const file of fs.readdirSync(modulePath)) {
        if (!file.endsWith(".json")) continue;
        found.set(file.replace(".json", ""), path.join(modulePath, file));
      }
    }
  }
  return found;
}
