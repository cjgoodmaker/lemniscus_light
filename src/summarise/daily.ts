import type Database from "better-sqlite3";
import type { Modality, Summary } from "../types.js";
import { upsertSummary } from "../store/write.js";

interface DayMetric {
  short_name: string;
  record_type: string;
  unit: string;
  values: number[];
  end_timestamps: (string | null)[];
}

interface WeeklyContext {
  [shortName: string]: { avg: number; min: number; max: number; count: number };
}

function fmt(n: number, decimals = 0): string {
  if (decimals === 0) return Math.round(n).toLocaleString("en-US");
  return n.toFixed(decimals);
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function relativeContext(
  shortName: string,
  value: number,
  weekly: WeeklyContext,
): string {
  const ctx = weekly[shortName];
  if (!ctx || ctx.count < 3) return "";
  if (value > ctx.avg * 1.2) return ` (above weekly avg of ${fmt(ctx.avg)})`;
  if (value < ctx.avg * 0.8) return ` (below weekly avg of ${fmt(ctx.avg)})`;
  return "";
}

function summariseActivity(
  metrics: Map<string, DayMetric>,
  weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const steps = sum(metrics.get("Steps"));
  const distance = sum(metrics.get("Distance"));
  const flights = sum(metrics.get("FlightsClimbed"));
  const exercise = sum(metrics.get("ExerciseTime"));
  const activeEnergy = sum(metrics.get("ActiveEnergy"));
  const basalEnergy = sum(metrics.get("BasalEnergy"));
  const standTime = sum(metrics.get("StandTime"));

  const label =
    steps > 12000
      ? "Active day"
      : steps > 6000
        ? "Moderate day"
        : steps > 0
          ? "Light day"
          : "Rest day";

  const parts: string[] = [];
  parts.push(`${label}`);

  if (steps > 0) {
    let s = `${fmt(steps)} steps`;
    if (distance > 0) s += ` (${fmt(distance, 1)} km)`;
    s += relativeContext("Steps", steps, weekly);
    parts.push(s);
  }
  if (flights > 0) parts.push(`${fmt(flights)} flights climbed`);
  if (exercise > 0) parts.push(`Exercise: ${fmtDuration(exercise)}`);
  if (activeEnergy > 0) parts.push(`Active energy: ${fmt(activeEnergy)} kcal`);
  if (standTime > 0) parts.push(`Standing: ${fmtDuration(standTime)}`);
  if (basalEnergy > 0) parts.push(`Basal: ${fmt(basalEnergy)} kcal`);

  const data: Record<string, unknown> = {};
  if (steps > 0) data["steps"] = Math.round(steps);
  if (distance > 0) data["distance_km"] = round(distance, 1);
  if (flights > 0) data["flights"] = Math.round(flights);
  if (exercise > 0) data["exercise_min"] = Math.round(exercise);
  if (activeEnergy > 0) data["active_energy_kcal"] = Math.round(activeEnergy);
  if (basalEnergy > 0) data["basal_energy_kcal"] = Math.round(basalEnergy);
  if (standTime > 0) data["stand_time_min"] = Math.round(standTime);

  return { text: parts.join(". ") + ".", data };
}

function summariseVitals(
  metrics: Map<string, DayMetric>,
  weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};

  const restingHR = metrics.get("RestingHR");
  const hr = metrics.get("HeartRate");
  const hrv = metrics.get("HRV");
  const spo2 = metrics.get("SpO2");
  const respRate = metrics.get("RespiratoryRate");

  if (restingHR && restingHR.values.length > 0) {
    const avg = mean(restingHR.values);
    let s = `Resting heart rate: ${fmt(avg)} bpm`;
    const ctx = weekly["RestingHR"];
    if (ctx && ctx.count >= 3) {
      if (avg <= ctx.min) s += " (lowest this week)";
      else if (avg >= ctx.max) s += " (highest this week)";
      else s += ` (weekly avg ${fmt(ctx.avg)})`;
    }
    parts.push(s);
    data["resting_hr_bpm"] = round(avg, 0);
  }

  if (hr && hr.values.length > 0) {
    const lo = Math.min(...hr.values);
    const hi = Math.max(...hr.values);
    parts.push(`Heart rate range: ${fmt(lo)}-${fmt(hi)} bpm`);
    data["hr_min"] = Math.round(lo);
    data["hr_max"] = Math.round(hi);
  }

  if (hrv && hrv.values.length > 0) {
    const avg = mean(hrv.values);
    parts.push(`HRV: ${fmt(avg)}ms (SDNN)`);
    data["hrv_ms"] = round(avg, 0);
  }

  if (spo2 && spo2.values.length > 0) {
    const avg = mean(spo2.values);
    // Apple Health stores SpO2 as either fraction (0.97) or percentage (97)
    const pct = avg <= 1 ? avg * 100 : avg;
    parts.push(`SpO2: ${fmt(pct)}%`);
    data["spo2_pct"] = round(pct, 0);
  }

  if (respRate && respRate.values.length > 0) {
    const avg = mean(respRate.values);
    parts.push(`Respiratory rate: ${fmt(avg, 1)} breaths/min`);
    data["resp_rate"] = round(avg, 1);
  }

  return { text: parts.join(". ") + ".", data };
}

