```
       |     |
        \   /
         \ /
          /\
         /  \
        |    |
        |    |

    L E M N I S C U S
```

# Lemniscus Light

**Local health data MCP server. Your wearable data + LLM memory, on your device.**

> **DISCLAIMER:** Lemniscus is not a medical device. It is not intended for diagnosis, treatment, or clinical decision-making. It has not been evaluated, approved, or cleared by the FDA or any regulatory authority. LLM-generated analysis may be inaccurate, incomplete, or misleading. For informational and research purposes only. Always consult a qualified healthcare professional for medical advice.

## What is this?

Lemniscus Light is a local-first MCP server that ingests wearable health data (starting with Apple Health XML exports), stores it in SQLite, and exposes it to any MCP-compatible LLM (Claude, GPT, Llama, Gemini, etc.). The LLM can also write timestamped notes back — meals, mood, symptoms, context — creating a bidirectional health timeline where wearable metrics and human context live side by side.

The name comes from the medial lemniscus — a sensory neural pathway that carries information upward. This tool carries your health data to your AI.

Everything runs locally. No servers, no accounts, no telemetry. Your health data never leaves your device.

## Quick Start

### 1. Install and ingest your data

```bash
git clone https://github.com/cjgoodmaker/lemniscus_light.git
cd lemniscus_light
npm install
npm run build
```

Export your Apple Health data from your iPhone (Health app > Profile > Export All Health Data), then:

```bash
node build/scripts/ingest.js ~/path/to/export.xml
```

You'll see progress as it parses and summarises your data.

### 2. Configure your MCP client

Create a `.mcp.json` file in the `lemniscus_light` directory (the directory where you run `claude`):

```json
{
  "mcpServers": {
    "lemniscus": {
      "command": "node",
      "args": ["/absolute/path/to/lemniscus_light/build/src/index.js"]
    }
  }
}
```

> Tip: run `pwd` inside the `lemniscus_light` directory to get the absolute path to use above.

Then restart Claude Code — it will pick up the new MCP server automatically.

For **Claude Desktop**, add the same block to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).

### 3. Ask questions

```
"What were my heart rate trends last month?"
"How was my sleep last week?"
"Show me days I was most active"
"I had food poisoning yesterday — annotate that"
```

## Tools

| Tool | Type | Description |
|------|------|-------------|
| `browse_timeline` | read | Browse daily summaries and notes by date range and modality |
| `query_health_readings` | read | Get raw individual readings (every heart rate measurement, etc.) |
| `retrieve_health_context` | read | Natural language search across summaries and notes |
| `list_sources` | read | List ingested data sources with record counts |
| `list_modalities` | read | List available data categories and what they contain |
| `add_note` | write | Save a timestamped note to the timeline (meals, mood, symptoms) |
| `annotate` | write | Attach context to a specific date ("food poisoning", "started new medication") |

## Example Conversation

```
User: How was my heart rate yesterday?

Claude: [uses browse_timeline] Your resting heart rate was 53 bpm yesterday,
which is the lowest this week (weekly avg 60). Heart rate ranged from
48-142 bpm, with the spike during your morning run. HRV was 45ms.

User: I actually felt pretty terrible yesterday — had food poisoning
the night before.

Claude: [uses annotate] I've annotated January 15th with "food poisoning
the previous night." That context will show up alongside your health
data when you look at this period in the future.

User: When have I felt sick recently?

Claude: [uses retrieve_health_context] Found 1 annotation:
- Jan 15: "food poisoning the previous night" — that day your resting HR
  was 53 bpm (lowest this week) and activity was low at 4,200 steps.
```

Notes written by one model are readable by another. Claude's observations are visible to GPT, and vice versa.

## Model Agnostic

Lemniscus Light works with any MCP-compatible client:
- Claude (Code & Desktop)
- GPT (via MCP bridge)
- Llama, Gemini, or any model with MCP support

The server communicates over stdio using the standard Model Context Protocol. No vendor lock-in.

## Your Data Stays Local

- All data stored in a single SQLite file (`~/.lemniscus/health.db`)
- No network requests of any kind
- No accounts, no sign-up, no telemetry
- No cloud services or external dependencies
- You own your data completely

## Supported Data Types

| Type | Records | Description |
|------|---------|-------------|
| Heart Rate | HeartRate, RestingHR, WalkingHR | Continuous and resting measurements |
| Heart Rate Variability | HRV | SDNN measurements |
| Blood Oxygen | SpO2 | Oxygen saturation readings |
| Blood Pressure | BPSystolic, BPDiastolic | Systolic and diastolic readings |
| Respiratory Rate | RespiratoryRate | Breaths per minute |
| Steps | Steps | Step count |
| Distance | Distance | Walking + running distance |
| Energy | ActiveEnergy, BasalEnergy | Calories burned |
| Exercise | ExerciseTime | Exercise minutes |
| Flights | FlightsClimbed | Flights of stairs |
| Sleep | SleepAnalysis | Sleep stages and duration |
| Weight | Weight, BMI, BodyFat | Body composition |
| Nutrition | Calories, Protein, Carbs, Fat, Water | Dietary intake |
| Fitness | VO2Max | Cardio fitness |
| Workouts | Running, Cycling, Yoga, etc. | Individual workout sessions |
| Mindfulness | MindfulSession | Meditation sessions |

## Architecture

```
+-----------------------------------------------------+
|  Any LLM (Claude, GPT, Llama, Gemini, ...)          |
|                                                      |
|  read  <- browse_timeline(start, end, modality)      |
|  read  <- retrieve_health_context("sleep trends")    |
|  read  <- query_health_readings(type, start, end)    |
|  write -> add_note("had pizza and 2 beers")          |
|  write -> annotate(date, "food poisoning")           |
|                                                      |
+------------------ MCP Protocol ----------------------+
|                                                      |
|  Lemniscus Light Engine                              |
|  +-----------+  +-------------+  +-----------+       |
|  | Ingest    |  | SQLite      |  | FTS5      |       |
|  | Pipeline  |->| + Rich      |<-| Search    |       |
|  | (stream   |  |   Summaries |  | Engine    |       |
|  |  XML)     |  |   + Notes   |  |           |       |
|  +-----------+  +-------------+  +-----------+       |
|                                                      |
+------------------------------------------------------+
```

## CLI Commands

```bash
# Ingest Apple Health export
node build/scripts/ingest.js ./export.xml

# Start MCP server (usually done automatically by your MCP client)
node build/src/index.js
```

The database defaults to `~/.lemniscus/health.db`. Override with the `LEMNISCUS_DB` environment variable.

## Coming Soon

- Garmin Connect import
- Oura Ring import
- Smarter trend summaries

## License

Apache 2.0 — see [LICENSE](LICENSE).
