export type Modality =
  | "vitals"
  | "activity"
  | "sleep"
  | "body"
  | "nutrition"
  | "fitness"
  | "mindfulness"
  | "workout"
  | "other";

export const MODALITIES: Record<Modality, string> = {
  vitals: "Heart rate, HRV, blood pressure, SpO2, respiratory rate",
  activity: "Steps, distance, active energy, exercise time, flights climbed",
  sleep: "Sleep analysis, sleep stages, sleep duration",
  body: "Weight, height, BMI, body fat percentage",
  nutrition: "Calories, protein, carbs, fat, water intake",
  fitness: "VO2 Max, readiness scores",
  mindfulness: "Mindful sessions, meditation",
  workout: "Exercise sessions, workout details",
  other: "Documents, clinical photos, misc",
};

export interface Reading {
  id?: number;
  source_id: string;
  source_type: string;
  record_type: string;
  short_name: string;
  modality: Modality;
  value: number | null;
  unit: string;
  timestamp: string;
  end_timestamp: string | null;
  metadata: Record<string, unknown>;
  dedup_key: string;
}

export interface Summary {
  id?: number;
  source_id: string;
  date: string;
  modality: Modality;
  summary: string;
  structured_data: Record<string, unknown>;
}

export interface Note {
  id?: number;
  timestamp: string;
  text: string;
  source: string;
  annotation_date: string | null;
  annotation_modality: Modality | null;
  created_at?: string;
}

/** Apple Health type identifier -> [modality, shortName] */
export const HEALTH_TYPE_MAP: Record<string, [Modality, string]> = {
  // Vitals
  HKQuantityTypeIdentifierHeartRate: ["vitals", "HeartRate"],
  HKQuantityTypeIdentifierRestingHeartRate: ["vitals", "RestingHR"],
  HKQuantityTypeIdentifierWalkingHeartRateAverage: ["vitals", "WalkingHR"],
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: ["vitals", "HRV"],
  HKQuantityTypeIdentifierOxygenSaturation: ["vitals", "SpO2"],
  HKQuantityTypeIdentifierRespiratoryRate: ["vitals", "RespiratoryRate"],
  HKQuantityTypeIdentifierBloodPressureSystolic: ["vitals", "BPSystolic"],
  HKQuantityTypeIdentifierBloodPressureDiastolic: ["vitals", "BPDiastolic"],
  HKQuantityTypeIdentifierBloodGlucose: ["vitals", "BloodGlucose"],
  HKQuantityTypeIdentifierBodyTemperature: ["vitals", "BodyTemp"],
  // Activity
  HKQuantityTypeIdentifierStepCount: ["activity", "Steps"],
  HKQuantityTypeIdentifierDistanceWalkingRunning: ["activity", "Distance"],
  HKQuantityTypeIdentifierActiveEnergyBurned: ["activity", "ActiveEnergy"],
  HKQuantityTypeIdentifierBasalEnergyBurned: ["activity", "BasalEnergy"],
  HKQuantityTypeIdentifierFlightsClimbed: ["activity", "FlightsClimbed"],
  HKQuantityTypeIdentifierAppleExerciseTime: ["activity", "ExerciseTime"],
  HKQuantityTypeIdentifierAppleStandTime: ["activity", "StandTime"],
  // Sleep
  HKCategoryTypeIdentifierSleepAnalysis: ["sleep", "SleepAnalysis"],
  // Body
  HKQuantityTypeIdentifierBodyMass: ["body", "Weight"],
  HKQuantityTypeIdentifierHeight: ["body", "Height"],
  HKQuantityTypeIdentifierBodyMassIndex: ["body", "BMI"],
  HKQuantityTypeIdentifierBodyFatPercentage: ["body", "BodyFat"],
  HKQuantityTypeIdentifierLeanBodyMass: ["body", "LeanMass"],
  // Nutrition
  HKQuantityTypeIdentifierDietaryEnergyConsumed: ["nutrition", "Calories"],
  HKQuantityTypeIdentifierDietaryProtein: ["nutrition", "Protein"],
  HKQuantityTypeIdentifierDietaryCarbohydrates: ["nutrition", "Carbs"],
  HKQuantityTypeIdentifierDietaryFatTotal: ["nutrition", "Fat"],
  HKQuantityTypeIdentifierDietaryWater: ["nutrition", "Water"],
  // Fitness
  HKQuantityTypeIdentifierVO2Max: ["fitness", "VO2Max"],
  // Mindfulness
  HKCategoryTypeIdentifierMindfulSession: ["mindfulness", "MindfulSession"],
};

/** Types that accumulate (sum per day) */
export const SUM_TYPES = new Set([
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierDistanceWalkingRunning",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierBasalEnergyBurned",
  "HKQuantityTypeIdentifierFlightsClimbed",
  "HKQuantityTypeIdentifierAppleExerciseTime",
  "HKQuantityTypeIdentifierAppleStandTime",
  "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  "HKQuantityTypeIdentifierDietaryProtein",
  "HKQuantityTypeIdentifierDietaryCarbohydrates",
  "HKQuantityTypeIdentifierDietaryFatTotal",
  "HKQuantityTypeIdentifierDietaryWater",
]);

/** Types where we count occurrences */
export const COUNT_TYPES = new Set([
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKCategoryTypeIdentifierMindfulSession",
]);
