# DRAFT — Privacy notice for the NextGen Coders Team Workspace

> **Status: DRAFT for review. Not published, not linked from the site, not legal advice.**
> It describes only what the code actually does. Everything in **[CONFIRM: …]** is a business fact or a legal question the organization must answer (ideally with a lawyer or the board) before this is shown to anyone. Do not publish it with the placeholders left in.

## Who runs this site
NextGen Coders **[CONFIRM: legal name of the organization, e.g. the nonprofit's registered name]**, contact: nextgencoderswr@gmail.com. Public website: https://www.nextgencoderswr.com

## Who it is for
The workspace is for NextGen Coders volunteers and instructors. Accounts are created by an admin; people cannot sign up on their own. Many volunteers are high school students. **[CONFIRM: minimum volunteer age, and whether parent/guardian permission is collected for volunteers under 18 and where that record is kept.]**

## What we store about you
| Information | Why | Who can see it |
|---|---|---|
| Name, username, role | To sign you in and show you the right pages | Admins; your name may appear to admins and Senior Leads in lists |
| Email address (optional) | So admins can send class emails | Admins |
| Password | To sign you in. Stored encrypted, and **admins can view it** (the organization chose this so admins can help people who are locked out) | Admins |
| Course activity: quiz answers and scores, written answers, files you upload, time spent, whether an admin confirmed it | To track training | You (your own summary) and admins |
| "Redo" requests from an admin | To ask you to repeat a course | You and admins |
| Your name and role in the attendance view | Instructor attendance is read from a Google Sheet and matched by name or email | Admins and roles given that permission |

We do **not** use advertising, analytics or tracking tools, and we do not sell information. **[CONFIRM: this is still true when this notice is published.]**

## Cookies
One cookie, `ngc_session`, keeps you signed in for up to 8 hours. It is needed for the site to work, so there is no cookie banner. Dark mode is remembered in your browser's local storage on your own device.

## Other services that handle information
- **Vercel** — hosts the website. **[CONFIRM when deployed]**
- **Neon** — stores the database (everything in the table above). **[CONFIRM when deployed]**
- **Resend** — delivers class emails (recipient addresses and the message). Used only when an admin sends one.
- **Google** — the "Mark Absent" form and the instructor attendance spreadsheet are Google services run by the organization; what you enter there is handled under Google's terms and the organization's own settings. **[CONFIRM: who can access that form's responses and that spreadsheet.]**
- **YouTube (privacy-enhanced mode)** — some courses embed videos. Playing one loads content from YouTube.

## How long we keep it
**[CONFIRM: retention rule, e.g. "accounts and training records are deleted X months after someone stops volunteering".]** Until a rule is chosen, records stay until an admin deletes the account.

## Your choices
Ask an admin (nextgencoderswr@gmail.com) to correct or delete your account. Deleting an account removes the person's course activity, uploads and redo flags from the workspace. **[CONFIRM: who handles requests, how fast, and any records that must be kept; confirm which privacy laws apply (state law, and rules about under-18 volunteers).]**

## Changes
**[CONFIRM: date of last update and how changes will be announced.]**

---
### Notes for the reviewer (delete before publishing)
- Facts above come from the code: `lib/types.ts` (what an account stores), `lib/crypto.ts` (password handling), `app/api/send-email` (Resend), `app/api/attendance-sheet` (Google Sheet), `lib/auth.ts` (the one cookie), `lib/video.ts` (YouTube privacy mode).
- Known weakness the board should decide on: passwords are reversible by design. Moving to hashed passwords plus a reset flow would remove the need to disclose "admins can view it" and is already on the roadmap in `CLAUDE.md`.
- If the site will ever collect information from the students NextGen teaches (not just volunteers), a different and stricter set of children's-privacy rules may apply. The app does not do that today.
