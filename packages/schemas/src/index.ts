import { z } from "zod";

export const applicantProfileSchema = z.object({
  nationality: z.string().min(2),
  degreeLevel: z.enum(["masters", "phd", "undergraduate", "other"]),
  targetFields: z.array(z.string()).default([]),
  minimumFunding: z.enum(["substantial", "full"]).default("substantial"),
  academicScore: z.number().optional(),
  academicScale: z.number().positive().optional()
});

export type ApplicantProfileInput = z.infer<typeof applicantProfileSchema>;
