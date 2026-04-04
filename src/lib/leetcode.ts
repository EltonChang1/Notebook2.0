import type { Difficulty } from "../models/domain";

export type ImportedProblem = {
  problemNumber: number;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  dateSolved?: string;
};

type GraphQlSubmission = {
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay: string;
  questionId: string;
};

type SubmissionListResponse = {
  submissions: GraphQlSubmission[];
  hasNext: boolean;
};

type QuestionDetails = {
  questionFrontendId: string;
  difficulty: Difficulty;
  topicTags: { name: string }[];
};

async function postGraphQl<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  if (!json.data) {
    throw new Error("GraphQL response had no data");
  }
  return json.data;
}

async function fetchQuestionDetails(titleSlug: string): Promise<QuestionDetails | null> {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        difficulty
        topicTags {
          name
        }
      }
    }
  `;
  const data = await postGraphQl<{ question: QuestionDetails | null }>(query, { titleSlug });
  return data.question;
}

export async function importFromLeetCodeGraphQl(username: string): Promise<ImportedProblem[]> {
  const paginated = await tryImportFromSubmissionList(username);
  if (paginated.length > 0) return paginated;

  return importFromRecentSubmissions(username);
}

async function importFromRecentSubmissions(username: string): Promise<ImportedProblem[]> {
  const query = `
    query userRecentSubmissions($username: String!) {
      matchedUser(username: $username) {
        username
      }
      recentSubmissionList(username: $username, limit: 50) {
        title
        titleSlug
        timestamp
        statusDisplay
        questionId
      }
    }
  `;

  const data = await postGraphQl<{
    matchedUser: { username: string } | null;
    recentSubmissionList: GraphQlSubmission[];
  }>(query, { username });

  if (!data.matchedUser) {
    throw new Error("LeetCode user not found");
  }

  const accepted = data.recentSubmissionList.filter(
    (item) => item.statusDisplay === "Accepted" && item.questionId
  );
  const uniqueBySlug = new Map<string, GraphQlSubmission>();
  for (const item of accepted) {
    if (!uniqueBySlug.has(item.titleSlug)) {
      uniqueBySlug.set(item.titleSlug, item);
    }
  }

  const entries = [...uniqueBySlug.values()].slice(0, 30);
  return hydrateImportedProblems(entries);
}

async function tryImportFromSubmissionList(username: string): Promise<ImportedProblem[]> {
  const query = `
    query userSubmissionList($username: String!, $offset: Int!, $limit: Int!) {
      matchedUser(username: $username) {
        username
        submitStatsGlobal {
          acSubmissionNum {
            count
          }
        }
      }
      submissionList(username: $username, offset: $offset, limit: $limit) {
        submissions {
          title
          titleSlug
          timestamp
          statusDisplay
          questionId
        }
        hasNext
      }
    }
  `;

  const uniqueBySlug = new Map<string, GraphQlSubmission>();
  let offset = 0;
  const limit = 20;
  for (let page = 0; page < 6; page += 1) {
    const data = await postGraphQl<{
      matchedUser: { username: string } | null;
      submissionList: SubmissionListResponse | null;
    }>(query, { username, offset, limit });
    if (!data.matchedUser || !data.submissionList) {
      break;
    }
    for (const submission of data.submissionList.submissions) {
      if (submission.statusDisplay !== "Accepted") continue;
      if (!uniqueBySlug.has(submission.titleSlug)) {
        uniqueBySlug.set(submission.titleSlug, submission);
      }
    }
    if (!data.submissionList.hasNext || uniqueBySlug.size >= 120) {
      break;
    }
    offset += limit;
  }

  const entries = [...uniqueBySlug.values()].slice(0, 120);
  if (entries.length === 0) return [];
  return hydrateImportedProblems(entries);
}

async function hydrateImportedProblems(
  entries: GraphQlSubmission[]
): Promise<ImportedProblem[]> {
  const detailPairs = await Promise.all(
    entries.map(async (entry) => {
      try {
        const details = await fetchQuestionDetails(entry.titleSlug);
        return { entry, details };
      } catch {
        return { entry, details: null };
      }
    })
  );

  return detailPairs.map(({ entry, details }) => ({
    problemNumber: Number(details?.questionFrontendId ?? entry.questionId),
    title: entry.title,
    difficulty: details?.difficulty ?? "Medium",
    topics: details?.topicTags?.map((topic) => topic.name) ?? [],
    dateSolved: entry.timestamp
      ? new Date(Number(entry.timestamp) * 1000).toISOString()
      : undefined,
  }));
}

export async function fetchLeetCodeScrapeSummary(
  username: string
): Promise<{ solvedCount: number | null }> {
  const response = await fetch(`https://r.jina.ai/http://leetcode.com/u/${username}/`);
  if (!response.ok) {
    throw new Error(`Scrape fallback failed: ${response.status}`);
  }
  const text = await response.text();
  const solvedMatch =
    text.match(/Total solved[^0-9]*(\d+)/i) ?? text.match(/Solved[^0-9]*(\d+)/i);
  return {
    solvedCount: solvedMatch ? Number(solvedMatch[1]) : null,
  };
}
