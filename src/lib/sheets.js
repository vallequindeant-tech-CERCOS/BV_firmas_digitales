import { google } from 'googleapis';

// Configurar autenticación usando variables de entorno
const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
];

function getAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // Handle private key newlines correctly in Vercel/env vars
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

    if (!email || !privateKey) {
        throw new Error("Missing Google Service Account credentials in environment variables");
    }

    return new google.auth.JWT(
        email,
        null,
        privateKey,
        SCOPES
    );
}

export async function getSheet() {
    const auth = getAuth();
    await auth.authorize();

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = await getSpreadsheetId(sheets, process.env.GOOGLE_SPREADSHEET_NAME || 'iofe_documentos');

    return { sheets, spreadsheetId };
}

async function getSpreadsheetId(sheets, name) {
    // Nota: En una app real, lo ideal es usar el ID fijo en env vars GOOGLE_SPREADSHEET_ID
    // Para mantener compatibilidad con la lógica original, buscamos por nombre o usamos un ID fijo si se provee
    if (process.env.GOOGLE_SPREADSHEET_ID) return process.env.GOOGLE_SPREADSHEET_ID;

    // Si no tenemos ID, asumimos que el usuario configurará el ID correcto eventualmente.
    // Por ahora, lanzamos error si no está configurado, ya que buscar por nombre requiere Drive API
    // y es menos eficiente/seguro.
    throw new Error("GOOGLE_SPREADSHEET_ID not defined in environment variables");
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
    const idxSubject = headers.findIndex(h => h.toLowerCase() === 'subject');
    const idxId = headers.findIndex(h => h.toLowerCase() === 'iofe_id');
    const idxWorkflow = headers.findIndex(h => h.toLowerCase() === 'workflowid'); // Adjust check if needed

    if (idxSubject === -1 || idxId === -1) {
        throw new Error("Sheet missing 'Subject' or 'IOFE_ID' columns");
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
