// Gender wording selected for this study; the available legacy template had two options.
export const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"] as const;

// Preserve the wording and order in CogSearch/src/templates/demographic.html.
export const RACE_OPTIONS = [
    "Native American/Alaska Native",
    "Asian",
    "Native Hawaiian or Other Pacific Islander",
    "Black or African American",
    "White or Caucasian",
    "Multiple categories",
] as const;

export function validateDemographicCategories(data: Record<string, unknown>): string | null {
    if (!GENDER_OPTIONS.some(option => option === data.gender)) return "Please select a gender option.";
    if (data.isHispanic !== "Yes" && data.isHispanic !== "No") return "Please answer whether you are Hispanic or Latino.";
    if (!RACE_OPTIONS.some(option => option === data.race)) return "Please select an ethnic or racial category.";
    return null;
}
