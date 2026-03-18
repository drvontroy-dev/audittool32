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
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured." }),
    };
  }

  try {
    const { url, name, industry } = JSON.parse(event.body);

    if (!url || !name || !industry) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required fields." }) };
    }

    const prompt = `You are an expert SEO, AEO, and GEO auditor. I need you to analyze the website at ${url} for the business "${name}" in the "${industry}" industry.

First, use web search to research this website and business. Search for:
- The website URL to learn about the site
- The business name and reviews
- Their online presence and visibility

After researching, provide your comprehensive audit as ONLY valid JSON with no other text, no markdown, no backticks. Use this exact structure:

{"overall_score":<number 0-100>,"summary":"<2-3 sentence executive summary>","seo":{"score":<number 0-100>,"grade":"<A/B/C/D/F>","findings":[{"check":"Meta Title","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Meta Description","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Heading Structure","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Mobile Optimization","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"HTTPS/SSL","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Page Speed","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Internal Linking","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Image Alt Text","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"XML Sitemap","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Canonical URLs","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"}]},"aeo":{"score":<number 0-100>,"grade":"<A/B/C/D/F>","findings":[{"check":"FAQ Schema Markup","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Question-Based Headings","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Featured Snippet Readiness","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Voice Search Optimization","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Direct Answer Formatting","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"HowTo Schema","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Knowledge Panel Signals","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Concise Answer Paragraphs","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"}]},"geo":{"score":<number 0-100>,"grade":"<A/B/C/D/F>","findings":[{"check":"Structured Data","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"E-E-A-T Signals","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Content Citability","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"AI Crawler Access","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Author Expertise","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Content Freshness","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Data Citations","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"LocalBusiness Schema","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"AI Platform Visibility","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"},{"check":"Multi-Platform Consistency","status":"<pass|fail|warning>","detail":"<finding>","fix":"<recommendation>"}]},"priority_fixes":[{"rank":1,"action":"<fix>","impact":"high","effort":"<low|medium|high>","category":"<SEO|AEO|GEO>"},{"rank":2,"action":"<fix>","impact":"high","effort":"<low|medium|high>","category":"<SEO|AEO|GEO>"},{"rank":3,"action":"<fix>","impact":"high","effort":"<low|medium|high>","category":"<SEO|AEO|GEO>"},{"rank":4,"action":"<fix>","impact":"medium","effort":"<low|medium|high>","category":"<SEO|AEO|GEO>"},{"rank":5,"action":"<fix>","impact":"medium","effort":"<low|medium|high>","category":"<SEO|AEO|GEO>"}],"competitor_note":"<competitor insight>"}

Be brutally honest. Most small business sites should score 20-50 overall. Only give high scores if earned.`;

    // First call - Claude will use web search
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return {
        statusCode: response.status, headers,
        body: JSON.stringify({ error: "API error: " + response.status, detail: errBody.substring(0, 300) }),
      };
    }

    let result = await response.json();
    let messages = [{ role: "user", content: prompt }];

    // Handle multi-turn: if Claude wants to use tools, we need to continue the conversation
    let attempts = 0;
    while (result.stop_reason === "tool_use" && attempts < 5) {
      attempts++;
      // Add assistant response to messages
      messages.push({ role: "assistant", content: result.content });

      // Find all tool use blocks and create results
      const toolResults = result.content
        .filter(block => block.type === "tool_use")
        .map(block => ({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Search completed. Please continue with your analysis and provide the JSON audit."
        }));

      messages.push({ role: "user", content: toolResults });

      const nextResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 16000,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
          messages: messages,
        }),
      });

      if (!nextResponse.ok) {
        break;
      }

      result = await nextResponse.json();
    }

    // Extract all text blocks from the final response
    const allText = (result.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    // Try to parse JSON from the response
    let parsed = null;
    try {
      const cleaned = allText.replace(/```json/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Try finding JSON in individual text blocks
      for (const block of (result.content || [])) {
        if (block.type === "text") {
          try {
            const c = block.text.replace(/```json/g, "").replace(/```/g, "").trim();
            const m = c.match(/\{[\s\S]*\}/);
            if (m) {
              const p = JSON.parse(m[0]);
              if (p.overall_score !== undefined) { parsed = p; break; }
            }
          } catch (e2) { /* continue */ }
        }
      }
    }

    if (parsed && parsed.overall_score !== undefined) {
      return { statusCode: 200, headers, body: JSON.stringify(parsed) };
    } else {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          error: "Could not parse audit results. Please try again.",
          debug: allText.substring(0, 200)
        }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Server error: " + err.message }),
    };
  }
};
