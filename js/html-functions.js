import { HTML_FUNCTIONS } from './config.js';

export async function loadHtmlFunctions() {
    const app = document.getElementById('app');
    if (!app) throw new Error('Missing app root.');

    const htmlParts = await Promise.all(HTML_FUNCTIONS.map(async (functionPath) => {
        const response = await fetch(functionPath);
        if (!response.ok) throw new Error(`Failed to load ${functionPath}`);
        return response.text();
    }));

    app.innerHTML = htmlParts.join('\n');
}
