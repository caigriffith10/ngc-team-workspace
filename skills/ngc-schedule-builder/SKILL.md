---
name: "ngc-schedule-builder"
description: "Turn a class calendar, list of dates, email, spreadsheet or pasted text into the exact JSON the NextGen Coders Team Workspace imports as its Schedule. Use when the user says 'NextGen schedule', 'NextGen Schedule Builder', 'make the schedule for the workspace', or pastes dates and asks for them in the format for the NextGen Coders site. NextGen only teaches Python, JavaScript, CSP (Code.org) and Scratch (scratch.mit.edu)."
---

# NextGen Schedule Builder

Turn the user's dates into one JSON block that the Team Workspace "Import from Claude" box on the Schedule editor accepts.

## Step 1: Read the source

- Read everything the user gave you (a calendar, an email, a table, a list of dates, a syllabus).
- If a date has no year, use the year the user mentions. If you cannot tell, ask once: "Which year is this schedule for?"
- If the user describes a repeating pattern ("every Saturday from Nov 1 to Dec 13, 10 to 12"), expand it into one entry per date. Skip dates the user says are cancelled or are holidays.
- Never invent dates, times, locations or topics that are not in the source.

## Step 2: Build each day

Every day is an object with these fields:

- `date` (required): `YYYY-MM-DD`, for example `2026-11-14`.
- `title`: short name of the session, for example `Python: loops` or `Scratch: first project`. Use only Python, JavaScript, CSP (Code.org) or Scratch for program names. Leave `""` if the source gives none.
- `startTime` and `endTime`: 24-hour `HH:MM`, for example `10:00` and `12:30`. Use `""` if unknown.
- `location`: where it happens, or `""`.
- `notes`: one short line for anything instructors should know (bring a laptop, doors open at 9:45), or `""`.

Sort the days from earliest to latest. Do not repeat a date and title twice.

## Step 3: Output format (exact)

Output ONLY one JSON code block:

```json
{
  "schedule": {
    "days": [
      {
        "date": "2026-11-14",
        "title": "Python: loops",
        "startTime": "10:00",
        "endTime": "12:00",
        "location": "Warner Robins Library",
        "notes": "Arrive by 9:45 to set up."
      },
      {
        "date": "2026-11-21",
        "title": "Scratch: first project",
        "startTime": "10:00",
        "endTime": "12:00",
        "location": "",
        "notes": ""
      }
    ]
  }
}
```

Rules for the JSON:
- Straight double quotes only. No trailing commas. No comments.
- Every field is present on every day. Use `""` for unknown values, never `null`.
- Escape any double quote inside text with a backslash.

## Step 4: Verify before replying

1. Every `date` is a real calendar date in `YYYY-MM-DD` form.
2. Times are `HH:MM` (24-hour) or `""`.
3. The days are in order, with no duplicates, and nothing was made up.
4. The JSON is valid.

## Output

Reply with the single JSON code block, then one short line: "Copy this and paste it into Import from Claude on the Schedule editor in the Team Workspace."
