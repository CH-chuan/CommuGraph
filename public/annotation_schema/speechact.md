1) Annotation unit and general rules

Unit
	•	Default unit = one turn (one message from Human or AI).
	•	Split a turn only if it contains two clearly separable speech acts (e.g., a request + a statement; and it can be common for each turn). If you don’t split, choose the primary act (see below).

Primary-act rule (when only one label allowed)

Pick the act that best captures the main conversational function of the turn:
	•	If the turn contains a Directive, it often dominates (“Can you…?” even if there’s extra context).
	•	If no Directive, look for Commissive, then Representative, then Expressive, then Declaration.

What you tag

Tag the act the utterance counts as in context (illocution), not:
	•	whether it’s true/correct (that’s representative evaluation, not type)
	•	whether it worked (that’s perlocution)

⸻

2) Label set (Searle’s five)

Use exactly these labels:
	1.	REPRESENTATIVE (ASSERTIVE)
	2.	DIRECTIVE
	3.	COMMISSIVE
	4.	EXPRESSIVE
	5.	DECLARATION (DECLARATIVE)

⸻

3) Definitions + decision tests + examples

A) REPRESENTATIVE (ASSERTIVE)

Definition: Speaker commits to a proposition as describing how things are (belief/claim/explain/report).
Theory: Direction of fit = words-to-world; expresses the speaker's belief.
Quick test: "Is the speaker mainly stating/claiming/explaining something about the world/model/task?"
Typical forms: statements, explanations, diagnoses, evaluations, descriptions.

Examples
	•	“The error is caused by a missing dependency.”
	•	“Your code is O(n²) because of the nested loop.”
	•	“This approach won’t work with streaming.”

Edge notes
	•	“I think / I believe / Probably” still counts as Representative (hedged claim).
	•	AI answers are often Representative by default.

⸻

B) DIRECTIVE

Definition: Speaker attempts to get the hearer to do something (request, command, question, suggestion).
Theory: Direction of fit = world-to-words; expresses the speaker's desire.
Quick test: "Is the speaker trying to elicit an action or response from the other side?"
Typical forms: questions, requests, instructions, prompts like "Explain…", "Generate…", "Fix…".

Examples
	•	“Can you rewrite this function?”
	•	“Explain why the p-value is low.”
	•	“Give me a Python script to parse these logs.”
	•	“Try using a smaller batch size.”

Edge notes
	•	Questions are directives (they request an answer).
	•	“Let’s do X” is usually Directive (suggesting a joint action).

⸻

C) COMMISSIVE

Definition: Speaker commits themself to some future action (promise, offer, agree, refuse).
Theory: Direction of fit = world-to-words; expresses the speaker's intention.
Quick test: "Is the speaker binding themselves to do something later?"
Typical forms: "I will…", "I can…", "I'll do X next", "I won't…".

Examples
	•	“I’ll draft the email now.”
	•	“I can generate a table for you.”
	•	“I won’t provide that information.”

Edge notes (important for AI)
	•	AI often uses commissive language (“I’ll…”) even when it’s basically just transitioning. Still tag by illocutionary force: if it’s a commitment, label Commissive.

⸻

D) EXPRESSIVE

Definition: Speaker expresses an emotional/attitudinal state (thanks, apology, frustration, praise).
Theory: Direction of fit = none (no words-to-world or world-to-words); expresses the speaker's emotion.
Quick test: "Is the main point to express feeling/attitude rather than state facts or request action?"
Typical forms: "Thanks", "Sorry", "Great", "This is annoying".

Examples
	•	“Thanks, that worked!”
	•	“I’m sorry for the confusion.”
	•	“Ugh, this is still failing.”

Edge notes
	•	If “thanks + request” appears, primary is often Directive if the request is the main function.

⸻

E) DECLARATION (DECLARATIVE)

Definition: Utterance changes an institutional/social status by being said (requires authority/role/institution).
Theory: Direction of fit = two-way (words change world, world matches words); no psychological state expressed; relies on extralinguistic institution.
Quick test: "Does saying it make it so (within an institutional frame)?"
Typical forms: "You are fired", "I pronounce…", "Meeting adjourned", system-like state changes.

Examples (rare in chats)
	•	“I hereby declare the meeting adjourned.”
	•	“You are banned from the server.” (if speaker has authority)
	•	“I now appoint you as moderator.” (if valid authority exists)

Edge notes for Human–AI
	•	Most AI declarations are not actually valid in real institutions, but you’re tagging illocutionary type, so classify as Declaration only if it’s framed as an institutional status-change, not merely “I will proceed”.

⸻

4) Disambiguation rules (fast heuristics)

Rule 1: If it’s a question → DIRECTIVE

Even if it contains facts.

Rule 2: “Here is / This is / The reason is…” → usually REPRESENTATIVE

Unless it’s “Here is what you should do…” (then Directive).

Rule 3: “I will / I can / I won’t” → COMMISSIVE

Unless it’s clearly just a factual prediction (“This will fail” = Representative).

Rule 4: Pure affect (“thanks”, “sorry”, “great”) → EXPRESSIVE

Unless it’s mainly doing something else (“Thanks—can you also…” often Directive).

Rule 5: Institutional status change language → DECLARATION

Only when it’s explicitly doing a status-change.

⸻

5) Multi-act turns (how to handle)

Option A (recommended): allow one primary label + optional secondary
	•	primary_type: one of five
	•	secondary_type (optional): one of five

Example

“Can you fix this? The stack trace points to schema.py.”

	•	Primary: DIRECTIVE
	•	Secondary: REPRESENTATIVE

Option B: single label only

Use the primary-act rule from section 1.
