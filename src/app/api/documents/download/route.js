import { NextResponse } from 'next/server';
import { getDownloadLink } from '@/lib/iofe';
import { batchLookup } from '@/lib/sheets';

export async function POST(request) {
    try {
        const { subjects } = await request.json(); // subjects: ["doc1", "doc2"]
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        if (!subjects || !Array.isArray(subjects)) {
            return NextResponse.json({ error: 'Subjects array required' }, { status: 400 });
        }

        // 1. Lookup IOFE IDs
        const lookupMap = await batchLookup(subjects);

        // Workflows mapping to folder names (Hardcoded based on Python script)
        // NOTE: In a real DB this would be dynamic, here we just use what we have
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
            documents: []
        };

        for (const subject of subjects) {
            const record = lookupMap[subject];
            if (!record || !record.IOFE_ID) {
                results.errors++;
                continue; // Skip not found
            }

            try {
                const url = await getDownloadLink(token, record.IOFE_ID);
                if (url) {
                    const workflowId = parseInt(record.workflowId);
                    const folderName = WORKFLOW_NAMES[workflowId] || "OTROS";

                    results.documents.push({
                        subject,
                        url,
                        folder: folderName,
                        filename: `${subject}-signed.pdf`
                    });
                    results.success++;
                } else {
                    results.errors++;
                }
            } catch (e) {
                console.error(`Error fetching link for ${subject}:`, e);
                results.errors++;
            }
        }

        return NextResponse.json(results);

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
