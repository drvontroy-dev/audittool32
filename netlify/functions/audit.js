// Set Netlify function timeout to max allowed
exports.config = {
  maxDuration: 60
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "API key not configured." }) };
  }

  try {
    const { url, name, industry } = JSON.parse(event.body);
    if (!url || !name || !industry) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing fields." }) };
    }

    const prompt = `You are an expert website auditor specializing in SEO, AEO (Answer Engine Optimization), and GEO (Generative Engine Optimization).

Analyze the website at ${url} for the business "${name}" in the "${industry}" industry.

Based on your knowledge of what a typical ${industry} small business website looks like, common issues in this industry, and best practices for SEO/AEO/GEO, produce a comprehensive audit.

Consider these factors:
- Most small business websites have basic SEO at best
- Almost none have AEO optimization (FAQ schema, question-based headings, featured snippet formatting)
- Almost none have GEO optimization (AI citability, structured data for LLMs, E-E-A-T signals)
- Schema markup is missing on 31% of all websites
- 65% of searches now end with zero clicks
- AI Overviews appear on 13%+ of Google queries

RESPOND WITH ONLY A VALID JSON OBJECT. No other text before or after. No markdown. No backticks. No explanation.

{"overall_score":0,"summary":"2-3 sentence summary here","seo":{"score":0,"grade":"F","findings":[{"check":"Meta Title","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Meta Description","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Heading Structure","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Mobile Optimization","status":"warning","detail":"finding here","fix":"recommendation here"},{"check":"HTTPS/SSL","status":"pass","detail":"finding here","fix":"recommendation here"},{"check":"Page Speed","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Internal Linking","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Image Alt Text","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"XML Sitemap","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Canonical URLs","status":"warning","detail":"finding here","fix":"recommendation here"}]},"aeo":{"score":0,"grade":"F","findings":[{"check":"FAQ Schema Markup","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Question-Based Headings","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Featured Snippet Readiness","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Voice Search Optimization","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Direct Answer Formatting","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"HowTo Schema","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Knowledge Panel Signals","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Concise Answer Paragraphs","status":"fail","detail":"finding here","fix":"recommendation here"}]},"geo":{"score":0,"grade":"F","findings":[{"check":"Structured Data","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"E-E-A-T Signals","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Content Citability","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"AI Crawler Access","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Author Expertise","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Content Freshness","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Data Citations","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"LocalBusiness Schema","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"AI Platform Visibility","status":"fail","detail":"finding here","fix":"recommendation here"},{"check":"Multi-Platform Consistency","status":"fail","detail":"finding here","fix":"recommendation here"}]},"priority_fixes":[{"rank":1,"action":"action here","impact":"high","effort":"low","category":"SEO"},{"rank":2,"action":"action here","impact":"high","effort":"low","category":"GEO"},{"rank":3,"action":"action here","impact":"high","effort":"medium","category":"AEO"},{"rank":4,"action":"action here","impact":"medium","effort":"medium","category":"SEO"},{"rank":5,"action":"action here","impact":"medium","effort":"high","category":"GEO"}],"competitor_note":"note here"}

Replace ALL placeholder text with real, specific, actionable findings for this exact business and industry. Status must be "pass", "fail", or "warning". Scores 0-100. Grade A/B/C/D/F. Be brutally honest - most small business sites score 20-50 overall.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API error " + response.status + ": " + err.substring(0, 200) }) };
    }

    const result = await response.json();
    const text = (result.content || [])
      .filter(function(b) { return b.type === "text"; })
      .map(function(b) { return b.text; })
      .join("\n");

    var cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    var match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: "No JSON found in response. Try again.", debug: cleaned.substring(0, 200) }) };
    }

    var parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: "JSON parse error: " + e.message, debug: match[0].substring(0, 200) }) };
    }

    if (parsed && parsed.overall_score !== undefined) {
      return { statusCode: 200, headers, body: JSON.stringify(parsed) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ error: "Missing overall_score in response. Try again." }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
