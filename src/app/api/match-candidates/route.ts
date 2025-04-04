import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Sheets client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

interface JobSeeker {
  name: string;
  education: string;
  experience: string;
  location: string;
  skills: string;
}

async function calculateMatchScore(jobSeeker: JobSeeker, requirements: string, jobTitle: string): Promise<number> {
  try {
    const prompt = `
      You are an expert HR professional. Analyze the candidate's profile and job requirements, then provide a match score from 0-100.
      
      Job Title: ${jobTitle}
      Job Requirements: ${requirements}
      
      Candidate Profile:
      - Education: ${jobSeeker.education}
      - Experience: ${jobSeeker.experience}
      - Skills: ${jobSeeker.skills}
      
      Consider the following factors:
      1. Relevance of experience to job title
      2. Skills matching with requirements
      3. Education relevance
      4. Overall suitability
      
      Provide only a number between 0 and 100 as the response, representing the match percentage.
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      max_tokens: 5,
    });

    const score = parseInt(completion.choices[0]?.message?.content || "0");
    return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 100);
  } catch (error) {
    console.error('Error calculating match score:', error);
    return 0;
  }
}

export async function POST(request: Request) {
  try {
    const { requirements, jobTitle } = await request.json();

    if (!SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured');
    }

    // Get all job seeker data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'JobSeekers!A1:E',
    });

    const rows = response.data.values || [];
    const jobSeekers: JobSeeker[] = rows.map(row => ({
      name: row[1] || '',
      education: row[2] || '',
      experience: row[3] || '',
      location: row[4] || '',
      skills: row[5] || '',
    }));

    // Calculate match scores for each job seeker using GPT
    const scoredCandidates = await Promise.all(
      jobSeekers.map(async (seeker) => ({
        name: seeker.name,
        education: seeker.education,
        experience: seeker.experience,
        matchScore: await calculateMatchScore(seeker, requirements, jobTitle),
      }))
    );

    // Filter and sort candidates
    const topCandidates = scoredCandidates
      .filter(candidate => candidate.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    return NextResponse.json({ candidates: topCandidates });

  } catch (error) {
    console.error('Match candidates error:', error);
    return NextResponse.json(
      { error: 'Failed to find matching candidates' },
      { status: 500 }
    );
  }
} 