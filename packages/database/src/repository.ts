import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { createDatabase } from "./client";
import { discoveryRecords, scholarshipFunding, scholarshipSnapshots, scholarshipSources, scholarships } from "./schema";

export interface ScholarshipEligibilityEvidence {
  internationalStudents?: boolean;
  eligibleNationalities?: string[];
  excludedNationalities?: string[];
  minimumAcademicScore?: number;
  academicScale?: number;
  text?: string;
}

export interface ScholarshipPersistenceInput {
  canonicalKey: string;
  title: string;
  provider?: string;
  university?: string;
  country?: string;
  degreeLevel?: string;
  opportunityType?: string;
  fields: string[];
  sourceUrl: string;
  applicationUrl?: string;
  fundingClass: string;
  deadline?: string;
  eligibility?: ScholarshipEligibilityEvidence;
  evidence?: {
    title: string;
    snippet?: string;
    sourceUrl: string;
    funding?: {
      tuitionCovered?: boolean;
      stipendMentioned?: boolean;
      accommodationCovered?: boolean;
      travelCovered?: boolean;
      insuranceCovered?: boolean;
      text: string;
    };
    eligibility?: ScholarshipEligibilityEvidence;
  };
}

export interface SourceVerificationInput {
  sourceUrl: string;
  finalUrl?: string;
  status: string;
  trustLevel: number;
  officialSource: boolean;
  title?: string;
  evidence: string[];
  warnings: string[];
  checkedAt: string;
}

