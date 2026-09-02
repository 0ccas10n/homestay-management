import { jsonSuccess } from '@/lib/api/response';

export async function GET(request: Request) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const spreadsheetId = process.env.SPREADSHEET_ID?.trim() || process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  
  let keyStatus = 'missing';
  if (key) {
    if (key.startsWith('"') && key.endsWith('"')) {
      keyStatus = 'present_but_quoted';
      key = key.slice(1, -1);
    } else {
      keyStatus = 'present';
    }
    
    if (key.includes('\\n')) {
      keyStatus += ' (contains escaped newlines)';
    } else if (key.includes('\n')) {
      keyStatus += ' (contains actual newlines)';
    }
  }

  return jsonSuccess({
    status: 'ok',
    env: process.env.NODE_ENV,
    creds: {
      hasEmail: !!email,
      hasKey: !!key,
      keyStatus,
      hasSpreadsheetId: !!spreadsheetId,
      spreadsheetIdLength: spreadsheetId?.length || 0,
      emailPrefix: email ? email.split('@')[0] : null,
    }
  });
}
