import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const { address, universityName, actualRent } = await req.json();

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

    const prompt = `For student housing near ${universityName || 'a university'} at "${address}", estimate the average market rent per bedroom per month.

Consider:
- Local student housing market rates
- Proximity to campus
- Type of area (urban, suburban, college town)
- Current market conditions

Return ONLY valid JSON (no markdown formatting, no code blocks):
{"estimated_market_rent": <number in USD per bedroom per month>, "confidence": "<high|medium|low>", "reasoning": "<2-3 sentence explanation>", "sources": ["<source description>"]}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = JSON.parse(text.trim());

    const marketRent = parsed.estimated_market_rent;
    let score = 3; // default

    if (actualRent && marketRent) {
      const ratio = parseFloat(actualRent) / marketRent;
      if (ratio > 1.20) score = 1;
      else if (ratio >= 1.10) score = 2;
      else if (ratio >= 1.00) score = 3;
      else if (ratio >= 0.90) score = 4;
      else score = 5;
    }

    return NextResponse.json({
      score,
      estimated_market_rent: marketRent,
      confidence: parsed.confidence || 'medium',
      reasoning: parsed.reasoning || 'AI estimate based on available data.',
      sources: parsed.sources || [],
    });
  } catch (err) {
    console.error('Rent estimate error:', err);
    return NextResponse.json(
      { error: 'Failed to generate rent estimate', score: 3, confidence: 'low', reasoning: 'Estimate unavailable – defaulting to at-market.', estimated_market_rent: null },
      { status: 200 }
    );
  }
}
