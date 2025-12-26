export interface AnalysisQuote {
  participantId?: string | null;
  quote: string;
  context?: string | null;
}

export interface AnalysisQuestion {
  questionText: string;
  analysis: string | string[];
  quantitativeData?: Record<string, string> | null;
  quotes?: AnalysisQuote[] | null;
}

export interface AnalysisSection {
  sectionName: string;
  sectionIntro?: string | null;
  questions: AnalysisQuestion[];
}

export interface ExecutiveSummary {
  context?: string | null;
  keyFindings?: Array<{
    theme: string;
    analysis: string | string[];
  }>;
}

export interface InterviewAnalysisReport {
  title: string;
  executiveSummary?: ExecutiveSummary | null;
  sections: AnalysisSection[];
}

export function isInterviewAnalysisReport(value: unknown): value is InterviewAnalysisReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<InterviewAnalysisReport>;

  if (typeof report.title !== "string" || !Array.isArray(report.sections)) {
    return false;
  }

  const sectionsValid = report.sections.every(
    (section) =>
      !!section &&
      typeof section.sectionName === "string" &&
      Array.isArray(section.questions) &&
      section.questions.every(
        (question) =>
          !!question &&
          typeof question.questionText === "string" &&
          (typeof question.analysis === "string" ||
            (Array.isArray(question.analysis) &&
              question.analysis.every((entry) => typeof entry === "string")))
      )
  );

  if (!sectionsValid) {
    return false;
  }

  if (report.executiveSummary && typeof report.executiveSummary !== "object") {
    return false;
  }

  if (report.executiveSummary?.keyFindings) {
    const findingsValid = report.executiveSummary.keyFindings.every(
      (finding) =>
        !!finding &&
        typeof finding.theme === "string" &&
        (typeof finding.analysis === "string" ||
          (Array.isArray(finding.analysis) &&
            finding.analysis.every((entry) => typeof entry === "string")))
    );
    if (!findingsValid) {
      return false;
    }
  }

  return true;
}
