export interface InterviewScriptQuestion {
  questionNumber: number;
  questionText: string;
  questionType: string | null;
  options: string[] | null;
  scale: string | null;
  followUp: string | null;
}

export interface InterviewScriptSection {
  sectionName: string;
  questions: InterviewScriptQuestion[];
}

export interface InterviewScript {
  title: string;
  researchObjective: string;
  targetAudience: string;
  estimatedDuration: string;
  sections: InterviewScriptSection[];
  interviewerNotes: string[];
  analysisConsiderations: string[];
}

export function isInterviewScript(value: unknown): value is InterviewScript {
  if (!value || typeof value !== "object") {
    return false;
  }
  const script = value as Partial<InterviewScript>;
  return (
    typeof script.title === "string" &&
    Array.isArray(script.sections) &&
    script.sections.every(
      (section) =>
        section &&
        typeof section.sectionName === "string" &&
        Array.isArray(section.questions) &&
        section.questions.every((question) => question && typeof question.questionText === "string")
    )
  );
}

export function extractQuestionsFromScript(script: InterviewScript | null): string[] {
  if (!script) {
    return [];
  }
  const questions: string[] = [];
  script.sections.forEach((section) => {
    section.questions.forEach((question) => {
      if (question.questionText && question.questionText.trim()) {
        questions.push(question.questionText.trim());
      }
    });
  });
  return questions;
}
