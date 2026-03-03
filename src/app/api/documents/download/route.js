import { NextResponse } from 'next/server';
import { getDownloadLink } from '@/lib/iofe';
import { batchLookup } from '@/lib/sheets';

export async function POST(request) {
    try {
        const { subjects } = await request.json();
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'No se proporcionó token de autenticación. Inicie sesión de nuevo.' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        if (!subjects || !Array.isArray(subjects)) {
            return NextResponse.json({ error: 'Se requiere un array de subjects.' }, { status: 400 });
        }

        // 1. Lookup IOFE IDs from Google Sheets
        let lookupMap;
        try {
            lookupMap = await batchLookup(subjects);
        } catch (sheetError) {
            return NextResponse.json({
                error: `Error al consultar Google Sheets: ${sheetError.message}`
            }, { status: 500 });
        }

        const WORKFLOW_NAMES = {
            1602: "DERCO - GLP 2026",
            1601: "DERCO - GNV 2026",
            1605: "SUM - GLP",
            1604: "SUM - GNV",
            1550: "CERTIFICADO DE CONFORMIDAD GLP",
            1407: "CERTIFICADO DE CONFORMIDAD GNV",
            1769: "DERCO - GNV 2025",
            1770: "DERCO - GLP 2025",
        };

        const results = {
            success: 0,
            errors: 0,
            documents: [],
            details: []
        };

        for (const subject of subjects) {
            const record = lookupMap[subject];
            if (!record || !record.IOFE_ID) {
                results.errors++;
                results.details.push({
                    subject,
                    status: 'error',
                    message: `No se encontró '${subject}' en Google Sheets. Verifique que el documento haya sido cargado previamente.`
                });
                continue;
            }

            try {
                const url = await getDownloadLink(token, record.IOFE_ID);
                const workflowId = parseInt(record.workflowId);
                const folderName = WORKFLOW_NAMES[workflowId] || "OTROS";

                results.documents.push({
                    subject,
                    url,
                    folder: folderName,
                    filename: `${subject}-signed.pdf`
                });
                results.success++;
                results.details.push({ subject, status: 'success' });
            } catch (e) {
                console.error(`Error fetching link for ${subject}:`, e.message);
                results.errors++;
                results.details.push({
                    subject,
                    status: 'error',
                    message: e.message
                });
            }
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error("Download Route Error:", error);
        return NextResponse.json({ error: `Error interno del servidor: ${error.message}` }, { status: 500 });
    }
}
