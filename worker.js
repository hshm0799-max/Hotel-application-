// Cloudflare Worker: AI chat proxy for HR Digital
// Setup: wrangler secret put ANTHROPIC_API_KEY   (key stays on the server, never in the website)
const ALLOWED = ["https://hrzoteck.online", "https://www.hrzoteck.online"];
const MODEL = "claude-haiku-4-5-20251001";
const SYSTEM = `You are the AI assistant on the website of HR Digital, a digital marketing and website agency serving businesses across India.

About HR Digital:
- Services: website design and development, SEO, AEO/GEO (answer-engine and AI-search optimisation), Google Business Profile optimisation, Meta Ads (Facebook and Instagram), Google Ads, social media marketing, branding.
- Serves all cities and states in India, working remotely.
- Contact: call or WhatsApp +91 70618 99614, email hshm0799@gmail.com. Hours: Monday to Saturday, 10 AM to 7 PM.
- Website pages: services.html, pricing.html, meta-ads.html, locations.html, contact.html.

Rules:
- Answer the visitor's question helpfully and accurately. You can answer general questions too (marketing, business, technology, and everyday topics), but keep answers short: 2 to 5 sentences unless more is needed.
- Reply in the visitor's language: English, Hindi, or Hinglish (Hindi in Roman letters), matching how they write.
- Never invent prices, discounts, timelines, client names, results or guarantees. For exact pricing or a quote, ask for their city, service and goal and send them to WhatsApp +91 70618 99614 or email hshm0799@gmail.com.
- Do not promise rankings or specific results. SEO takes months and no agency can guarantee a Google position.
- Do not give legal, medical or financial advice beyond general information; suggest a professional.
- If you do not know something, say so plainly instead of guessing.
- Be friendly and concise. When the visitor shows buying interest, suggest a quote on WhatsApp.
`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!ALLOWED.includes(origin)) return json({ error: "Forbidden" }, 403);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "No question" }, 400);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 450, system: SYSTEM, messages }),
    });
    if (!r.ok) return json({ error: "AI unavailable" }, 502);
    const data = await r.json();
    const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    return json({ reply: reply || "Sorry, I could not answer that. Please WhatsApp us on +91 70618 99614." });
  },
};
