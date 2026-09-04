export interface RelevanceInput {
  title: string;
  snippet?: string;
  fields?: string[];
}

const aliases: Record<string, string[]> = {
  forestry: ["forestry", "forest science", "forest management", "silviculture", "tropical forestry"],
  wildlife: ["wildlife", "wildlife conservation", "wildlife management", "wildlife ecology", "zoology"],
  conservation: ["conservation", "biodiversity", "ecosystem management", "restoration ecology"],
  natural_resources: ["natural resource management", "land management", "environmental management"],
  climate: ["climate change", "forest carbon", "redd+", "climate adaptation", "climate mitigation"],
  geospatial: ["gis", "remote sensing", "forest monitoring", "geospatial science"]
};

export function scoreFieldRelevance(input: RelevanceInput, targetFields: string[]): number {
  const text = `${input.title} ${input.snippet ?? ""} ${(input.fields ?? []).join(" ")}`.toLowerCase();
  if (!targetFields.length) targetFields = ["forestry", "wildlife", "conservation"];
  let best = 0;
  for (const field of targetFields) {
    const terms = aliases[field.toLowerCase()] ?? [field.toLowerCase()];
    if (terms.some((term) => text.includes(term))) best = Math.max(best, weightFor(field));
  }
  return Math.min(1, best);
}

function weightFor(field: string): number {
  const key = field.toLowerCase();
  if (key.includes("forestry") || key.includes("forest management")) return 1;
  if (key.includes("wildlife")) return 0.95;
  if (key.includes("conservation")) return 0.9;
  if (key.includes("natural resource")) return 0.88;
  if (key.includes("climate")) return 0.7;
  if (key.includes("gis") || key.includes("remote")) return 0.65;
  return 0.6;
}
