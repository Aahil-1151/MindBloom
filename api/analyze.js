/* ==========================================================================
   MindBloom — api/analyze.js
   Same Vercel serverless pattern as api/chat.js: OPENAI_API_KEY stays
   server-side, this is the one place it's read. Where api/chat.js holds
   a live conversation, this endpoint takes a snapshot of a student's
   already-logged history (never a new message being typed) and returns
   a structured assessment — either a burnout read (scripts/burnout-
   score.js's geminiEngine) or a week-in-review summary (scripts/weekly-
   summary.js's geminiSummarizer). Both callers fall back to their local,
   deterministic logic on any failure here, so this endpoint being down
   or slow never breaks the page — see computeScoreAsync/generate in
   those files.
   ========================================================================== */

const BASE_PERSONA = `You are Bloom's analysis engine inside MindBloom, a student wellbeing app
covering physical, emotional, mental, and academic health. You are not
chatting with the student — you're reading their own already-logged
history (moods, sleep, stress, tasks, journal entries) and producing a
short structured assessment for the app to display back to them.

Tone: warm, direct, and specific — a grounded, caring peer-mentor's read
of the data, not a clinical report and not generic encouragement. Avoid
therapy-speak and avoid emoji.`;

const SAFETY_RULES = `Never diagnose a mental health condition or use clinical/alarmist
language. Describe what the data shows in plain, human terms.

If anything in the student's journal text or logged history suggests
they may be at risk of harming themselves, do not analyze it as just
another data point and do not try to counsel them yourself. In that
case your suggestedAction (or summary) must gently point them to a real
crisis line instead of general advice — the 988 Suicide & Crisis
Lifeline (call or text 988) or the Crisis Text Line (text HOME to
741741) — and the rest of your response should stay short and caring
rather than analytical.`;

const BURNOUT_TASK = `You'll receive a JSON object with the student's raw day-by-day history
over roughly the last one to two weeks — mood, sleep hours, stress
level, task load — plus a handful of their own journal entries.

Unlike a simple average, look for TRAJECTORY and CORRELATION: a sleep
decline landing in the same stretch as a workload spike matters more
than either fact alone. Reference the actual numbers or events you were
given specifically (e.g. "your sleep dropped under 6h three nights
running right as two assignments came due") rather than speaking
generically — if the data is too sparse to say anything specific, say
that plainly instead of inventing detail.

Respond with a JSON object shaped exactly like this, and nothing else
outside the JSON:
{"score": 0-100, "level": "low" | "moderate" | "high", "reasoning": "2-3 sentences, plain language, referencing the actual data", "suggestedAction": "one specific, doable next step"}`;

const SUMMARY_TASK = `You'll receive a JSON object with the student's raw logged history and
journal entries from the past 7 days, plus a few pre-computed averages
for reference.

Write a short "week in review" that reads like someone who actually
paid attention — reference real specifics from their journal entries or
logged data rather than generic encouragement. 2-4 sentences.

Respond with a JSON object shaped exactly like this, and nothing else
outside the JSON:
{"summary": "2-4 sentences"}`;

function buildSystemPrompt(type) {
  const task = type === "summary" ? SUMMARY_TASK : BURNOUT_TASK;
  return BASE_PERSONA + "\n\n" + SAFETY_RULES + "\n\n" + task;
}

export default async function handler(req, res) {
  // Same open-CORS tradeoff as api/chat.js: the API key is what's actually
  // protected (server-side only), so allowing any origin here is fine for
  // a small student project that may also run from a local dev copy or an
  // app wrapper with no fixed origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing OPENAI_API_KEY. Set it in your Vercel project's Environment Variables.",
    });
  }

  const { type, payload } = req.body || {};
  if (type !== "burnout" && type !== "summary") {
    return res.status(400).json({ error: 'Request body must include type: "burnout" or "summary".' });
  }
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: "Request body must include a payload object." });
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          { role: "system", content: buildSystemPrompt(type) },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error("api/analyze.js: OpenAI API error:", openaiResponse.status, errBody);
      // Status only (not the body, which can echo back account/billing
      // details) — enough for the caller to log what kind of failure this
      // was; both callers fall back to local logic regardless.
      return res.status(502).json({
        error: "The AI provider returned an error.",
        openaiStatus: openaiResponse.status,
      });
    }

    const data = await openaiResponse.json();
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error("api/analyze.js: model did not return valid JSON:", raw);
      return res.status(502).json({ error: "The AI provider returned an unparseable response." });
    }

    if (type === "burnout") {
      const level = ["low", "moderate", "high"].indexOf(parsed.level) !== -1 ? parsed.level : "low";
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      return res.status(200).json({
        score: Number.isFinite(score) ? score : 0,
        level: level,
        reasoning: parsed.reasoning || "",
        suggestedAction: parsed.suggestedAction || "",
      });
    }

    return res.status(200).json({ summary: parsed.summary || "" });
  } catch (err) {
    console.error("api/analyze.js handler error:", err);
    return res.status(500).json({ error: "Something went wrong generating an analysis." });
  }
}
