# Scholarship Analyst

A Forestry-first scholarship discovery and intelligence workspace for finding funded Master's opportunities worldwide and understanding whether they fit an applicant profile.

## Product mode

This project is intentionally **analysis-only**. It does not prepare applications, generate factual application answers, fill forms, upload documents, submit applications, or act as the applicant.

The workflow is:

```text
Applicant profile / CV
        ↓
Broad scholarship + studentship + research-position discovery
        ↓
Deduplication + funding classification
        ↓
Eligibility analysis
        ↓
Field / academic / profile matching
        ↓
Requirement extraction
        ↓
Funding + deadline + source verification
        ↓
Ranked scholarship intelligence
        ↓
Applicant opens the official source and applies manually
```

## What the system analyzes

For each opportunity, the dashboard is designed to surface:

- Degree level and opportunity type
- Field/discipline relevance
- Nationality and international-applicant eligibility
- Academic minimums and academic-scale requirements when captured
- Funding classification
- Tuition coverage
- Stipend information
- Accommodation, travel and insurance coverage
- Application deadline
- Required and optional application documents
- Special instructions and conditions
- Supervisor/research requirements when captured
- Language requirements when captured by the source
- Official source and application links
- Source trust level and verification evidence
- A match score against the applicant profile
- Items that still need manual confirmation from the official source

## Applicant document intelligence

The CV/document analyzer remains useful for discovery and matching. It extracts supported facts such as degree, CGPA, academic field, technical skills and research/work evidence so the search can become more precise. Extracted facts are presented for review before being used in the search profile.

It does **not** create application answers or submit anything.

## Manual application boundary

When a scholarship is selected, the system provides an analysis panel and links to the official source. The applicant is responsible for reading the current rules, preparing their own documents and answers, completing the form, and submitting the application.

The old application workspace/database structures may remain temporarily for backward compatibility, but they are no longer part of the product workflow.
