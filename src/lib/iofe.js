import Link from 'next/link';

const AMBIENTE = process.env.IOFE_API_URL || "https://api.iofesign.com";

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
            // Node.js doesn't enforce SSL verification deeply by default like requests, 
            // but in production Vercel environment SSL should be valid.
            // If needed for self-signed certs in dev: agent: new https.Agent({ rejectUnauthorized: false })
        });

        if (resp.ok) {
            const token = resp.headers.get("Authorization") || "";
            return token.trim();
        } else {
            throw new Error(`Login failed (${resp.status}): ${await resp.text()}`);
        }
    } catch (error) {
        throw new Error(`Connection error: ${error.message}`);
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
            throw new Error(`Upload failed (${resp.status}): ${await resp.text()}`);
        }
    } catch (error) {
        throw new Error(`Upload error for ${filename}: ${error.message}`);
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
            throw new Error(`Cancel failed (${resp.status}): ${await resp.text()}`);
        }
    } catch (error) {
        throw new Error(`Cancel error for ID ${documentId}: ${error.message}`);
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
            return data._links?.stream?.href || null;
        } else {
            throw new Error(`Get info failed (${resp.status}): ${await resp.text()}`);
        }
    } catch (error) {
        throw new Error(`Network error for ID ${documentId}: ${error.message}`);
    }
}