function summariseSleep(
  metrics: Map<string, DayMetric>,
  _weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const sleep = metrics.get("SleepAnalysis");
  if (!sleep || sleep.values.length === 0) {
    return { text: "No sleep data recorded.", data: {} };
  }

  // Sleep values are typically duration in minutes or category values
  // Sum all sleep segments for total
  const totalMin = sum(metrics.get("SleepAnalysis"));
  const parts: string[] = [];
  const data: Record<string, unknown> = {};

  if (totalMin > 0) {
    parts.push(`Sleep: ${fmtDuration(totalMin)}`);
    data["total_sleep_min"] = Math.round(totalMin);
    data["total_sleep_hours"] = round(totalMin / 60, 1);
  } else {
    // Category-based sleep: count entries
    parts.push(`Sleep: ${sleep.values.length} sleep segments recorded`);
    data["segments"] = sleep.values.length;
  }

  return { text: parts.join(". ") + ".", data };
}

function summariseBody(
  metrics: Map<string, DayMetric>,
  weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};

  const weight = metrics.get("Weight");
  const bmi = metrics.get("BMI");
  const bodyFat = metrics.get("BodyFat");

  if (weight && weight.values.length > 0) {
    const val = weight.values[weight.values.length - 1]!;
    const unit = weight.unit || "kg";
    let s = `Weight: ${fmt(val, 1)} ${unit}`;
    const ctx = weekly["Weight"];
    if (ctx && ctx.count >= 2) {
      const diff = val - ctx.avg;
      if (Math.abs(diff) > 0.1) {
        s += ` (${diff > 0 ? "up" : "down"} ${fmt(Math.abs(diff), 1)} from weekly avg)`;
      }
    }
    parts.push(s);
    data["weight"] = round(val, 1);
    data["weight_unit"] = unit;
  }

  if (bmi && bmi.values.length > 0) {
    parts.push(`BMI: ${fmt(bmi.values[bmi.values.length - 1]!, 1)}`);
    data["bmi"] = round(bmi.values[bmi.values.length - 1]!, 1);
  }

  if (bodyFat && bodyFat.values.length > 0) {
    const val = bodyFat.values[bodyFat.values.length - 1]!;
    parts.push(`Body fat: ${fmt(val * 100, 1)}%`);
    data["body_fat_pct"] = round(val * 100, 1);
  }

  return { text: parts.join(". ") + ".", data };
}

function summariseNutrition(
  metrics: Map<string, DayMetric>,
  _weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};

  const cal = sum(metrics.get("Calories"));
  const protein = sum(metrics.get("Protein"));
  const carbs = sum(metrics.get("Carbs"));
  const fat = sum(metrics.get("Fat"));
  const water = sum(metrics.get("Water"));

  if (cal > 0) {
    parts.push(`Intake: ${fmt(cal)} kcal`);
    data["calories_kcal"] = Math.round(cal);
  }

  const macros: string[] = [];
  if (protein > 0) {
    macros.push(`Protein: ${fmt(protein)}g`);
    data["protein_g"] = Math.round(protein);
  }
  if (carbs > 0) {
    macros.push(`Carbs: ${fmt(carbs)}g`);
    data["carbs_g"] = Math.round(carbs);
  }
  if (fat > 0) {
    macros.push(`Fat: ${fmt(fat)}g`);
    data["fat_g"] = Math.round(fat);
  }
  if (macros.length > 0) parts.push(macros.join(", "));

  if (water > 0) {
    parts.push(`Water: ${fmt(water / 1000, 1)}L`);
    data["water_ml"] = Math.round(water);
  }

  return { text: parts.join(". ") + ".", data };
}

function summariseWorkout(
  metrics: Map<string, DayMetric>,
  _weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};
  const workouts: Array<{ name: string; duration: number }> = [];

  for (const [name, metric] of metrics) {
    if (metric.values.length > 0) {
      const dur = metric.values[0]!;
      workouts.push({ name, duration: dur });
      parts.push(`Workout: ${name}, ${fmtDuration(dur)}`);
    }
  }

  data["workouts"] = workouts;
  data["count"] = workouts.length;

  if (parts.length === 0) return { text: "No workout data.", data };
  return { text: parts.join(". ") + ".", data };
}

function summariseFitness(
  metrics: Map<string, DayMetric>,
  weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};

  const vo2 = metrics.get("VO2Max");
  if (vo2 && vo2.values.length > 0) {
    const val = vo2.values[vo2.values.length - 1]!;
    let s = `VO2 Max: ${fmt(val, 1)} mL/kg/min`;
    s += relativeContext("VO2Max", val, weekly);
    parts.push(s);
    data["vo2max"] = round(val, 1);
  }

  if (parts.length === 0) return { text: "Fitness data recorded.", data };
  return { text: parts.join(". ") + ".", data };
}

