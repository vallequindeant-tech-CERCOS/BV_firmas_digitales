const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const credsPath = path.join(__dirname, '../../subtle-reserve-475818-c5-fb574d7968c2.json');
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));

const envs = {
    IOFE_API_URL: 'https://api.iofesign.com',
    GOOGLE_SPREADSHEET_NAME: 'iofe_documentos',
    GOOGLE_SHEET_NAME: 'Documentos',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: creds.client_email,
    GOOGLE_PRIVATE_KEY: creds.private_key
};

// We iterate targets: production, preview, development
const targets = ['production', 'preview', 'development'];

console.log('Adding environment variables...');

for (const [key, value] of Object.entries(envs)) {
    for (const target of targets) {
        console.log(`Setting ${key} (${target})...`);
        try {
            // Check if exists first? No, just add. It might error if duplicate. 
            // If error, we ignore.
            // Using npx -y vercel ...
            execSync(`npx -y vercel env add ${key} ${target}`, {
                input: value,
                stdio: ['pipe', 'inherit', 'inherit'],
                cwd: path.join(__dirname, '..') // Run from webapp root
            });
        } catch (e) {
            console.log(`Failed (maybe exists?): ${e.message}`);
        }
    }
}
console.log('Done.');
