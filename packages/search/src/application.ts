import type { ApplicantProfile } from "@scholarship-agent/shared";

export interface ApplicationAnswerDraft {
  field: string;
  answer: string;
  aiPolicy: "limited";
  reviewed: false;
  source: "profile";
}

export interface ApplicationQuestion {
  field: string;
  prompt: string;
  category: "personal" | "academic" | "research" | "career" | "experience" | "documents";
  status: "needs_input";
}

export interface ApplicationPreparation {
  factualAnswers: ApplicationAnswerDraft[];
  questions: ApplicationQuestion[];
  warnings: string[];
}

export function prepareApplicationIntelligence(profile: ApplicantProfile): ApplicationPreparation {
  const factualAnswers: ApplicationAnswerDraft[] = [];
  const add = (field: string, answer: string | undefined) => {
    if (!answer?.trim()) return;
    factualAnswers.push({ field, answer: answer.trim(), aiPolicy: "limited", reviewed: false, source: "profile" });
  };

  add("nationality", profile.nationality);
  add("intended_degree_level", labelDegree(profile.degreeLevel));
  add("highest_qualification", profile.highestQualification);
  add("degree_field", profile.degreeField);
  if (profile.academicScore !== undefined) add("cgpa_or_academic_score", String(profile.academicScore));
  if (profile.academicScale !== undefined) add("academic_scale", String(profile.academicScale));
  add("target_fields", profile.targetFields.join(", "));
  add("minimum_funding_requirement", profile.minimumFunding === "full" ? "Fully funded" : "Substantial funding");
  add("work_experience", profile.workExperience);

  const questions: ApplicationQuestion[] = [
    { field: "personal_statement", prompt: "What motivates you to pursue this Master's degree, and why this specific program?", category: "personal", status: "needs_input" },
    { field: "research_interests", prompt: "What forestry, wildlife, conservation, natural-resource, climate, or geospatial research questions interest you?", category: "research", status: "needs_input" },
    { field: "research_proposal", prompt: "Describe the research problem, objectives, methods, expected contribution, and study area you would propose.", category: "research", status: "needs_input" },
    { field: "career_goals", prompt: "What are your short- and long-term career goals after the Master's degree?", category: "career", status: "needs_input" },
    { field: "program_motivation", prompt: "Why is this university, department, supervisor, or research group a good fit for you?", category: "personal", status: "needs_input" },
    { field: "leadership_and_impact", prompt: "Describe leadership, community, conservation, volunteering, or other impact experiences that are relevant to this application.", category: "experience", status: "needs_input" },
    { field: "achievements", prompt: "List your most relevant academic, professional, research, publications, awards, or project achievements.", category: "academic", status: "needs_input" },
    { field: "english_proficiency", prompt: "What English-language evidence do you have, if any, and what are the test details or exemption basis?", category: "documents", status: "needs_input" },
    { field: "referees", prompt: "Who are your proposed referees, what are their roles, and how do they know your work?", category: "documents", status: "needs_input" }
  ];

  return {
    factualAnswers,
    questions,
    warnings: [
      "Only facts already present in the applicant profile are prepared automatically.",
      "Personal statements, research proposals, career claims, achievements, and referee details require user-provided facts before drafting.",
      "Final application answers should be reviewed against the opportunity's instructions and AI-use policy before submission."
    ]
  };
}

function labelDegree(value: ApplicantProfile["degreeLevel"]): string {
  return value === "masters" ? "Master's" : value === "phd" ? "PhD" : value === "undergraduate" ? "Undergraduate" : "Other";
}
