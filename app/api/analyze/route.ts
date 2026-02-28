import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { extractText } from '@/lib/extractText';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AnalysisResult {
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
}

async function analyzeCV(jd: string, cvText: string): Promise<AnalysisResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an expert HR recruiter. Carefully analyze the following CV against the job description and provide an objective assessment.

JOB DESCRIPTION:
${jd}

---

CANDIDATE CV:
${cvText}

---

Respond ONLY with valid JSON (no markdown, no explanation) using this exact structure:
{
  "score": <integer 0-100 representing overall match percentage>,
  "strengths": [<up to 4 specific matching strengths as short strings>],
  "gaps": [<up to 4 specific missing skills or requirements as short strings>],
  "summary": "<one concise sentence summarising the candidate's fit>"
}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as AnalysisResult;
    return {
      score: Math.min(100, Math.max(0, Math.round(parsed.score))),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : [],
      summary: parsed.summary ?? '',
    };
  } catch {
    throw new Error('Claude returned an unexpected response format.');
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
  }

  let jd = (formData.get('jd') as string | null)?.trim() ?? '';

  const jdFile = formData.get('jdFile') as File | null;
  if (jdFile) {
    try {
      const buffer = Buffer.from(await jdFile.arrayBuffer());
      jd = await extractText(buffer, jdFile.name);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: `Could not extract text from JD file: ${err instanceof Error ? err.message : 'Unknown error'}` },
        { status: 400 }
      );
    }
  }

  if (!jd) {
    return NextResponse.json({ error: 'Job description is required.' }, { status: 400 });
  }

  const files = formData.getAll('cvs') as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: 'At least one CV file is required.' }, { status: 400 });
  }

  // Process CVs concurrently
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const cvText = await extractText(buffer, file.name);

        if (!cvText || cvText.length < 50) {
          return {
            filename: file.name,
            score: 0,
            strengths: [],
            gaps: [],
            summary: '',
            error: 'Could not extract readable text from this file. Ensure it is not a scanned image.',
          };
        }

        const analysis = await analyzeCV(jd, cvText);
        return { filename: file.name, ...analysis };
      } catch (err: unknown) {
        return {
          filename: file.name,
          score: 0,
          strengths: [],
          gaps: [],
          summary: '',
          error: err instanceof Error ? err.message : 'Failed to process this file.',
        };
      }
    })
  );

  // Sort by score descending (errors go to bottom)
  results.sort((a, b) => (b.error ? -1 : a.error ? 1 : b.score - a.score));

  return NextResponse.json({ results });
}
