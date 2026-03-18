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
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured. Add it in Netlify → Site Settings → Environment Variables." }),
    };
  }

  try {
    const { url, name, industry } = JSON.parse(event.body);

    if (!url || !name || !industry) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields: url, name, industry" }) };
    }

    const prompt = `You are an expert SEO, AEO, and GEO auditor. Analyze the website at ${url} for business "${name}" in the "${industry}" industry.

Use your web_search tool to:
1. Search for "${url}" to find information about the site
2. Search for "${name} ${industry} reviews" to check their online presence
3. Search for "site:${url}" to check indexed pages
4. Search for "${name}" on general queries to see AI citability

Based on ALL information you can gather, provide a comprehensive audit. You MUST respond with ONLY valid JSON, no markdown, no backticks, no preamble. Use this exact structure:

{
  "overall_score": <number 0-100>,
  "summary": "<2-3 sentence executive summary of findings>",
  "seo": {
    "score": <number 0-100>,
    "grade": "<A/B/C/D/F>",
    "findings": [
      {"check": "Meta Title", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Meta Description", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Heading Structure (H1-H6)", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Mobile Optimization", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "HTTPS/SSL Security", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Page Speed Signals", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Internal Linking", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Image Alt Text", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "XML Sitemap", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Canonical URLs", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"}
    ]
  },
  "aeo": {
    "score": <number 0-100>,
    "grade": "<A/B/C/D/F>",
    "findings": [
      {"check": "FAQ Schema Markup", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Question-Based Headings", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Featured Snippet Readiness", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Voice Search Optimization", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Direct Answer Formatting", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "HowTo / Recipe Schema", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Knowledge Panel Signals", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Concise Answer Paragraphs", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"}
    ]
  },
  "geo": {
    "score": <number 0-100>,
    "grade": "<A/B/C/D/F>",
    "findings": [
      {"check": "Structured Data (Schema.org)", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "E-E-A-T Signals", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Content Citability", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "AI Crawler Access (robots.txt)", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Author / Expertise Signals", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Content Freshness", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Statistical / Data Citations", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "LocalBusiness Schema", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "AI Platform Visibility", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"},
      {"check": "Multi-Platform Consistency", "status": "<pass|fail|warning>", "detail": "<what you found>", "fix": "<recommendation>"}
    ]
  },
  "priority_fixes": [
    {"rank": 1, "action": "<most impactful fix>", "impact": "high", "effort": "<low|medium|high>", "category": "<SEO|AEO|GEO>"},
    {"rank": 2, "action": "<second most impactful>", "impact": "high", "effort": "<low|medium|high>", "category": "<SEO|AEO|GEO>"},
    {"rank": 3, "action": "<third>", "impact": "high", "effort": "<low|medium|high>", "category": "<SEO|AEO|GEO>"},
    {"rank": 4, "action": "<fourth>", "impact": "medium", "effort": "<low|medium|high>", "category": "<SEO|AEO|GEO>"},
    {"rank": 5, "action": "<fifth>", "impact": "medium", "effort": "<low|medium|high>", "category": "<SEO|AEO|GEO>"}
  ],
  "competitor_note": "<Brief note about competitor visibility in AI search for this industry/area>"
}

Be thorough, specific, and brutally honest. Reference actual findings from the website. Every "fail" should have a concrete, actionable fix. Do NOT pad scores - most small business websites should score 20-50 overall because they have zero AEO/GEO optimization. Only give high scores if genuinely earned.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      return {
        statusCode: response.status, headers,
        body: JSON.stringify({ error: "API request failed: " + response.status, detail: errBody }),
      };
    }

    const result = await response.json();

    // Extract text blocks from the response
    const textBlocks = (result.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Parse JSON from response
    let parsed = null;
    try {
      const cleaned = textBlocks.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("JSON parse error:", e.message);
    }

    if (parsed && parsed.overall_score !== undefined) {
      return { statusCode: 200, headers, body: JSON.stringify(parsed) };
    } else {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ error: "Could not parse audit results", raw: textBlocks.substring(0, 500) }),
      };
    }
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Server error: " + err.message }),
    };
  }
};
