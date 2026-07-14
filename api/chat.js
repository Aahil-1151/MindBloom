/* ==========================================================================
   MindBloom — api/chat.js
   A minimal secure backend for Bloom's chat. This is a Vercel serverless
   function: anything in /api/*.js is automatically deployed as its own
   HTTPS endpoint when this project is deployed on Vercel, with the
   OPENAI_API_KEY read from a server-side environment variable that the
   browser (or an app wrapping this site) can never see.

   Why this file has to exist at all: an OpenAI API key must never be
   placed directly in client-side JavaScript (scripts/*.js) or bundled
   into an app — anyone could extract it from the page source or the
   packaged app and rack up charges on your account. This function is the
   one place the real key lives.
   ========================================================================== */

const SYSTEM_PROMPT = `You are Bloom, the AI wellbeing companion inside MindBloom, a student
wellbeing app covering physical, emotional, mental, and academic health.

Tone: warm, direct, concise (2-4 sentences per reply unless the student
clearly wants more detail). Sound like a grounded, caring peer-mentor, not
a clinician and not a hype-man. Avoid therapy-speak and avoid emoji.

Never diagnose a mental health condition. If the student describes
distress, validate it in plain language and, when it seems appropriate,
gently suggest a relevant part of the app (journaling, the breathing
exercise on the Wellbeing page, or talking to a real person) rather than
trying to solve everything in chat.

If the student expresses intent to harm themselves or says anything
suggesting a safety risk, do not attempt to counsel them yourself. Respond
with care, encourage them to contact a crisis line (988 Suicide & Crisis
Lifeline in the US, or Crisis Text Line by texting HOME to 741741), and
ask if they're safe right now. Keep this reply short and direct.

Always respond with a JSON object shaped exactly like this, and nothing
else outside the JSON:
{"reply": "your message to the student", "suggestions": ["short reply option 1", "short reply option 2", "short reply option 3"]}

"suggestions" are short (2-5 word) quick-reply chips relevant to what you
just said — think of them as things the student might tap instead of
typing.`;

export default async function handler(req, res) {
  // CORS: allows this endpoint to be called from the deployed site, a
  // locally-running dev copy, and a Capacitor-wrapped app (which has no
  // fixed browser origin). The API key itself is what's actually
  // protected — it never leaves this server — so an open CORS policy
  // here is an acceptable tradeoff for a small student project.
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

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Request body must include a messages array." });
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
        temperature: 0.8,
        max_tokens: 400,
        messages: [{ role: "system", content: SYSTEM_PROMPT }].concat(messages),
      }),
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errBody);
      return res.status(502).json({ error: "The AI provider returned an error." });
    }

    const data = await openaiResponse.json();
    const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      // Model didn't return valid JSON — fall back to using the raw text
      // as the reply so the conversation doesn't just break.
      parsed = { reply: raw || "I'm here — could you say that again?", suggestions: [] };
    }

    return res.status(200).json({
      text: parsed.reply || "I'm here — could you say that again?",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [],
    });
  } catch (err) {
    console.error("chat.js handler error:", err);
    return res.status(500).json({ error: "Something went wrong generating a reply." });
  }
}
