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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { field, originalText, translatedText, formattedText, timestamp } = body;

    if (!SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured');
    }

    // Prepare the row data
    const values = [
      [
        timestamp,
        field,
        originalText,
        translatedText,
        formattedText,
      ]
    ];

    // Append the data to the sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:E', // Adjust the sheet name and range as needed
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