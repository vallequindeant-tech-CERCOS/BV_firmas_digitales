import { NextResponse } from 'next/server';
import { cancelDocument } from '@/lib/iofe';
import { batchLookup, updateStatus } from '@/lib/sheets';

export async function POST(request) {
    try {
        const { items } = await request.json();
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'No se proporcionó token de autenticación. Inicie sesión de nuevo.' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Se requiere un array de items con subject y motivo.' }, { status: 400 });
        }

        // 1. Batch lookup in Sheets to get IDs
        const subjects = items.map(i => i.subject);
        let lookupMap;
        try {
            lookupMap = await batchLookup(subjects);
        } catch (sheetError) {
            return NextResponse.json({
                error: `Error al consultar Google Sheets: ${sheetError.message}`
            }, { status: 500 });
        }

        const results = {
            success: 0,
            errors: 0,
            details: []
        };

        // 2. Process each item
        for (const item of items) {
            const { subject, reason } = item;
            const record = lookupMap[subject];

            if (!record || !record.IOFE_ID) {
                results.errors++;
                results.details.push({
                    subject,
                    status: 'error',
                    message: `No se encontró '${subject}' en Google Sheets. Verifique que el documento exista.`
                });
                continue;
            }

            try {
                // Cancel in IOFE
                await cancelDocument(token, record.IOFE_ID, reason);

                // Update Sheets
                try {
                    await updateStatus(record.rowIndex, "Anulado");
                } catch (sheetError) {
                    // IOFE cancelation succeeded but Sheet update failed
                    results.success++;
                    results.details.push({
                        subject,
                        status: 'warning',
                        message: `Anulado en IOFE ✅ pero error al actualizar Google Sheets: ${sheetError.message}`
                    });
                    continue;
                }

                results.success++;
                results.details.push({ subject, status: 'success' });
            } catch (e) {
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
        console.error("Cancel Route Error:", error);
        return NextResponse.json({ error: `Error interno del servidor: ${error.message}` }, { status: 500 });
    }
}
