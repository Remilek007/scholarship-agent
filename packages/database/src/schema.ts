import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const scholarships = pgTable("scholarships", {
  id: uuid("id").defaultRandom().primaryKey(),
  canonicalKey: text("canonical_key").notNull().unique(),
  title: text("title").notNull(),
  provider: text("provider"),
  university: text("university"),
  country: text("country"),
  degreeLevel: text("degree_level"),
  opportunityType: text("opportunity_type").notNull().default("scholarship"),
  fields: jsonb("fields").$type<string[]>().notNull().default([]),
  sourceUrl: text("source_url").notNull(),
  applicationUrl: text("application_url"),
  fundingClass: text("funding_class").notNull().default("unknown"),
  trustLevel: integer("trust_level").notNull().default(1),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const scholarshipSources = pgTable("scholarship_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  scholarshipId: uuid("scholarship_id").notNull(),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(),
  isOfficial: boolean("is_official").notNull().default(false),
  lastVerified: timestamp("last_verified", { withTimezone: true })
}, (table) => ({
  scholarshipUrlUnique: uniqueIndex("scholarship_sources_scholarship_url_idx").on(table.scholarshipId, table.url),
  urlIndex: index("scholarship_sources_url_idx").on(table.url)
}));

export const discoveryRecords = pgTable("discovery_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  source: text("source").notNull(),
  discoveryMethod: text("discovery_method").notNull(),
  query: text("query"),
  status: text("status").notNull().default("unprocessed"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull()
});

export const scholarshipFunding = pgTable("scholarship_funding", {
  scholarshipId: uuid("scholarship_id").primaryKey(),
  tuitionCovered: boolean("tuition_covered"),
  stipendAmount: text("stipend_amount"),
  accommodationCovered: boolean("accommodation_covered"),
  travelCovered: boolean("travel_covered"),
  insuranceCovered: boolean("insurance_covered"),
  notes: text("notes")
});

export const scholarshipSnapshots = pgTable("scholarship_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  scholarshipId: uuid("scholarship_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  snippet: text("snippet"),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull()
});

export const matchScores = pgTable("match_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  scholarshipId: uuid("scholarship_id").notNull(),
  eligibilityStatus: text("eligibility_status").notNull(),
  fieldScore: real("field_score").notNull().default(0),
  fundingScore: real("funding_score").notNull().default(0),
  academicScore: real("academic_score").notNull().default(0),
  profileScore: real("profile_score").notNull().default(0),
  overallScore: real("overall_score").notNull().default(0),
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
