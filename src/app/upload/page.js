'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import LogPanel from '@/components/LogPanel';

const WORKFLOWS = {
    "DERCO - GLP 2026": 1602,
    "DERCO - GNV 2026": 1601,
    "SUM - GLP": 1605,
    "SUM - GNV": 1604,
    "CERTIFICADO DE CONFORMIDAD GLP": 1550,
    "CERTIFICADO DE CONFORMIDAD GNV": 1407,
    "DERCO - GNV 2025": 1769,
    "DERCO - GLP 2025": 1770,
};

export default function UploadPage() {
    const [files, setFiles] = useState([]);
    const [workflow, setWorkflow] = useState(Object.keys(WORKFLOWS)[0]);
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.pdf')));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return alert('Seleccione archivos PDF');

        setProcessing(true);
        setLogs([]);
        addLog(`🚀 Iniciando carga de ${files.length} archivos para flujo: ${workflow}`);

        const workflowId = WORKFLOWS[workflow];
        const token = localStorage.getItem('iofe_token');
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            addLog(`\nPROCESSING (${i + 1}/${files.length}): ${file.name}...`);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('workflowId', workflowId);

            try {
                const res = await fetch('/api/documents/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const result = await res.json();

                if (res.ok) {
                    addLog(`✅ IOFE: ${result.message}`);
                    // Show Sheet registration status (matching Python output)
                    if (result.sheet) {
                        if (result.sheet.ok) {
                            addLog(`✅ GSheets: ${result.sheet.message}`);
                        } else {
                            addLog(`⚠️ GSheets: ${result.sheet.message}`);
                        }
                    }
                    successCount++;
                } else {
                    addLog(`❌ ERROR: ${result.error}`);
                    errorCount++;
                }
            } catch (err) {
                addLog(`❌ ERROR CRÍTICO: ${err.message}`);
                errorCount++;
            }
        }

        addLog(`\n🏁 PROCESO FINALIZADO. Éxitos: ${successCount}, Errores: ${errorCount}`);
        setProcessing(false);
    };

    return (
        <>
            <Navbar />
            <div className="container">
                <h1 className="header-title">Carga de Documentos</h1>

                <div className="card">
                    <div className="input-group">
                        <label className="label">Flujo de Trabajo</label>
                        <select
                            className="select"
                            value={workflow}
                            onChange={(e) => setWorkflow(e.target.value)}
                            disabled={processing}
                        >
                            {Object.keys(WORKFLOWS).map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label className="label">Seleccionar PDFs</label>
                        <input
                            type="file"
                            multiple
                            accept=".pdf"
                            className="input"
                            onChange={handleFileChange}
                            disabled={processing}
                        />
                        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                            {files.length} archivos seleccionados
                        </p>
                    </div>

                    <button
                        onClick={handleUpload}
                        className="btn btn-primary"
                        disabled={processing || files.length === 0}
                        style={{ width: '100%' }}
                    >
                        {processing ? 'Procesando...' : 'Iniciar Carga'}
                    </button>
                </div>

                <LogPanel logs={logs} />
            </div>
        </>
    );
}
