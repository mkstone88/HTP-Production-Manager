import "server-only";

import { airtable, type AirtableRecord } from "./client";
import { opportunityFields, salesSurveyFields, tables } from "./mapping";
import { OpportunityContactsRepo } from "./opportunity-contacts";
import type { SalesSurvey, SurveyCandidate, SurveyPatch } from "./types";

const f = salesSurveyFields;
const of = opportunityFields;
type Fields = Record<string, unknown>;

function opt(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] == null ? undefined : String(v[0]);
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}
function optArr(v: unknown): string[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  return v.map((x) =>
    typeof x === "object" && x !== null && "name" in x
      ? String((x as { name: unknown }).name)
      : String(x),
  );
}
function firstLinkId(v: unknown): string | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const first = v[0];
  return typeof first === "string" ? first : (first as { id?: string })?.id;
}

function fromRecord(rec: AirtableRecord<Fields>): SalesSurvey {
  const r = rec.fields;
  return {
    id: rec.id,
    name: String(r[f.name] ?? "") || "(unnamed)",
    opportunityId: firstLinkId(r[f.opportunity]),
    projectType: opt(r[f.projectType]),
    surveyedBy: opt(r[f.surveyedBy]),
    surveyedAt: opt(r[f.surveyedAt]),
    discRead: opt(r[f.discRead]),
    projectDescription: opt(r[f.projectDescription]),
    surfaces: optArr(r[f.surfaces]),
    surfacesOther: opt(r[f.surfacesOther]),
    damageIssues: optArr(r[f.damageIssues]),
    damageNotes: opt(r[f.damageNotes]),
    colorsDecided: opt(r[f.colorsDecided]),
    colorConsultation: opt(r[f.colorConsultation]),
    timeline: opt(r[f.timeline]),
    urgencyDrivers: optArr(r[f.urgencyDrivers]),
    urgencyNotes: opt(r[f.urgencyNotes]),
    mainGoals: optArr(r[f.mainGoals]),
    stakesIfNotDone: opt(r[f.stakesIfNotDone]),
    otherBids: opt(r[f.otherBids]),
    whyNotOthers: opt(r[f.whyNotOthers]),
    hiredBefore: opt(r[f.hiredBefore]),
    pastExperienceNotes: opt(r[f.pastExperienceNotes]),
    concerns: optArr(r[f.concerns]),
    whatMatters: optArr(r[f.whatMatters]),
    wantsToLearn: opt(r[f.wantsToLearn]),
    interiorSensitivities: optArr(r[f.interiorSensitivities]),
    pets: optArr(r[f.pets]),
    petNotes: opt(r[f.petNotes]),
    carefulItems: optArr(r[f.carefulItems]),
    carefulItemsNotes: opt(r[f.carefulItemsNotes]),
    walkthroughNotes: opt(r[f.walkthroughNotes]),
    outcome: opt(r[f.outcome]),
    nextFollowUpAt: opt(r[f.nextFollowUpAt]),
  };
}

/** SurveyPatch key -> Airtable column. Kept explicit so a typo can't write a stray field. */
const PATCH_FIELD: Record<keyof SurveyPatch, string> = {
  projectType: f.projectType,
  discRead: f.discRead,
  projectDescription: f.projectDescription,
  surfaces: f.surfaces,
  surfacesOther: f.surfacesOther,
  damageIssues: f.damageIssues,
  damageNotes: f.damageNotes,
  colorsDecided: f.colorsDecided,
  colorConsultation: f.colorConsultation,
  timeline: f.timeline,
  urgencyDrivers: f.urgencyDrivers,
  urgencyNotes: f.urgencyNotes,
  mainGoals: f.mainGoals,
  stakesIfNotDone: f.stakesIfNotDone,
  otherBids: f.otherBids,
  whyNotOthers: f.whyNotOthers,
  hiredBefore: f.hiredBefore,
  pastExperienceNotes: f.pastExperienceNotes,
  concerns: f.concerns,
  whatMatters: f.whatMatters,
  wantsToLearn: f.wantsToLearn,
  interiorSensitivities: f.interiorSensitivities,
  pets: f.pets,
  petNotes: f.petNotes,
  carefulItems: f.carefulItems,
  carefulItemsNotes: f.carefulItemsNotes,
  walkthroughNotes: f.walkthroughNotes,
  outcome: f.outcome,
  nextFollowUpAt: f.nextFollowUpAt,
};

