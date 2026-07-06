export async function fetchHtmlParts(partialPaths) {
    return Promise.all(partialPaths.map(async (partialPath) => {
        const response = await fetch(partialPath, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load ${partialPath}`);
        return response.text();
    }));
}

export async function fetchHtmlPartial(partialPath, errorMessage = `Failed to load ${partialPath}`) {
    const response = await fetch(partialPath, { cache: 'no-store' });
    if (!response.ok) throw new Error(errorMessage);
    return response.text();
}
