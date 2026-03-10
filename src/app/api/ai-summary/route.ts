import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { modelSummary } = await request.json();

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PERPLEXITY_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a Power BI semantic model architect. Analyze the following model metadata and provide a comprehensive architecture summary. Cover:
1. Schema pattern (star schema, snowflake, etc.)
2. Fact and dimension table identification
3. Data connectivity mode analysis (Direct Lake, Import, DirectQuery)
4. Measure organization and complexity
5. Row-Level Security analysis
6. Potential concerns or anti-patterns
7. Performance optimization suggestions

Be specific and reference actual table/column names from the model. Format your response in clear paragraphs.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this Power BI semantic model:\n\n${modelSummary}` },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Perplexity API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "No summary generated.";

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate summary" },
      { status: 500 }
    );
  }
}