export const SurveysRepo = {
  async get(id: string): Promise<SalesSurvey> {
    const rec = await airtable.get<Fields>(tables.salesSurveys, id);
    return fromRecord(rec);
  },

  /**
   * Start the survey for an appointment — or resume it if one already exists
   * (idempotent, so tapping the same contact twice never forks the data).
   * Prefills Project Type from the opportunity's Job Type when it maps.
   */
  async findOrCreate(opportunityId: string, by: string): Promise<SalesSurvey> {
    const opp = await airtable.get<Fields>(tables.opportunities, opportunityId);
    const existingId = firstLinkId(opp.fields[of.surveys]);
    if (existingId) return this.get(existingId);

    const contactId = firstLinkId(opp.fields[of.contact]);
    const contactName = contactId
      ? (await OpportunityContactsRepo.byIds([contactId])).get(contactId)?.name
      : undefined;
    const jobType = opt(opp.fields[of.jobType]);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

    const fields: Fields = {
      [f.name]: `${contactName || String(opp.fields[of.name] ?? "Survey")} — ${today}`,
      [f.opportunity]: [opportunityId],
      [f.surveyedBy]: by,
      [f.surveyedAt]: new Date().toISOString(),
    };
    if (jobType === "Interior" || jobType === "Exterior") {
      fields[f.projectType] = jobType;
    }
    const rec = await airtable.create<Fields>(tables.salesSurveys, fields);
    return fromRecord(rec);
  },

  /**
   * Autosave: write only the provided answers (null clears). When the estimator
   * sets Next Follow-Up, mirror it to the opportunity's Sales Follow-Up At so
   * the deal sleeps/resurfaces on the Deals board without a second entry.
   */
  async patch(id: string, patch: SurveyPatch, by: string): Promise<SalesSurvey> {
    const fields: Fields = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      fields[PATCH_FIELD[key as keyof SurveyPatch]] = value;
    }
    if (Object.keys(fields).length === 0) return this.get(id);

    const rec = await airtable.update<Fields>(tables.salesSurveys, id, fields);
    const survey = fromRecord(rec);

    if (patch.nextFollowUpAt !== undefined && survey.opportunityId) {
      await airtable.update<Fields>(tables.opportunities, survey.opportunityId, {
        [of.salesFollowUpAt]: patch.nextFollowUpAt,
        [of.lastAction]: "survey-follow-up",
        [of.lastActionBy]: by,
        [of.lastActionAt]: new Date().toISOString(),
      });
    }
    return survey;
  },

  /**
   * Appointments to survey, split by whether one exists yet. `upNext` = the six
   * appointments closest to now (yesterday onward) with no survey — the list
   * the estimator sees when they open the page. `search` filters every
   * opportunity by contact/opportunity name instead.
   */
  async candidates(query?: string): Promise<SurveyCandidate[]> {
    const recs = await airtable.listAll<Fields>(tables.opportunities, {
      ...(query
        ? {}
        : { filterByFormula: `{${of.appointmentAt}}!=BLANK()` }),
      fields: [of.name, of.contact, of.jobType, of.appointmentAt, of.surveys],
    });

    // Resolve contact names in one batch — the opportunity name is a fallback.
    const contactIds = recs
      .map((r) => firstLinkId(r.fields[of.contact]))
      .filter((v): v is string => Boolean(v));
    const names = contactIds.length
      ? await OpportunityContactsRepo.byIds(contactIds)
      : new Map();

    const rows: SurveyCandidate[] = recs.map((rec) => {
      const cid = firstLinkId(rec.fields[of.contact]);
      return {
        opportunityId: rec.id,
        name:
          (cid ? names.get(cid)?.name : undefined) ||
          String(rec.fields[of.name] ?? "") ||
          "(unnamed)",
        jobType: opt(rec.fields[of.jobType]),
        appointmentAt: opt(rec.fields[of.appointmentAt]),
        surveyId: firstLinkId(rec.fields[of.surveys]),
      };
    });

    if (query) {
      const q = query.trim().toLowerCase();
      return rows
        .filter((r) => r.name.toLowerCase().includes(q))
        .sort((a, b) => (b.appointmentAt ?? "").localeCompare(a.appointmentAt ?? ""))
        .slice(0, 25);
    }

    const now = Date.now();
    const dayAgo = now - 86_400_000;
    return rows
      .filter((r) => !r.surveyId)
      .filter((r) => {
        const t = Date.parse(r.appointmentAt ?? "");
        return !Number.isNaN(t) && t >= dayAgo;
      })
      .sort(
        (a, b) =>
          Math.abs(Date.parse(a.appointmentAt!) - now) -
          Math.abs(Date.parse(b.appointmentAt!) - now),
      )
      .slice(0, 6);
  },
};
