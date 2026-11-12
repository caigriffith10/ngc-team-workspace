---
name: "ngc-lesson-builder"
description: "Turn notes, an outline, an uploaded presentation (PowerPoint .pptx, Google Slides export, Keynote export or PDF slides) or any uploaded document into a complete lesson (pages of formatted text, optional YouTube videos, quizzes and written-answer prompts) in the exact JSON format the NextGen Coders Team Workspace imports into Instructor Courses > Create. Use when the user says 'NextGen lesson', 'NextGen Lesson Builder', 'make a lesson for the workspace', uploads a presentation or slide deck, or pastes teaching material and asks for an instructor course for the NextGen Coders training site. NextGen only teaches Python, JavaScript, CSP (Code.org) and Scratch (scratch.mit.edu)."
---

# NextGen Lesson Builder

Build an instructor-training lesson from the user's material and output it as one JSON block that the Team Workspace "Import lesson from Claude" box accepts.

## Context

- NextGen Coders teaches coding to Middle Georgia students. The only programs are **Python, JavaScript, CSP (Code.org) and Scratch (scratch.mit.edu)**. Never write examples in Java, C++ or any other language, and never suggest other platforms.
- The readers are instructors, many of them high school students. Write in a clear, friendly, respectful tone. No slang, no talking down.

## Step 1: Get the source and the shape

- Read everything the user gave you before writing. Do not skim.
- If they did not say how many pages or whether they want a quiz, pick sensible defaults: 4 to 8 pages, and a short quiz (5 questions) on the last page. Ask only if the source is missing entirely.
- Ask for the program (Python, JavaScript, CSP or Scratch) only if it is unclear and it changes the content.

### If the user uploaded a presentation

Treat the deck as the source of truth and convert it faithfully. Do not just summarize it.

1. **Read every slide**, in order, including the speaker notes, slide titles, text boxes, lists, table contents, captions, code, and any alt text. Notes often hold the real explanation, so fold them into the page text. If the file is a PDF or images of slides and you cannot read some slide, say which slide numbers you could not read instead of guessing.
2. **Map slides to pages.** The Workspace allows at most **30 pages** and **60 blocks per page**.
   - Up to about 30 slides: one page per slide or per small group of closely related slides. Keep the original order. Use the slide title as the page title (shorten it if it is long).
   - More than 30 slides: merge consecutive slides on the same topic into one page (use an `<h2>` per original slide inside the page), but never drop content. Section divider slides become the title of the next page, not a page of their own.
   - Title slide: use it for the lesson `title` and `description`, and write a short "Goals" page from the agenda or objectives slide if the deck has one.
   - Skip only pure decoration: slide numbers, footers, logos, "Thank you / Questions?" slides.
3. **Convert content, keeping the wording.**
   - Bullets become `<ul>`/`<ol>` with the same nesting flattened to at most two levels. Slide titles inside a page become `<h2>` or `<h3>`.
   - Tables are not supported. Turn each row into a list item (`<li><strong>Column 1:</strong> value</li>`) or a short sentence.
   - Code on a slide goes in `<pre><code>...</code></pre>` with line breaks written as real `\n` inside the JSON string, or as inline `<code>` for short pieces. Escape `<`, `>` and `&` as `&lt;`, `&gt;`, `&amp;` inside code.
   - Hyperlinks become `<a href="https://...">` links. A YouTube link on a slide becomes a `video` block on that page (only if the URL is a real youtube.com or youtu.be link in the deck).
   - Pictures, screenshots, charts and diagrams cannot be imported. Do not drop them silently: add a line in the page like `<p><em>[Image from slide 7: a flowchart of the three steps for helping a stuck student. Add the picture here.]</em></p>` using the alt text or your description of it, so the admin knows where to add it with an Image block.
   - Animations, transitions and slide backgrounds are ignored.
