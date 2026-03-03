import { NextResponse } from 'next/server';
import { uploadDocument } from '@/lib/iofe';
import { appendRecord } from '@/lib/sheets';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const workflowId = formData.get('workflowId');
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({
                error: 'No se proporcionó token de autenticación. Inicie sesión de nuevo.'
            }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        if (!file || !workflowId) {
            return NextResponse.json({
                error: 'Se requiere un archivo PDF y un flujo de trabajo.'
            }, { status: 400 });
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({
                error: `El archivo '${file.name}' no es un PDF válido.`
            }, { status: 400 });
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 1. Upload to IOFE (same as Python: subir_documento_iofe)
        const iofeData = await uploadDocument(token, parseInt(workflowId), buffer, file.name);

        if (!iofeData) {
            throw new Error("No se recibió respuesta de IOFE al subir el documento.");
        }

        // 2. Register in Google Sheets (same as Python: append_record_gsheet)
        let sheetOk = false;
        let sheetMessage = '';
        try {
            await appendRecord(iofeData, workflowId);
            sheetOk = true;
            sheetMessage = 'Registro añadido a Google Sheets.';
        } catch (sheetError) {
            console.error("Sheet Error:", sheetError);
            sheetMessage = `Error al registrar en Google Sheets: ${sheetError.message}`;
        }

        return NextResponse.json({
            success: true,
            message: `Documento '${file.name}' cargado a IOFE.`,
            data: iofeData,
            sheet: { ok: sheetOk, message: sheetMessage }
        });

    } catch (error) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
