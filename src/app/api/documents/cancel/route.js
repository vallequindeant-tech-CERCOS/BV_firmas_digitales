import { NextResponse } from 'next/server';
import { cancelDocument } from '@/lib/iofe';
import { batchLookup, updateStatus } from '@/lib/sheets';

export async function POST(request) {
    try {
        const { items } = await request.json(); // items: [{ subject, reason }]
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Items array required' }, { status: 400 });
        }

        // 1. Batch lookup in Sheets to get IDs
        const subjects = items.map(i => i.subject);
        const lookupMap = await batchLookup(subjects);

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
                results.details.push({ subject, status: 'error', message: 'Not found in Sheets' });
                continue;
            }

            try {
                // Cancel in IOFE
                await cancelDocument(token, record.IOFE_ID, reason);

                // Update Sheets
                await updateStatus(record.rowIndex, "Anulado");

                results.success++;
                results.details.push({ subject, status: 'success' });
            } catch (e) {
                results.errors++;
                results.details.push({ subject, status: 'error', message: e.message });
            }
        }

        return NextResponse.json(results);

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