4. **Add learning checks.** Presentations rarely include quizzes. After the converted pages, add a final "Check your understanding" page with a quiz of 5 questions built only from the deck's content (or as many as the deck supports, minimum 3). Add at most 1 or 2 `response` prompts if the deck ends with a discussion or reflection question. If the deck already has quiz or "try it" slides, turn them into real `quiz` or `response` blocks instead of copying them as text.
5. **Do not invent.** Facts, numbers, names, dates and policies come from the slides only. If the deck mentions a language other than Python, JavaScript, CSP or Scratch, keep it out of code examples and mention it to the user after the JSON.
6. After the JSON, add a short list for the admin: slides you merged or skipped, slides you could not read, and the pages with an image placeholder.

## Step 2: Plan the lesson

- One idea per page. Give each page a short, specific title ("Helping a stuck student", not "Page 3").
- Start with a welcome or goals page. End with a summary or quiz page.
- Use only facts from the source material. Do not invent policies, dates, names or numbers.

## Step 3: Write the content

Each page has a `blocks` list. Allowed block types:

1. `text`: formatted text, written as simple HTML in the `html` field. Allowed tags only: `<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<u>`, `<blockquote>`, `<code>`, `<pre>`, `<hr>`, `<br>`, and links as `<a href="https://...">text</a>`. No other tags, no attributes, no styles, no scripts, no images.
2. `video`: `{"type":"video","url":"https://www.youtube.com/watch?v=..."}`. Only include a link the user gave you. Never invent a URL.
3. `quiz`: `{"type":"quiz","title":"...","questions":[...]}` with 3 or 4 options per question (never fewer than 2, never more than 6), and `correct` as a list of 0-based positions (`[0]` means the first option). For "select all that apply" questions give several numbers and add `"multi": true`. Wrong options must be plausible. No "all of the above".
4. `response`: `{"type":"response","prompt":"Describe how you would greet a new student."}`. Use sparingly (0 to 2 per lesson) for reflection that an admin can read.

Do not output image, file or upload blocks. The admin adds those by hand.

## Step 4: Output format (exact)

Output ONLY one JSON code block:

```json
{
  "lesson": {
    "title": "Welcoming Every Student",
    "description": "How to make a Scratch class feel safe and friendly.",
    "pages": [
      {
        "title": "Goals",
        "blocks": [
          { "type": "text", "html": "<h2>What you'll learn</h2><ul><li>How to greet students</li><li>How to help when someone is stuck</li></ul>" }
        ]
      },
      {
        "title": "Check your understanding",
        "blocks": [
          {
            "type": "quiz",
            "title": "Quick check",
            "questions": [
              {
                "question": "What should you do first if a student is stuck?",
                "options": ["Ask what they have tried so far", "Type the answer for them", "Tell them to wait"],
                "correct": [0]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

JSON rules:
- Straight double quotes only. No trailing commas. No comments.
- Escape double quotes inside text with a backslash, and write the HTML on a single line per block (no raw line breaks inside strings; use `<p>` and `<br>` instead).
- `description` is one sentence.

## Step 5: Verify before replying

1. Every page has a title and at least one block.
2. Every quiz question has `correct` numbers that exist in its `options`.
3. Only the allowed tags appear in `html`. Nothing about languages other than Python, JavaScript, CSP or Scratch.
4. The JSON is valid.

5. Never more than 30 pages or 60 blocks on a page, or the import is rejected.
6. For a presentation: every slide's content is in the lesson (or listed as skipped), and image placeholders are marked.

## Output

Reply with the single JSON code block first (the Workspace import box reads the JSON out of your reply, so keep it as one clean block). Then add one short line: "Copy the JSON and paste it into Instructor Courses > Create > Import lesson from Claude in the Team Workspace." For an uploaded presentation, follow that line with the short admin notes from the presentation steps (merged or skipped slides, unreadable slides, image placeholders). Keep any text outside the code block free of curly braces and square brackets.
