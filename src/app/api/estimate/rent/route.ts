import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const { address, universityName, actualRent, units, occupancy } = await req.json();

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY in environment.' },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    const propertyContext = [
      `Property: "${address}"`,
      universityName ? `University: ${universityName}` : null,
      actualRent ? `Actual rent: $${actualRent}/bedroom/month` : null,
      units ? `Units: ${units}` : null,
      occupancy ? `Occupancy type: ${occupancy}` : null,
    ].filter(Boolean).join('\n');

    const prompt = actualRent
      ? `You are scoring rent vs. market for insurance underwriting of purpose-built student housing.

${propertyContext}

Score this property's actual rent ($${actualRent}/bed/mo) relative to the local student housing market on a 1-5 scale:
1 = Premium (>20% above market) — strong cash flow, high-quality product
2 = Above market (10-20% above) — good positioning
3 = At market (within ±10%) — standard
4 = Below market (10-20% below) — potential cash flow stress
5 = Well below market (>20% below) — possible distress, insufficient revenue

CRITICAL GUIDANCE on student housing rents by market type:
- Large SEC/Big 12/Big Ten schools in Southeast/Midwest college towns (UGA, Alabama, Auburn, Ole Miss, LSU, Iowa, etc.): typical purpose-built student housing is $600–950/bed/mo. Luxury/new product may be $900–1,300.
- Mid-major or smaller state schools in low-cost areas: $500–800/bed/mo typical.
- Large urban universities (UT Austin, OSU, Michigan, etc.): $800–1,400/bed/mo.
- Coastal/high-cost universities (UCLA, USC, NYU, Boston schools): $1,200–2,500/bed/mo.
- Small private colleges in rural areas: $500–800/bed/mo.

Use these ranges as calibration. Do NOT default to coastal/urban assumptions for college towns.

Return ONLY valid JSON (no markdown, no code blocks):
{"score": <1-5>, "estimated_market_range_low": <number>, "estimated_market_range_high": <number>, "confidence": "<high|medium|low>", "reasoning": "<2-3 sentence explanation referencing the local market>"}`
      : `You are estimating market rent for insurance underwriting of purpose-built student housing.

${propertyContext}

Estimate the typical market rent range (per bedroom per month) for purpose-built student housing in this market. No actual rent was provided, so default the score to 3 (at market).

CRITICAL GUIDANCE on student housing rents by market type:
- Large SEC/Big 12/Big Ten schools in Southeast/Midwest college towns (UGA, Alabama, Auburn, Ole Miss, LSU, Iowa, etc.): typical purpose-built student housing is $600–950/bed/mo. Luxury/new product may be $900–1,300.
- Mid-major or smaller state schools in low-cost areas: $500–800/bed/mo typical.
- Large urban universities (UT Austin, OSU, Michigan, etc.): $800–1,400/bed/mo.
- Coastal/high-cost universities (UCLA, USC, NYU, Boston schools): $1,200–2,500/bed/mo.
- Small private colleges in rural areas: $500–800/bed/mo.

Use these ranges as calibration. Do NOT default to coastal/urban assumptions for college towns.

Return ONLY valid JSON (no markdown, no code blocks):
{"score": 3, "estimated_market_range_low": <number>, "estimated_market_range_high": <number>, "confidence": "low", "reasoning": "<2-3 sentence explanation about the local market. Note that no actual rent was provided so this defaults to at-market.>"}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = JSON.parse(text.trim());

    const score = Math.max(1, Math.min(5, Math.round(parsed.score)));
    const rangeLow = parsed.estimated_market_range_low;
    const rangeHigh = parsed.estimated_market_range_high;

    return NextResponse.json({
      score,
      estimated_market_range_low: rangeLow,
      estimated_market_range_high: rangeHigh,
      confidence: parsed.confidence || 'medium',
      reasoning: parsed.reasoning || 'AI estimate based on available data.',
    });
  } catch (err) {
    console.error('Rent estimate error:', err);
    return NextResponse.json(
      {
        error: 'Failed to generate rent estimate',
        score: 3,
        confidence: 'low',
        reasoning: 'Estimate unavailable – defaulting to at-market.',
        estimated_market_range_low: null,
        estimated_market_range_high: null,
      },
      { status: 200 }
    );
  }
}
