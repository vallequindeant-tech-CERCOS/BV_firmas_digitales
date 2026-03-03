'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import Navbar from '@/components/Navbar';
import LogPanel from '@/components/LogPanel';

export default function DownloadPage() {
    const [logs, setLogs] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [subjectsToDownload, setSubjectsToDownload] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        addLog(`Leyendo archivo: ${file.name}...`);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                let colIndex = 0;
                const headerRow = data[0];
                const subjectIdx = headerRow.findIndex(c => String(c).toLowerCase().trim() === 'subject');
                if (subjectIdx !== -1) colIndex = subjectIdx;

                const subjects = [];
                const startRow = (subjectIdx !== -1) ? 1 : 0;

                for (let i = startRow; i < data.length; i++) {
                    const cell = data[i][colIndex];
                    if (cell) subjects.push(String(cell).trim());
                }

                if (subjects.length === 0) {
                    addLog("⚠️ No se encontraron subjects válidos en el Excel.");
                    setSubjectsToDownload([]);
                } else {
                    addLog(`✅ Se encontraron ${subjects.length} documentos para descargar.`);
                    setSubjectsToDownload(subjects);
                }

            } catch (err) {
                addLog(`❌ Error leyendo Excel: ${err.message}`);
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadFile = async (url, filename) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return true;
        } catch (e) {
            return false;
        }
    };

    const handleDownload = async () => {
        if (subjectsToDownload.length === 0) return;

        setProcessing(true);
        setLogs([]);
        addLog(`🚀 Buscando links de descarga para ${subjectsToDownload.length} documentos...`);

        try {
            const token = localStorage.getItem('iofe_token');
            if (!token) {
                addLog('❌ No hay token de sesión. Inicie sesión de nuevo.');
                setProcessing(false);
                return;
            }

            const res = await fetch('/api/documents/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ subjects: subjectsToDownload })
            });

            const result = await res.json();

            if (res.ok) {
                // Show per-document results
                if (result.details) {
                    for (const det of result.details) {
                        if (det.status === 'success') {
                            addLog(`✅ ${det.subject}: Link obtenido`);
                        } else {
                            addLog(`❌ ${det.subject}: ${det.message}`);
                        }
                    }
                }

                addLog(`\n📊 Resumen: ${result.success} encontrados, ${result.errors} errores`);

                if (result.documents && result.documents.length > 0) {
                    addLog("\n⬇️ Iniciando descargas en el navegador...");

                    let success = 0;
                    for (const doc of result.documents) {
                        addLog(`Descargando: ${doc.filename}...`);
                        await new Promise(r => setTimeout(r, 500));

                        const ok = await downloadFile(doc.url, doc.filename);
                        if (ok) {
                            addLog(`✅ Descargado: ${doc.filename}`);
                            success++;
                        } else {
                            addLog(`❌ Falló la descarga de: ${doc.filename}`);
                        }
                    }

                    addLog(`\n🏁 FINALIZADO. Descargados: ${success} de ${result.documents.length}`);
                } else {
                    addLog('\n⚠️ No se encontraron documentos para descargar.');
                }

            } else {
                addLog(`❌ ${result.error}`);
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
                <h1 className="header-title">Descarga de Documentos</h1>

                <div className="card">
                    <div className="input-group">
                        <label className="label">Archivo Excel</label>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="input"
                            onChange={handleFileChange}
                            disabled={processing}
                        />
                    </div>

                    <button
                        onClick={handleDownload}
                        className="btn btn-primary"
                        disabled={processing || subjectsToDownload.length === 0}
                        style={{ width: '100%' }}
                    >
                        {processing ? 'Procesando...' : 'Buscar y Descargar'}
                    </button>
                </div>

                <LogPanel logs={logs} />
            </div>
        </>
    );
}
