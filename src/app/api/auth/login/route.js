import { NextResponse } from 'next/server';
import { iofeLogin } from '@/lib/iofe';

export async function POST(request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        const token = await iofeLogin(username, password);
        return NextResponse.json({ token, message: 'Login successful' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
    }
}
