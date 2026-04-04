import type { Difficulty, LeetCodeProblem } from "../models/domain";

export type ParsedCsvProblem = {
  problemNumber: number;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  dateSolved?: string;
};

export type CsvInvalidRow = {
  line: number;
  reason: string;
  raw: string;
};

export type CsvPreview = {
  validRows: ParsedCsvProblem[];
  invalidRows: CsvInvalidRow[];
  createdCount: number;
  mergedCount: number;
};

function parseDifficulty(value: string): Difficulty | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "easy") return "Easy";
  if (normalized === "medium") return "Medium";
  if (normalized === "hard") return "Hard";
  return null;
}

export function buildCsvTemplate(): string {
  return [
    "problemNumber,title,difficulty,topics,dateSolved",
    "1,Two Sum,Easy,Array|Hash Table,2026-04-01",
    "11,Container With Most Water,Medium,Array|Two Pointers,2026-04-02",
  ].join("\n");
}

export function previewCsvImport(
  csvText: string,
  existingProblems: LeetCodeProblem[]
): CsvPreview {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      validRows: [],
      invalidRows: [],
      createdCount: 0,
      mergedCount: 0,
    };
  }

  const hasHeader = rows[0].toLowerCase().includes("problem");
  const startIndex = hasHeader ? 1 : 0;
  const validRows: ParsedCsvProblem[] = [];
  const invalidRows: CsvInvalidRow[] = [];
  const existingNumbers = new Set(existingProblems.map((item) => item.problemNumber));
  let createdCount = 0;
  let mergedCount = 0;

  for (let i = startIndex; i < rows.length; i += 1) {
    const raw = rows[i];
    const line = i + 1;
    const cells = raw.split(",").map((cell) => cell.trim());
    if (cells.length < 3) {
      invalidRows.push({ line, reason: "Expected at least 3 columns", raw });
      continue;
    }

    const problemNumber = Number(cells[0]);
    if (!Number.isFinite(problemNumber) || problemNumber <= 0) {
      invalidRows.push({ line, reason: "Invalid problem number", raw });
      continue;
    }

    const title = cells[1];
    if (!title) {
      invalidRows.push({ line, reason: "Missing title", raw });
      continue;
    }

    const difficulty = parseDifficulty(cells[2]);
    if (!difficulty) {
      invalidRows.push({
        line,
        reason: "Difficulty must be Easy, Medium, or Hard",
        raw,
      });
      continue;
    }

    const topics = cells[3]
      ? cells[3].split("|").map((topic) => topic.trim()).filter(Boolean)
      : [];
    const dateSolvedRaw = cells[4];
    let dateSolved: string | undefined;
    if (dateSolvedRaw) {
      const parsed = new Date(dateSolvedRaw);
      if (Number.isNaN(parsed.getTime())) {
        invalidRows.push({
          line,
          reason: "Invalid dateSolved. Use YYYY-MM-DD",
          raw,
        });
        continue;
      }
      dateSolved = parsed.toISOString();
    }

    validRows.push({
      problemNumber,
      title,
      difficulty,
      topics,
      dateSolved,
    });

    if (existingNumbers.has(problemNumber)) {
      mergedCount += 1;
    } else {
      createdCount += 1;
      existingNumbers.add(problemNumber);
    }
  }

  return { validRows, invalidRows, createdCount, mergedCount };
}
