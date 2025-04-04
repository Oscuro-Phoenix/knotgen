import { google } from 'googleapis';
import { NextResponse } from 'next/server';

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

// Define field names for each form type
const jobSeekerFields = ['timestamp', 'name', 'education', 'age', 'location', 'pastJobs'];
const employerFields = ['timestamp', 'companyName', 'jobTitle', 'requirements', 'experience', 'location'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { formType, ...formData } = body;

    if (!SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured');
    }

    // Select the appropriate sheet and fields based on form type
    const sheetConfig = formType === 'jobseeker' 
      ? { range: 'JobSeekers!A:F', fields: jobSeekerFields }
      : { range: 'Employers!A:F', fields: employerFields };

    // Prepare the row data
    const values = [
      sheetConfig.fields.map(field => {
        if (field === 'timestamp') {
          return new Date().toISOString();
        }
        return formData[field] || '';
      })
    ];

    // Append the data to the appropriate sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetConfig.range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ 
      success: true, 
      updatedRows: response.data.updates?.updatedRows 
    });

  } catch (error) {
    console.error('Sheets API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update spreadsheet' },
      { status: 500 }
    );
  }
} 