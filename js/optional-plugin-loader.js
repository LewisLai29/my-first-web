export async function loadOptionalPlugin(manifestUrl, context) {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) return null;

    const manifest = await response.json();
    if (!manifest || typeof manifest.entry !== 'string') return null;

    const baseUrl = new URL('.', manifestUrl);
    const entryUrl = new URL(manifest.entry, baseUrl);
    const pluginModule = await import(entryUrl.href);
    if (typeof pluginModule.activate !== 'function') return null;

    const styleLinks = (Array.isArray(manifest.styles) ? manifest.styles : []).map((stylePath) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL(stylePath, baseUrl).href;
        link.dataset.optionalPlugin = String(manifest.name || entryUrl.href);
        document.head.appendChild(link);
        return link;
    });

    try {
        const activation = await pluginModule.activate(context);
        return {
            name: String(manifest.name || entryUrl.href),
            dispose: () => {
                activation?.dispose?.();
                styleLinks.forEach((link) => link.remove());
            },
        };
    } catch (error) {
        styleLinks.forEach((link) => link.remove());
        throw error;
    }
}

export async function loadOptionalPlugins(registryUrl, context) {
    try {
        const response = await fetch(registryUrl, { cache: 'no-store' });
        if (!response.ok) return [];
        const registry = await response.json();
        const pluginPaths = Array.isArray(registry?.plugins) ? registry.plugins : [];
        const results = await Promise.all(pluginPaths.map(async (pluginPath) => {
            if (typeof pluginPath !== 'string') return null;
            try {
                return await loadOptionalPlugin(new URL(pluginPath, registryUrl), context);
            } catch (error) {
                console.warn(`Optional plugin could not be loaded: ${pluginPath}`, error);
                return null;
            }
        }));
        return results.filter(Boolean);
    } catch (error) {
        console.warn('Optional plugin registry could not be loaded.', error);
        return [];
    }
}