export function createScholarshipRepository(databaseUrl?: string) {
  const db = createDatabase(databaseUrl);

  return {
    async upsertScholarship(input: ScholarshipPersistenceInput) {
      const [scholarship] = await db.insert(scholarships).values({
        canonicalKey: input.canonicalKey,
        title: input.title,
        provider: input.provider,
        university: input.university,
        country: input.country,
        degreeLevel: input.degreeLevel,
        opportunityType: input.opportunityType ?? "scholarship",
        fields: input.fields,
        sourceUrl: input.sourceUrl,
        applicationUrl: input.applicationUrl,
        fundingClass: input.fundingClass,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: scholarships.canonicalKey,
        set: {
          title: input.title, provider: input.provider, university: input.university, country: input.country,
          degreeLevel: input.degreeLevel, opportunityType: input.opportunityType ?? "scholarship", fields: input.fields, sourceUrl: input.sourceUrl,
          applicationUrl: input.applicationUrl, fundingClass: input.fundingClass,
          deadline: input.deadline ? new Date(input.deadline) : undefined, updatedAt: new Date()
        }
      }).returning({ id: scholarships.id });

      if (!scholarship) throw new Error("Scholarship upsert returned no row");
      const now = new Date();
      await db.insert(scholarshipSources).values({ scholarshipId: scholarship.id, url: input.sourceUrl, sourceType: input.opportunityType ?? "discovery", isOfficial: false, lastVerified: now }).onConflictDoNothing();

      const funding = input.evidence?.funding;
      if (funding) {
        await db.insert(scholarshipFunding).values({
          scholarshipId: scholarship.id, tuitionCovered: funding.tuitionCovered,
          accommodationCovered: funding.accommodationCovered, travelCovered: funding.travelCovered,
          insuranceCovered: funding.insuranceCovered, notes: funding.text.slice(0, 4000)
        }).onConflictDoUpdate({
          target: scholarshipFunding.scholarshipId,
          set: { tuitionCovered: funding.tuitionCovered, accommodationCovered: funding.accommodationCovered, travelCovered: funding.travelCovered, insuranceCovered: funding.insuranceCovered, notes: funding.text.slice(0, 4000) }
        });
      }

      if (input.evidence) {
        await db.insert(scholarshipSnapshots).values({
          scholarshipId: scholarship.id, sourceUrl: input.evidence.sourceUrl, title: input.evidence.title,
          snippet: input.evidence.snippet?.slice(0, 8000),
          evidence: {
            ...(input.evidence.funding ? { funding: input.evidence.funding } : {}),
            ...(input.evidence.eligibility ? { eligibility: input.evidence.eligibility } : input.eligibility ? { eligibility: input.eligibility } : {})
          }
        });
      }
      return scholarship.id;
    },

    async recordDiscovery(input: { url: string; title?: string; source: string; discoveryMethod: string; query?: string }) {
      await db.insert(discoveryRecords).values({ url: input.url, title: input.title, source: input.source, discoveryMethod: input.discoveryMethod, query: input.query, status: "processed" });
    },

    async recordVerification(scholarshipId: string, verification: SourceVerificationInput) {
      const now = new Date(verification.checkedAt);
      await db.update(scholarships).set({ trustLevel: Math.max(1, Math.min(5, verification.trustLevel)), updatedAt: now }).where(eq(scholarships.id, scholarshipId));
      await db.update(scholarshipSources).set({ isOfficial: verification.officialSource, lastVerified: now }).where(and(eq(scholarshipSources.scholarshipId, scholarshipId), eq(scholarshipSources.url, verification.sourceUrl)));
      await db.insert(scholarshipSnapshots).values({
        scholarshipId,
        sourceUrl: verification.finalUrl ?? verification.sourceUrl,
        title: verification.title ?? "Source verification",
        snippet: verification.warnings.join(" ").slice(0, 8000) || undefined,
        evidence: { verification: { status: verification.status, trustLevel: verification.trustLevel, officialSource: verification.officialSource, sourceUrl: verification.sourceUrl, finalUrl: verification.finalUrl, evidence: verification.evidence, warnings: verification.warnings, checkedAt: verification.checkedAt } }
      });
      return this.getScholarship(scholarshipId);
    },

    async getScholarship(id: string) {
      const rows = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
      if (!rows[0]) return undefined;
      const sources = await db.select().from(scholarshipSources).where(eq(scholarshipSources.scholarshipId, id));
      const funding = await db.select().from(scholarshipFunding).where(eq(scholarshipFunding.scholarshipId, id)).limit(1);
      const snapshots = await db.select().from(scholarshipSnapshots).where(eq(scholarshipSnapshots.scholarshipId, id)).orderBy(desc(scholarshipSnapshots.capturedAt)).limit(10);
      return { ...rows[0], sources, funding: funding[0], snapshots };
    },

    async getLatestEligibilityEvidence(ids: string[]) {
      if (!ids.length) return new Map<string, ScholarshipEligibilityEvidence>();
      const rows = await db.select({ scholarshipId: scholarshipSnapshots.scholarshipId, evidence: scholarshipSnapshots.evidence, capturedAt: scholarshipSnapshots.capturedAt }).from(scholarshipSnapshots).where(inArray(scholarshipSnapshots.scholarshipId, ids)).orderBy(desc(scholarshipSnapshots.capturedAt));
      const result = new Map<string, ScholarshipEligibilityEvidence>();
      for (const row of rows) {
        if (result.has(row.scholarshipId)) continue;
        const evidence = row.evidence as { eligibility?: ScholarshipEligibilityEvidence } | null;
        if (evidence?.eligibility) result.set(row.scholarshipId, evidence.eligibility);
      }
      return result;
    },

    async listScholarships(filters: { fundingClass?: string; degreeLevel?: string; country?: string; opportunityType?: string; minTrustLevel?: number; limit?: number } = {}) {
      const conditions = [];
      if (filters.fundingClass) conditions.push(eq(scholarships.fundingClass, filters.fundingClass));
      if (filters.degreeLevel) conditions.push(eq(scholarships.degreeLevel, filters.degreeLevel));
      if (filters.country) conditions.push(eq(scholarships.country, filters.country));
      if (filters.opportunityType) conditions.push(eq(scholarships.opportunityType, filters.opportunityType));
      if (filters.minTrustLevel !== undefined) conditions.push(gte(scholarships.trustLevel, filters.minTrustLevel));
      return db.select().from(scholarships).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(scholarships.updatedAt)).limit(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    }
  };
}
