'use client';
import { useEffect, useRef } from 'react';

export default function LogPanel({ logs }) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="log-panel">
            {logs.length === 0 && <span style={{ color: '#64748b' }}>Esperando inicio del proceso...</span>}
            {logs.map((log, i) => (
                <div key={i}>
                    <span className="log-prefix">{new Date().toLocaleTimeString()}</span>
                    {log}
                </div>
            ))}
            <div ref={endRef} />
        </div>
    );
}
