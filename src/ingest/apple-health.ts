import * as fs from "node:fs";
import sax from "sax";
import type Database from "better-sqlite3";
import type { Reading, Modality } from "../types.js";
import { HEALTH_TYPE_MAP } from "../types.js";
import { insertReadingsBatch } from "../store/write.js";

const BATCH_SIZE = 10_000;

export interface IngestResult {
  readingsInserted: number;
  readingsSkipped: number;
  rawCount: number;
}

/**
 * Parse Apple Health timestamp format to ISO 8601.
 * Apple uses: "2024-01-15 08:30:00 -0700"
 * We produce: "2024-01-15T08:30:00-07:00"
 */
function parseAppleTimestamp(ts: string): string {
  // Format: "2024-01-15 08:30:00 -0700"
  const m = ts.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2})(\d{2})$/,
  );
  if (m) {
    return `${m[1]}T${m[2]}${m[3]}:${m[4]}`;
  }
  // Already ISO or other format — return as-is
  return ts;
}

/** Stream-parse an Apple Health export.xml and insert readings into the DB */
export function ingestAppleHealthXml(
  xmlPath: string,
  sourceId: string,
  db: Database.Database,
  onProgress?: (count: number) => void,
): Promise<IngestResult> {
  return new Promise<IngestResult>((resolve, reject) => {
    const saxStream = sax.createStream(true, { trim: true });
    let batch: Reading[] = [];
    let rawCount = 0;
    let inserted = 0;
    let skipped = 0;

    function flushBatch(): void {
      if (batch.length === 0) return;
      const n = insertReadingsBatch(db, batch);
      inserted += n;
      skipped += batch.length - n;
      batch = [];
    }

    saxStream.on("opentag", (node) => {
      if (node.name === "Record") {
        const type = node.attributes["type"] as string | undefined;
        if (!type) return;

        const mapping = HEALTH_TYPE_MAP[type];
        if (!mapping) return; // Skip unmapped types

        const [modality, shortName] = mapping;
        const startDate = node.attributes["startDate"] as string | undefined;
        const value = node.attributes["value"] as string | undefined;
        const unit = (node.attributes["unit"] as string) ?? "";
        const endDate = node.attributes["endDate"] as string | undefined;

        if (!startDate) return;

        const timestamp = parseAppleTimestamp(startDate);
        const endTimestamp = endDate ? parseAppleTimestamp(endDate) : null;
        const numValue = value !== undefined ? parseFloat(value) : null;
        const dedupKey = `${timestamp}|${type}|${numValue ?? "null"}`;

        const reading: Reading = {
          source_id: sourceId,
          source_type: "apple_health",
          record_type: type,
          short_name: shortName,
          modality: modality as Modality,
          value: Number.isNaN(numValue) ? null : numValue,
          unit,
          timestamp,
          end_timestamp: endTimestamp,
          metadata: {},
          dedup_key: dedupKey,
        };

        batch.push(reading);
        rawCount++;

        if (batch.length >= BATCH_SIZE) {
          flushBatch();
          onProgress?.(rawCount);
        }
      } else if (node.name === "Workout") {
        const activityType =
          (node.attributes["workoutActivityType"] as string) ?? "Unknown";
        const startDate = node.attributes["startDate"] as string | undefined;
        const endDate = node.attributes["endDate"] as string | undefined;
        const duration = node.attributes["duration"] as string | undefined;
        const energy =
          node.attributes["totalEnergyBurned"] as string | undefined;
        const durationUnit =
          (node.attributes["durationUnit"] as string) ?? "min";

        if (!startDate) return;

        const timestamp = parseAppleTimestamp(startDate);
        const endTimestamp = endDate ? parseAppleTimestamp(endDate) : null;
        const durationVal = duration ? parseFloat(duration) : null;
        const dedupKey = `${timestamp}|Workout|${activityType}`;

        const reading: Reading = {
          source_id: sourceId,
          source_type: "apple_health",
          record_type: "HKWorkout",
          short_name: activityType.replace("HKWorkoutActivityType", ""),
          modality: "workout",
          value: durationVal,
          unit: durationUnit,
          timestamp,
          end_timestamp: endTimestamp,
          metadata: {
            activityType,
            energyBurned: energy ? parseFloat(energy) : null,
          },
          dedup_key: dedupKey,
        };

        batch.push(reading);
        rawCount++;

        if (batch.length >= BATCH_SIZE) {
          flushBatch();
          onProgress?.(rawCount);
        }
      }
    });

    saxStream.on("end", () => {
      flushBatch();
      onProgress?.(rawCount);
      resolve({
        readingsInserted: inserted,
        readingsSkipped: skipped,
        rawCount,
      });
    });

    saxStream.on("error", (err) => {
      // Try to flush what we have
      try {
        flushBatch();
      } catch {
        // ignore flush errors during error handling
      }
      reject(err);
    });

    fs.createReadStream(xmlPath).pipe(saxStream);
  });
}
