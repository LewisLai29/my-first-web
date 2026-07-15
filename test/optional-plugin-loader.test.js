const path = require('path');
const { pathToFileURL } = require('url');

describe('optional plugin loader', () => {
    test('silently skips a plugin whose manifest is missing', async () => {
        const loaderUrl = pathToFileURL(path.resolve(__dirname, '../js/optional-plugin-loader.js')).href;
        const { loadOptionalPlugins } = await import(loaderUrl);
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ plugins: ['missing/plugin.json'] }),
            })
            .mockResolvedValueOnce({ ok: false, status: 404 });

        const plugins = await loadOptionalPlugins(new URL('https://example.test/plugins.json'), {});

        expect(plugins).toEqual([]);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(String(global.fetch.mock.calls[1][0])).toBe('https://example.test/missing/plugin.json');
    });
});
