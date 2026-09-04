import { and, desc, eq, gte } from "drizzle-orm";
import { createDatabase } from "./client";
import { discoveryRecords, scholarshipFunding, scholarshipSnapshots, scholarshipSources, scholarships } from "./schema";

export interface ScholarshipPersistenceInput {
  canonicalKey: string;
  title: string;
  provider?: string;
  university?: string;
  country?: string;
  degreeLevel?: string;
  fields: string[];
  sourceUrl: string;
  applicationUrl?: string;
  fundingClass: string;
  deadline?: string;
  eligibility?: {
    internationalStudents?: boolean;
    eligibleNationalities?: string[];
    excludedNationalities?: string[];
    minimumAcademicScore?: number;
    academicScale?: number;
    text?: string;
  };
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
    eligibility?: ScholarshipPersistenceInput["eligibility"];
  };
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
        fields: input.fields,
        sourceUrl: input.sourceUrl,
        applicationUrl: input.applicationUrl,
        fundingClass: input.fundingClass,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: scholarships.canonicalKey,
        set: {
          title: input.title,
          provider: input.provider,
          university: input.university,
          country: input.country,
          degreeLevel: input.degreeLevel,
          fields: input.fields,
          sourceUrl: input.sourceUrl,
          applicationUrl: input.applicationUrl,
          fundingClass: input.fundingClass,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          updatedAt: new Date()
        }
      }).returning({ id: scholarships.id });

      if (!scholarship) throw new Error("Scholarship upsert returned no row");
      const now = new Date();
      await db.insert(scholarshipSources).values({
        scholarshipId: scholarship.id,
        url: input.sourceUrl,
        sourceType: "discovery",
        isOfficial: false,
        lastVerified: now
      }).onConflictDoNothing();

      const funding = input.evidence?.funding;
      if (funding) {
        await db.insert(scholarshipFunding).values({
          scholarshipId: scholarship.id,
          tuitionCovered: funding.tuitionCovered,
          accommodationCovered: funding.accommodationCovered,
          travelCovered: funding.travelCovered,
          insuranceCovered: funding.insuranceCovered,
          notes: funding.text.slice(0, 4000)
        }).onConflictDoUpdate({
          target: scholarshipFunding.scholarshipId,
          set: {
            tuitionCovered: funding.tuitionCovered,
            accommodationCovered: funding.accommodationCovered,
            travelCovered: funding.travelCovered,
            insuranceCovered: funding.insuranceCovered,
            notes: funding.text.slice(0, 4000)
          }
        });
      }

      if (input.evidence) {
        await db.insert(scholarshipSnapshots).values({
          scholarshipId: scholarship.id,
          sourceUrl: input.evidence.sourceUrl,
          title: input.evidence.title,
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
      await db.insert(discoveryRecords).values({
        url: input.url, title: input.title, source: input.source,
        discoveryMethod: input.discoveryMethod, query: input.query, status: "processed"
      });
    },

    async getScholarship(id: string) {
      const rows = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
      if (!rows[0]) return undefined;
      const sources = await db.select().from(scholarshipSources).where(eq(scholarshipSources.scholarshipId, id));
      const funding = await db.select().from(scholarshipFunding).where(eq(scholarshipFunding.scholarshipId, id)).limit(1);
      const snapshots = await db.select().from(scholarshipSnapshots).where(eq(scholarshipSnapshots.scholarshipId, id)).orderBy(desc(scholarshipSnapshots.capturedAt)).limit(10);
      return { ...rows[0], sources, funding: funding[0], snapshots };
    },

    async listScholarships(filters: { fundingClass?: string; degreeLevel?: string; country?: string; minTrustLevel?: number; limit?: number } = {}) {
      const conditions = [];
      if (filters.fundingClass) conditions.push(eq(scholarships.fundingClass, filters.fundingClass));
      if (filters.degreeLevel) conditions.push(eq(scholarships.degreeLevel, filters.degreeLevel));
      if (filters.country) conditions.push(eq(scholarships.country, filters.country));
      if (filters.minTrustLevel !== undefined) conditions.push(gte(scholarships.trustLevel, filters.minTrustLevel));
      return db.select().from(scholarships)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(scholarships.updatedAt))
        .limit(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    }
  };
}
