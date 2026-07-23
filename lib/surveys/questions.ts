/**
 * The sales survey's question vocabulary — the single source of truth for the
 * answer chips the app renders AND the values the PATCH schema accepts. These
 * mirror the choice lists on the "NEW - Sales Surveys" Airtable table: add an
 * option in both places (Airtable rejects values it doesn't know).
 *
 * Pure module — imported by client components and server validation alike.
 */

export const PROJECT_TYPES = ["Interior", "Exterior", "Both"] as const;

export const DISC_READS = ["D", "I", "S", "C"] as const;

/** Q2 chips shown per project type. Both lists share "Doors"; "Other" always shows. */
export const SURFACES_INTERIOR = [
  "Walls",
  "Ceilings",
  "Trim & Baseboards",
  "Doors",
  "Cabinets",
] as const;
export const SURFACES_EXTERIOR = [
  "Eaves",
  "Siding",
  "Doors",
  "Garage Doors",
  "Shutters",
  "Brick",
  "Fence",
  "Deck",
] as const;
export const SURFACES = [
  "Walls",
  "Ceilings",
  "Trim & Baseboards",
  "Doors",
  "Cabinets",
  "Eaves",
  "Siding",
  "Garage Doors",
  "Shutters",
  "Brick",
  "Fence",
  "Deck",
  "Other",
] as const;

export const DAMAGE_ISSUES = ["Wood Rot", "Stains", "Drywall Repair", "Other"] as const;

export const COLORS_DECIDED = [
  "Picked Already",
  "Has Ideas",
  "Not Yet",
  "Wants Guidance",
] as const;

export const COLOR_CONSULTATION = ["Yes", "Maybe", "No"] as const;

export const TIMELINES = ["ASAP", "~2 Weeks", "~1 Month", "1–3 Months", "Flexible"] as const;

export const URGENCY_DRIVERS = [
  "Event / Guests Coming",
  "Selling The Home",
  "Just Moved In",
  "Weather Window",
  "HOA Notice",
  "No Deadline",
  "Other",
] as const;

export const MAIN_GOALS = [
  "Freshen Up",
  "New Look / Colors",
  "Protect & Maintain",
  "Prep To Sell",
  "Fix Damage",
  "Rental Turnover",
  "Other",
] as const;

export const OTHER_BIDS = [
  "We're The First",
  "Getting Multiple Bids",
  "Others Already Bid",
] as const;

export const HIRED_BEFORE = [
  "Yes — Went Well",
  "Yes — Bad Experience",
  "Yes — Mixed",
  "Never Hired",
] as const;

export const CONCERNS = [
  "Communication",
  "Crew Showing Up",
  "Quality",
  "Overspray",
  "Protecting Floors & Furniture",
  "Project Dragging Out",
  "Price",
  "Strangers In The Home",
  "Other",
] as const;

export const WHAT_MATTERS = [
  "Communication",
  "Quality",
  "Fair Price",
  "Warranty",
  "Local Reputation",
  "Reviews",
  "Professional Crew",
  "Licensed & Insured",
  "Other",
] as const;

export const INTERIOR_SENSITIVITIES = [
  "None",
  "Paint Smell / VOCs",
  "Dust",
  "Allergies",
  "Babies Or Elderly At Home",
  "Works From Home",
  "Other",
] as const;

export const PETS = ["No Pets", "Dogs", "Cats", "Other"] as const;

export const CAREFUL_ITEMS = [
  "Heirlooms / Antiques",
  "Fragile Landscaping",
  "Electronics",
  "None Flagged",
  "Other",
] as const;

export const OUTCOMES = [
  "Closed On The Spot",
  "Proposal To Follow",
  "Thinking It Over",
  "Needs Spouse / Partner",
  "Not A Fit",
] as const;
