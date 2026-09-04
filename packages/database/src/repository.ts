import { and, desc, eq } from "drizzle-orm";
import { createDatabase } from "./client";
import { discoveryRecords, scholarshipFunding, scholarshipSources, scholarships } from "./schema";

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
  evidence?: { title: string; snippet?: string; sourceUrl: string };
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

      await db.insert(scholarshipSources).values({
        scholarshipId: scholarship.id,
        url: input.sourceUrl,
        sourceType: "discovery",
        isOfficial: false,
        lastVerified: new Date()
      }).onConflictDoNothing();

      return scholarship.id;
    },

    async recordDiscovery(input: { url: string; title?: string; source: string; discoveryMethod: string; query?: string }) {
      await db.insert(discoveryRecords).values({
        url: input.url,
        title: input.title,
        source: input.source,
        discoveryMethod: input.discoveryMethod,
        query: input.query,
        status: "processed"
      });
    },

    async listScholarships(filters: { fundingClass?: string; degreeLevel?: string; country?: string; minTrustLevel?: number; limit?: number } = {}) {
      const conditions = [];
      if (filters.fundingClass) conditions.push(eq(scholarships.fundingClass, filters.fundingClass));
      if (filters.degreeLevel) conditions.push(eq(scholarships.degreeLevel, filters.degreeLevel));
      if (filters.country) conditions.push(eq(scholarships.country, filters.country));
      if (filters.minTrustLevel !== undefined) conditions.push(eq(scholarships.trustLevel, filters.minTrustLevel));

      return db.select().from(scholarships)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(scholarships.updatedAt))
        .limit(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    }
  };
}
