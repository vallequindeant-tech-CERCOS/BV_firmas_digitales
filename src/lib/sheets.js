import { google } from 'googleapis';

// Configurar autenticación usando variables de entorno
const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
];

function getAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // Next.js dotenv expands \n in double-quoted values to real newlines automatically.
    // But if running in Vercel or other envs where \n is literal, we handle both cases.
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!email || !privateKey) {
        throw new Error("Missing Google Service Account credentials in environment variables");
    }

    return new google.auth.JWT({
        email: email,
        key: privateKey,
        scopes: SCOPES,
    });
}

export async function getSheet() {
    const auth = getAuth();
    await auth.authorize();

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = await getSpreadsheetId(sheets, process.env.GOOGLE_SPREADSHEET_NAME || 'iofe_documentos');

    return { sheets, spreadsheetId };
}

async function getSpreadsheetId(sheetsClient, name) {
    // Si tenemos el ID fijo en env vars, usarlo directamente
    if (process.env.GOOGLE_SPREADSHEET_ID) return process.env.GOOGLE_SPREADSHEET_ID;

    // Fallback: buscar por nombre usando Google Drive API (igual que gspread.open(name) en Python)
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
        q: `name='${name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (!res.data.files || res.data.files.length === 0) {
        throw new Error(`Spreadsheet '${name}' not found in Google Drive. Set GOOGLE_SPREADSHEET_ID in env vars or share the spreadsheet with the service account.`);
    }

    return res.data.files[0].id;
}

/**
 * Append a row to the sheet
 */
export async function appendRecord(ioData, workflowId) {
    const { sheets, spreadsheetId } = await getSheet();
    const range = `${process.env.GOOGLE_SHEET_NAME || 'Documentos'}!A:G`;

    // Format matching the Python script
    // subject, id, fecha, hash, link, workflow_id, status
    const row = [
        ioData.subject || 'N/A',
        String(ioData.id || 'N/A'),
        new Date().toISOString(),
        ioData.hashIdentifier || "",
        ioData._links?.stream?.href || "",
        String(workflowId),
        "Activo"
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [row]
        }
    });
}

/**
 * Batch lookup subjects
 */
export async function batchLookup(subjects) {
    const { sheets, spreadsheetId } = await getSheet();
    const range = `${process.env.GOOGLE_SHEET_NAME || 'Documentos'}!A:Z`; // Leer todo

    const result = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range
    });

    const rows = result.data.values;
    if (!rows || rows.length === 0) return {};

    const headers = rows[0].map(h => h.trim());
    // Match exact column names as used by the Python script
    const idxSubject = headers.findIndex(h => h === 'Subject');
    const idxId = headers.findIndex(h => h === 'IOFE_ID');
    const idxWorkflow = headers.findIndex(h => h === 'workFlowID');

    if (idxSubject === -1 || idxId === -1) {
        throw new Error(`Sheet missing 'Subject' or 'IOFE_ID' columns. Found headers: ${headers.join(', ')}`);
    }

    const index = {};
    // Start from row 1 (skipping header)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[idxSubject]) {
            const subject = row[idxSubject].trim();
            if (subjects.includes(subject)) {
                index[subject] = {
                    IOFE_ID: row[idxId],
                    workflowId: idxWorkflow !== -1 ? row[idxWorkflow] : null,
                    rowIndex: i + 1 // 1-based index for updates
                };
            }
        }
    }
    return index;
}

/**
 * Update status of a document
 */
export async function updateStatus(rowIndex, newStatus) {
    const { sheets, spreadsheetId } = await getSheet();
    // Asumimos columna G (7) para Status, como en el script original
    // Si rowIndex es 5, queremos editar G5
    const range = `${process.env.GOOGLE_SHEET_NAME || 'Documentos'}!G${rowIndex}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
            values: [[newStatus]]
        }
    });
}
