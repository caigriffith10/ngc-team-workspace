---
name: "ngc-quiz-builder"
description: "Turn course text, notes, slides or an uploaded document into multiple-choice quiz questions in the exact JSON format the NextGen Coders Team Workspace imports. Use when the user says 'NextGen quiz', 'NextGen Quiz Builder', 'make quiz questions for the workspace', or pastes course material and asks for a quiz for the NextGen Coders training site. Always produce exactly the number of questions requested."
---

# NextGen Quiz Builder

Make multiple-choice quiz questions from course material and output them as JSON that the NextGen Coders Team Workspace "Import from Claude" box accepts.

## Step 1: Get the source and the count

- Read the pasted text, notes, or uploaded document completely. Do not skim.
- The number of questions the user asks for is a hard requirement. If they gave no number, ask how many they want before writing.
- The audience is NextGen Coders volunteers and instructors, who are often high school students. Keep wording clear and friendly.

## Step 2: Write the questions

- Every question must be answerable from the source material alone. Do not add outside facts.
- One fact per question. Do not combine two ideas, and do not skip important facts to finish early.
- Cover the material in roughly the order it was taught, spread evenly across all sections.
- Questions are short, direct, and self-contained. Never refer to "the previous question" or "the text above".
- Mix types: definitions ("What is X?"), what-to-do situations ("A student seems stuck. What should you do first?"), and spot-the-mistake questions.
- Give each question 3 or 4 options (never fewer than 2, never more than 6).
- Most questions have one correct option. Occasionally (at most 1 in 4) write a "select all that apply" question with two or more correct options, and say "Select all that apply" in the question text. Wrong options must be plausible, similar in length and style to the right one, and clearly wrong to someone who read the material. No "all of the above" or "none of the above".
- Vary which position holds the correct answer so it is not always the same one.
- No trailing periods needed on short options. Keep each option under 120 characters.
- Remove duplicate or near-duplicate questions.

## Step 3: Output format (exact)

Output ONLY one JSON code block, with this shape:

```json
{
  "questions": [
    {
      "question": "What should you do first if a student is stuck?",
      "options": ["Ask what they have tried so far", "Type the answer for them", "Tell them to wait", "Skip to the next student"],
      "correct": [0]
    },
    {
      "question": "Which of these help a stuck student? (Select all that apply)",
      "options": ["Ask what they have tried", "Give a small hint", "Type the answer for them", "Point to the relevant example"],
      "correct": [0, 1, 3],
      "multi": true
    }
  ]
}
```

Rules for the JSON:
- `correct` is a list of numbers: the 0-based positions of the correct options in `options` (0 is the first option, 1 the second, and so on). One number for a normal question, several for "select all that apply" (and then also add `"multi": true`).
- Use straight double quotes only. No trailing commas. No comments inside the JSON.
- Escape any double quote inside text with a backslash.

## Step 4: Verify before replying

1. Count the questions. The count must equal the number requested. If the material does not contain enough distinct facts without padding or repeating, say so and give fewer rather than inventing filler.
2. For each question, check that `correct` points at the right option(s) and that every number is between 0 and the last option index.
3. Check the JSON is valid.

## Output

Reply with the single JSON code block, then one short line: "Copy this and paste it into Import from Claude in the Team Workspace."
