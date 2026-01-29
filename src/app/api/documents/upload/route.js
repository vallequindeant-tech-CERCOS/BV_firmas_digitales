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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        if (!file || !workflowId) {
            return NextResponse.json({ error: 'File and workflowId required' }, { status: 400 });
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 1. Upload to IOFE
        const iofeData = await uploadDocument(token, parseInt(workflowId), buffer, file.name);

        if (!iofeData) {
            throw new Error("Failed to get response from IOFE");
        }

        // 2. Log to Google Sheets
        // Note: We don't fail the request if Sheets fails, just warn
        try {
            await appendRecord(iofeData, workflowId);
        } catch (sheetError) {
            console.error("Sheet Error:", sheetError);
            // Return success but with a warning note could be an option, but for now just log it
        }

        return NextResponse.json({
            success: true,
            message: `Uploaded ${file.name}`,
            data: iofeData
        });

    } catch (error) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
