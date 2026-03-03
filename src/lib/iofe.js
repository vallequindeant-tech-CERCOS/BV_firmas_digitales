
const AMBIENTE = process.env.IOFE_API_URL || "https://api.iofesign.com";

// --- Mapeo oficial de errores IOFE ---
const IOFE_ERROR_MESSAGES = {
    401: "Token no válido, ha expirado o no tiene permisos. Intente cerrar sesión e iniciar sesión de nuevo.",
    403: "El usuario autenticado no tiene acceso a esta empresa o recurso. Verifique sus permisos.",
    404: "No se encontró el recurso especificado en IOFE. Verifique que el documento exista.",
    500: "Error inesperado en el servidor de IOFE. Contacte al administrador del sistema.",
};

/**
 * Interpreta un error de la API de IOFE y devuelve un mensaje descriptivo para el usuario.
 * @param {number} statusCode - HTTP status code
 * @param {string} responseText - Body text de la respuesta
 * @param {string} context - Contexto de la operación (ej: "subir documento", "anular documento")
 * @returns {string} Mensaje de error descriptivo
 */
function parseIofeError(statusCode, responseText, context) {
    const baseMessage = IOFE_ERROR_MESSAGES[statusCode];

    // Intentar extraer mensaje del body JSON
    let serverDetail = '';
    try {
        const json = JSON.parse(responseText);
        serverDetail = json.message || json.error || json.detail || '';
    } catch {
        serverDetail = responseText?.substring(0, 200) || '';
    }

    if (baseMessage) {
        return `Error IOFE al ${context} (${statusCode}): ${baseMessage}${serverDetail ? ` — Detalle: ${serverDetail}` : ''}`;
    }

    return `Error IOFE al ${context} (${statusCode}): ${serverDetail || 'Error desconocido. Contacte soporte.'}`;
}

/**
 * Login to IOFE
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<string>} Bearer token
 */
export async function iofeLogin(username, password) {
    const url = `${AMBIENTE}/login`;
    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (resp.ok) {
            const token = resp.headers.get("Authorization") || "";
            if (!token.trim()) {
                throw new Error("Login exitoso pero no se recibió el token. Contacte al administrador.");
            }
            return token.trim();
        } else {
            const text = await resp.text();
            if (resp.status === 401) {
                throw new Error("Credenciales incorrectas. Verifique su usuario y contraseña.");
            }
            if (resp.status === 403) {
                throw new Error("Su cuenta no tiene permisos para acceder al sistema. Contacte al administrador.");
            }
            throw new Error(parseIofeError(resp.status, text, "iniciar sesión"));
        }
    } catch (error) {
        if (error.cause || error.message.includes('fetch')) {
            throw new Error("No se pudo conectar al servidor de IOFE. Verifique su conexión a internet.");
        }
        throw error;
    }
}

/**
 * Upload a document to IOFE
 * @param {string} token 
 * @param {number} workflowId 
 * @param {Buffer} fileBuffer 
 * @param {string} filename 
 * @returns {Promise<Object>} Response data
 */
export async function uploadDocument(token, workflowId, fileBuffer, filename) {
    const url = `${AMBIENTE}/api/v1/outside/documents`;
    const base64Pdf = fileBuffer.toString('base64');
    const subject = filename.replace(/\.pdf$/i, '');

    const payload = {
        type: 1,
        subject: subject,
        workflowId: workflowId,
        participants: [],
        files: [{ name: filename, base64: base64Pdf }]
    };

    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (resp.ok) {
            const data = await resp.json();
            data.subject = subject;
            return data;
        } else {
            const text = await resp.text();
            throw new Error(parseIofeError(resp.status, text, `subir '${filename}'`));
        }
    } catch (error) {
        if (error.cause || error.message.includes('fetch failed')) {
            throw new Error(`Error de conexión al subir '${filename}'. Verifique su conexión a internet.`);
        }
        throw error;
    }
}

/**
 * Cancel a document in IOFE
 * @param {string} token 
 * @param {number} documentId 
 * @param {string} reason 
 * @returns {Promise<boolean>} Success status
 */
export async function cancelDocument(token, documentId, reason) {
    const encodedReason = encodeURIComponent(reason);
    const url = `${AMBIENTE}/api/v1/outside/documents/${documentId}/cancel?comment=${encodedReason}`;

    try {
        const resp = await fetch(url, {
            method: "PUT",
            headers: { "Authorization": token }
        });

        if (resp.ok) {
            return true;
        } else {
            const text = await resp.text();
            throw new Error(parseIofeError(resp.status, text, `anular documento ID ${documentId}`));
        }
    } catch (error) {
        if (error.cause || error.message.includes('fetch failed')) {
            throw new Error(`Error de conexión al anular documento ID ${documentId}. Verifique su conexión a internet.`);
        }
        throw error;
    }
}

/**
 * Get download link for a document
 * @param {string} token 
 * @param {number} documentId 
 * @returns {Promise<string>} Download URL
 */
export async function getDownloadLink(token, documentId) {
    const url = `${AMBIENTE}/api/v1/outside/documents/${documentId}`;

    try {
        const resp = await fetch(url, {
            method: "GET",
            headers: { "Authorization": token }
        });

        if (resp.ok) {
            const data = await resp.json();
            const streamUrl = data._links?.stream?.href;
            if (!streamUrl) {
                throw new Error(`El documento ID ${documentId} no tiene link de descarga disponible. Es posible que aún no haya sido firmado.`);
            }
            return streamUrl;
        } else {
            const text = await resp.text();
            throw new Error(parseIofeError(resp.status, text, `obtener link de descarga del documento ID ${documentId}`));
        }
    } catch (error) {
        if (error.cause || error.message.includes('fetch failed')) {
            throw new Error(`Error de conexión al consultar documento ID ${documentId}. Verifique su conexión a internet.`);
        }
        throw error;
    }
}