function summariseMindfulness(
  metrics: Map<string, DayMetric>,
  _weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const session = metrics.get("MindfulSession");
  const count = session ? session.values.length : 0;
  const totalMin = sum(session);
  const data: Record<string, unknown> = {
    sessions: count,
    total_min: Math.round(totalMin),
  };
  if (count === 0)
    return { text: "No mindfulness sessions recorded.", data };
  return {
    text: `Mindfulness: ${count} session${count > 1 ? "s" : ""}, ${fmtDuration(totalMin)} total.`,
    data,
  };
}

function summariseGeneric(
  metrics: Map<string, DayMetric>,
  _weekly: WeeklyContext,
): { text: string; data: Record<string, unknown> } {
  const parts: string[] = [];
  const data: Record<string, unknown> = {};
  for (const [name, metric] of metrics) {
    if (metric.values.length > 0) {
      const avg = mean(metric.values);
      parts.push(`${name}: ${fmt(avg, 1)} ${metric.unit} (${metric.values.length} readings)`);
      data[name] = { avg: round(avg, 1), count: metric.values.length };
    }
  }
  return { text: parts.join(". ") + ".", data };
}

// --- Helpers ---

function sum(metric: DayMetric | undefined): number {
  if (!metric) return 0;
  return metric.values.reduce((a, b) => a + b, 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(n: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// --- Main entry ---

const SUMMARISERS: Record<
  string,
  (
    m: Map<string, DayMetric>,
    w: WeeklyContext,
  ) => { text: string; data: Record<string, unknown> }
> = {
  activity: summariseActivity,
  vitals: summariseVitals,
  sleep: summariseSleep,
  body: summariseBody,
  nutrition: summariseNutrition,
  workout: summariseWorkout,
  fitness: summariseFitness,
  mindfulness: summariseMindfulness,
};

export function generateDailySummaries(
  db: Database.Database,
  sourceId: string,
): number {
  // Find (date, modality) pairs that need summaries
  const pairs = db
    .prepare(
      `SELECT DISTINCT substr(timestamp, 1, 10) as date, modality
       FROM readings
       WHERE source_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM summaries
           WHERE summaries.source_id = readings.source_id
             AND summaries.date = substr(readings.timestamp, 1, 10)
             AND summaries.modality = readings.modality
         )
       ORDER BY date`,
    )
    .all(sourceId) as Array<{ date: string; modality: Modality }>;

  let count = 0;

  for (const { date, modality } of pairs) {
    // Get readings for this day + modality
    const rows = db
      .prepare(
        `SELECT short_name, record_type, unit, value, end_timestamp
         FROM readings
         WHERE source_id = ? AND modality = ? AND substr(timestamp, 1, 10) = ?
         ORDER BY timestamp`,
      )
      .all(sourceId, modality, date) as Array<{
      short_name: string;
      record_type: string;
      unit: string;
      value: number | null;
      end_timestamp: string | null;
    }>;

    // Group by short_name
    const metrics = new Map<string, DayMetric>();
    for (const r of rows) {
      let m = metrics.get(r.short_name);
      if (!m) {
        m = {
          short_name: r.short_name,
          record_type: r.record_type,
          unit: r.unit,
          values: [],
          end_timestamps: [],
        };
        metrics.set(r.short_name, m);
      }
      if (r.value !== null) m.values.push(r.value);
      m.end_timestamps.push(r.end_timestamp);
    }

    // Get 7-day rolling context
    const weeklyRows = db
      .prepare(
        `SELECT short_name,
                AVG(value) as avg_val,
                MIN(value) as min_val,
                MAX(value) as max_val,
                COUNT(*) as cnt
         FROM readings
         WHERE source_id = ? AND modality = ?
           AND date(timestamp) >= date(?, '-7 days')
           AND date(timestamp) < ?
         GROUP BY short_name`,
      )
      .all(sourceId, modality, date, date) as Array<{
      short_name: string;
      avg_val: number;
      min_val: number;
      max_val: number;
      cnt: number;
    }>;

    const weekly: WeeklyContext = {};
    for (const w of weeklyRows) {
      weekly[w.short_name] = {
        avg: w.avg_val,
        min: w.min_val,
        max: w.max_val,
        count: w.cnt,
      };
    }

    // Generate summary
    const summariser = SUMMARISERS[modality] ?? summariseGeneric;
    const { text, data } = summariser(metrics, weekly);

    if (text && text !== ".") {
      const summary: Summary = {
        source_id: sourceId,
        date,
        modality,
        summary: text,
        structured_data: {
          ...data,
          reading_count: rows.length,
        },
      };
      upsertSummary(db, summary);
      count++;
    }
  }

  return count;
}
