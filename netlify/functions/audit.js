exports.handler = async (event) => {
  var h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: h, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: h, body: JSON.stringify({ error: "Method not allowed" }) };

  var API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers: h, body: JSON.stringify({ error: "API key not set." }) };

  try {
    var body = JSON.parse(event.body);
    var url = body.url, name = body.name, industry = body.industry;
    if (!url || !name || !industry) return { statusCode: 400, headers: h, body: JSON.stringify({ error: "Missing fields." }) };

    var prompt = 'Audit ' + url + ' for "' + name + '" (' + industry + '). Respond with ONLY valid JSON, nothing else:\n\n{"overall_score":0,"summary":"","seo":{"score":0,"grade":"F","findings":[{"check":"Meta Title","status":"fail","detail":"","fix":""},{"check":"Meta Description","status":"fail","detail":"","fix":""},{"check":"Heading Structure","status":"fail","detail":"","fix":""},{"check":"Mobile Optimization","status":"fail","detail":"","fix":""},{"check":"HTTPS/SSL","status":"fail","detail":"","fix":""},{"check":"Page Speed","status":"fail","detail":"","fix":""},{"check":"Internal Linking","status":"fail","detail":"","fix":""},{"check":"Image Alt Text","status":"fail","detail":"","fix":""},{"check":"XML Sitemap","status":"fail","detail":"","fix":""},{"check":"Canonical URLs","status":"fail","detail":"","fix":""}]},"aeo":{"score":0,"grade":"F","findings":[{"check":"FAQ Schema","status":"fail","detail":"","fix":""},{"check":"Question Headings","status":"fail","detail":"","fix":""},{"check":"Snippet Readiness","status":"fail","detail":"","fix":""},{"check":"Voice Search","status":"fail","detail":"","fix":""},{"check":"Answer Formatting","status":"fail","detail":"","fix":""},{"check":"HowTo Schema","status":"fail","detail":"","fix":""},{"check":"Knowledge Panel","status":"fail","detail":"","fix":""},{"check":"Answer Paragraphs","status":"fail","detail":"","fix":""}]},"geo":{"score":0,"grade":"F","findings":[{"check":"Structured Data","status":"fail","detail":"","fix":""},{"check":"E-E-A-T Signals","status":"fail","detail":"","fix":""},{"check":"Content Citability","status":"fail","detail":"","fix":""},{"check":"AI Crawler Access","status":"fail","detail":"","fix":""},{"check":"Author Expertise","status":"fail","detail":"","fix":""},{"check":"Content Freshness","status":"fail","detail":"","fix":""},{"check":"Data Citations","status":"fail","detail":"","fix":""},{"check":"LocalBusiness Schema","status":"fail","detail":"","fix":""},{"check":"AI Visibility","status":"fail","detail":"","fix":""},{"check":"Multi-Platform","status":"fail","detail":"","fix":""}]},"priority_fixes":[{"rank":1,"action":"","impact":"high","effort":"low","category":"SEO"},{"rank":2,"action":"","impact":"high","effort":"low","category":"GEO"},{"rank":3,"action":"","impact":"high","effort":"medium","category":"AEO"},{"rank":4,"action":"","impact":"medium","effort":"medium","category":"SEO"},{"rank":5,"action":"","impact":"medium","effort":"high","category":"GEO"}],"competitor_note":""}\n\nFill ALL values with real findings for this business. Status: pass/fail/warning. Scores 0-100. Most small biz sites score 20-50. Be honest and specific.';

    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!res.ok) {
      var errText = await res.text();
      return { statusCode: 200, headers: h, body: JSON.stringify({ error: "API error " + res.status + ": " + errText.substring(0, 150) }) };
    }

    var data = await res.json();
    var text = "";
    for (var i = 0; i < (data.content || []).length; i++) {
      if (data.content[i].type === "text") text += data.content[i].text;
    }

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) return { statusCode: 200, headers: h, body: JSON.stringify({ error: "No JSON in response. Try again." }) };

    var parsed = JSON.parse(match[0]);
    if (parsed.overall_score !== undefined) {
      return { statusCode: 200, headers: h, body: JSON.stringify(parsed) };
    }
    return { statusCode: 200, headers: h, body: JSON.stringify({ error: "Invalid format. Try again." }) };

  } catch (err) {
    return { statusCode: 200, headers: h, body: JSON.stringify({ error: "Error: " + err.message }) };
  }
};
