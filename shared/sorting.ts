/**
 * Curriculum and Domain Sorting Utilities
 *
 * Provides deterministic, natural numeric sorting for exam tracks,
 * domains (Domain-1, Domain-2...), papers (Paper-I, Paper-II...),
 * and chapter sequences (1.1, 1.2, 1.10... or chapter-01, chapter-02...).
 */

/**
 * Extract a numeric ranking from domain / paper names:
 * "Domain-1" -> 1
 * "Domain 2" -> 2
 * "Domain-3" -> 3
 * "Paper-I" -> 1
 * "Paper-II" -> 2
 * "Stage-1" -> 1
 */
export function extractPaperOrDomainRank(paperOrName: string | undefined | null): number {
  if (!paperOrName) return 9999;
  const str = paperOrName.trim().toLowerCase();

  // Explicit Domain / Paper with digit (e.g. "Domain-1", "Domain 2", "Paper 1")
  const digitMatch = str.match(/(?:domain|paper|stage|tier|part|module)[ -]*(\d+)/i);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  // Explicit Domain / Paper with Roman numerals (e.g. "Paper-I", "Paper-II", "Domain-V")
  const romanMatch = str.match(/(?:domain|paper|stage|tier|part|module)[ -]*(x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/i);
  if (romanMatch) {
    const roman = romanMatch[1].toLowerCase();
    const map: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
      ix: 9,
      x: 10,
    };
    if (map[roman]) return map[roman];
  }

  // Leading digit in name (e.g. "1. Agentic Architecture" or "1 - Agentic Architecture")
  const leadingDigit = str.match(/^(\d+)/);
  if (leadingDigit) {
    return parseInt(leadingDigit[1], 10);
  }

  // Common paper names for two-paper exams
  if (str.includes("paper-i") || str.includes("paper 1") || str.includes("paper1") || str.includes("non-tech")) return 1;
  if (str.includes("paper-ii") || str.includes("paper 2") || str.includes("paper2") || str.includes("technical")) return 2;

  return 9999;
}

export interface SubjectSortable {
  name: string;
  paper?: string;
}

/**
 * Compares two subjects/domains for natural sequential display:
 * Domain-1 < Domain-2 < Domain-3 < Domain-4 < Domain-5 ...
 * Paper-I < Paper-II ...
 */
export function compareSubjects(a: SubjectSortable, b: SubjectSortable): number {
  const rankA = extractPaperOrDomainRank(a.paper);
  const rankB = extractPaperOrDomainRank(b.paper);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // If paper rank is identical (or both unranked), check subject name for domain numbers
  const nameRankA = extractPaperOrDomainRank(a.name);
  const nameRankB = extractPaperOrDomainRank(b.name);
  if (nameRankA !== nameRankB) {
    return nameRankA - nameRankB;
  }

  // Fallback to natural alphabetical sort
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export interface ChapterSortable {
  id: string;
  name: string;
}

/**
 * Compares two chapters for natural sequential ordering:
 * "1.1 Agentic..." < "1.2 Coordinator..." < "1.10 Sessions..."
 * "chapter-01" < "chapter-02" < "chapter-10"
 */
export function compareChapters(a: ChapterSortable, b: ChapterSortable): number {
  // Check for chapter dotted numbering: e.g. "1.1 ...", "1.10 ...", "Chapter 1", etc.
  const numA = a.name.match(/^(\d+(?:\.\d+)?)/);
  const numB = b.name.match(/^(\d+(?:\.\d+)?)/);

  if (numA && numB) {
    const partsA = numA[1].split(".").map(Number);
    const partsB = numB[1].split(".").map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const valA = partsA[i] ?? 0;
      const valB = partsB[i] ?? 0;
      if (valA !== valB) return valA - valB;
    }
  }

  // Fallback to id with numeric comparison, e.g. chapter-01 vs chapter-10
  return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
}
