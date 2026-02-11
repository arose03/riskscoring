import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const { address, universityName } = await req.json();

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

    const prompt = `For the area around "${address}"${universityName ? ` near ${universityName}` : ''}, estimate a crime risk score on a scale of 1-5 for insurance underwriting purposes.

Use your knowledge of:
- Clery Act campus crime data
- Local crime statistics and trends
- Neighborhood safety reputation
- Property crime vs violent crime rates

Score guide:
1 = Very Low (crime index <20) - Safe area, minimal crime history
2 = Low (20-35) - Generally safe neighborhood
3 = Medium (35-50) - Average for student housing area
4 = High (50-70) - Above average crime for the area
5 = Very High (>70) - High crime, significant general liability exposure

Return ONLY valid JSON (no markdown formatting, no code blocks):
{"score": <1-5>, "confidence": "<high|medium|low>", "reasoning": "<2-3 sentence explanation>"}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed = JSON.parse(text.trim());

    return NextResponse.json({
      score: Math.max(1, Math.min(5, Math.round(parsed.score))),
      confidence: parsed.confidence || 'medium',
      reasoning: parsed.reasoning || 'AI estimate based on available data.',
    });
  } catch (err) {
    console.error('Crime estimate error:', err);
    return NextResponse.json(
      { error: 'Failed to generate crime estimate', score: 3, confidence: 'low', reasoning: 'Estimate unavailable – defaulting to medium risk.' },
      { status: 200 }
    );
  }
}
