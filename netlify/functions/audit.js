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

    // STEP 1: Research the website using web search
    const researchPrompt = `Research the website ${url} for the business "${name}" in the "${industry}" industry. Find out everything you can about:
- Their website structure, content, and technical setup
- Their online reviews and presence
- Whether they show up in AI search results
- Their competitors in the local area

Provide a detailed summary of all your findings.`;

    const researchRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: researchPrompt }],
      }),
    });

    if (!researchRes.ok) {
      const err = await researchRes.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Research failed: " + researchRes.status, detail: err.substring(0, 200) }) };
    }

    const researchResult = await researchRes.json();

    // Extract all text from research (ignore tool blocks)
    const researchText = (researchResult.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    // STEP 2: Generate structured JSON audit from research
    const auditPrompt = `Based on the following research about the website ${url} for "${name}" (${industry}), produce a comprehensive SEO/AEO/GEO audit.

RESEARCH FINDINGS:
${researchText || "No specific research available. Analyze based on general knowledge of typical " + industry + " websites."}

Now produce ONLY a valid JSON object (no other text, no markdown, no backticks) with this structure:

{"overall_score":0,"summary":"","seo":{"score":0,"grade":"F","findings":[{"check":"Meta Title","status":"fail","detail":"","fix":""},{"check":"Meta Description","status":"fail","detail":"","fix":""},{"check":"Heading Structure","status":"fail","detail":"","fix":""},{"check":"Mobile Optimization","status":"fail","detail":"","fix":""},{"check":"HTTPS/SSL","status":"fail","detail":"","fix":""},{"check":"Page Speed","status":"fail","detail":"","fix":""},{"check":"Internal Linking","status":"fail","detail":"","fix":""},{"check":"Image Alt Text","status":"fail","detail":"","fix":""},{"check":"XML Sitemap","status":"fail","detail":"","fix":""},{"check":"Canonical URLs","status":"fail","detail":"","fix":""}]},"aeo":{"score":0,"grade":"F","findings":[{"check":"FAQ Schema Markup","status":"fail","detail":"","fix":""},{"check":"Question-Based Headings","status":"fail","detail":"","fix":""},{"check":"Featured Snippet Readiness","status":"fail","detail":"","fix":""},{"check":"Voice Search Optimization","status":"fail","detail":"","fix":""},{"check":"Direct Answer Formatting","status":"fail","detail":"","fix":""},{"check":"HowTo Schema","status":"fail","detail":"","fix":""},{"check":"Knowledge Panel Signals","status":"fail","detail":"","fix":""},{"check":"Concise Answer Paragraphs","status":"fail","detail":"","fix":""}]},"geo":{"score":0,"grade":"F","findings":[{"check":"Structured Data","status":"fail","detail":"","fix":""},{"check":"E-E-A-T Signals","status":"fail","detail":"","fix":""},{"check":"Content Citability","status":"fail","detail":"","fix":""},{"check":"AI Crawler Access","status":"fail","detail":"","fix":""},{"check":"Author Expertise","status":"fail","detail":"","fix":""},{"check":"Content Freshness","status":"fail","detail":"","fix":""},{"check":"Data Citations","status":"fail","detail":"","fix":""},{"check":"LocalBusiness Schema","status":"fail","detail":"","fix":""},{"check":"AI Platform Visibility","status":"fail","detail":"","fix":""},{"check":"Multi-Platform Consistency","status":"fail","detail":"","fix":""}]},"priority_fixes":[{"rank":1,"action":"","impact":"high","effort":"low","category":"SEO"},{"rank":2,"action":"","impact":"high","effort":"low","category":"AEO"},{"rank":3,"action":"","impact":"high","effort":"medium","category":"GEO"},{"rank":4,"action":"","impact":"medium","effort":"medium","category":"SEO"},{"rank":5,"action":"","impact":"medium","effort":"high","category":"GEO"}],"competitor_note":""}

Fill in all values based on your research. Status must be "pass", "fail", or "warning". Scores 0-100. Be brutally honest. Most small business sites score 20-50 overall. RESPOND WITH ONLY THE JSON OBJECT.`;

    const auditRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{ role: "user", content: auditPrompt }],
      }),
    });

    if (!auditRes.ok) {
      const err = await auditRes.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Audit generation failed: " + auditRes.status }) };
    }

    const auditResult = await auditRes.json();
    const auditText = (auditResult.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    // Parse JSON
    let parsed = null;
    const cleaned = auditText.replace(/```json/g, "").replace(/```/g, "").trim();
    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch (e) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: "JSON parse failed. Try again.", debug: cleaned.substring(0, 300) }) };
    }

    if (parsed && parsed.overall_score !== undefined) {
      return { statusCode: 200, headers, body: JSON.stringify(parsed) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ error: "Invalid audit format. Try again." }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error: " + err.message }) };
  }
};
