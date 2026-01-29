'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import Navbar from '@/components/Navbar';
import LogPanel from '@/components/LogPanel';

export default function CancelPage() {
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [itemsToCancel, setItemsToCancel] = useState([]);
    const [fileName, setFileName] = useState('');

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        addLog(`Leyendo archivo: ${file.name}...`);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Validate columns
                const validItems = [];
                data.forEach((row, i) => {
                    if (row.subject && row.motivo) {
                        validItems.push({
                            subject: String(row.subject).trim(),
                            reason: String(row.motivo).trim()
                        });
                    }
                });

                if (validItems.length === 0) {
                    addLog("⚠️ No se encontraron filas válidas con columnas 'subject' y 'motivo'.");
                    setItemsToCancel([]);
                } else {
                    addLog(`✅ Se encontraron ${validItems.length} registros para anular.`);
                    setItemsToCancel(validItems);
                }

            } catch (err) {
                addLog(`❌ Error leyendo Excel: ${err.message}`);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleCancel = async () => {
        if (itemsToCancel.length === 0) return;

        setProcessing(true);
        setLogs([]); // Clear previous logs
        addLog(`🚀 Iniciando anulación masiva de ${itemsToCancel.length} documentos...`);

        // Process in chunks to avoid timeouts? Or just one big batch? 
        // API route handles batching logic, but let's send all at once for now.

        try {
            const token = localStorage.getItem('iofe_token');
            const res = await fetch('/api/documents/cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: itemsToCancel })
            });

            const result = await res.json();

            if (res.ok) {
                result.details.forEach(det => {
                    if (det.status === 'success') {
                        addLog(`✅ ${det.subject}: Anulado correctamente`);
                    } else {
                        addLog(`❌ ${det.subject}: Error - ${det.message}`);
                    }
                });
                addLog(`\n🏁 FINALIZADO. Éxitos: ${result.success}, Errores: ${result.errors}`);
            } else {
                addLog(`❌ Error API: ${result.error}`);
            }

        } catch (err) {
            addLog(`❌ Error de conexión: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="container">
                <h1 className="header-title">Anulación de Firmas</h1>

                <div className="card">
                    <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                        Sube un archivo Excel con las columnas <strong>subject</strong> y <strong>motivo</strong>.
                    </p>

                    <div className="input-group">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="input"
                            onChange={handleFileChange}
                            disabled={processing}
                        />
                    </div>

                    <button
                        onClick={handleCancel}
                        className="btn btn-primary"
                        disabled={processing || itemsToCancel.length === 0}
                        style={{ width: '100%' }}
                    >
                        {processing ? 'Procesando...' : 'Iniciar Anulación'}
                    </button>
                </div>

                <LogPanel logs={logs} />
            </div>
        </>
    );
}
