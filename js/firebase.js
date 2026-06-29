import { firebaseConfig } from './firebase-config.js';

const FIREBASE_SDK_URLS = [
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js',
];

let sdkLoadPromise = null;
let servicesPromise = null;
let servicesFirebaseGlobal = null;

function isJsdomRuntime() {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
}

function hasFirebaseGlobal() {
    return typeof window !== 'undefined' && Boolean(window.firebase && window.firebase.initializeApp);
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve(existing);
                return;
            }

            existing.addEventListener('load', () => resolve(existing), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve(script);
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

async function ensureFirebaseSdkLoaded() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    if (hasFirebaseGlobal()) return true;
    if (isJsdomRuntime()) return false;

    if (!sdkLoadPromise) {
        sdkLoadPromise = (async () => {
            for (const src of FIREBASE_SDK_URLS) {
                await loadScript(src);
            }
            return true;
        })();
    }

    return sdkLoadPromise;
}

export async function ensureFirebaseServices() {
    if (servicesPromise && servicesFirebaseGlobal && servicesFirebaseGlobal !== window.firebase) {
        servicesPromise = null;
        servicesFirebaseGlobal = null;
    }

    if (servicesPromise) {
        const existingServices = await servicesPromise;
        if (existingServices && hasFirebaseGlobal()) return existingServices;
        if (!hasFirebaseGlobal()) {
            servicesPromise = null;
            return null;
        }
        servicesPromise = null;
    }

    servicesPromise = (async () => {
        const sdkLoaded = await ensureFirebaseSdkLoaded();
        if (!sdkLoaded || !hasFirebaseGlobal()) return null;

        if (!window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
        }
        servicesFirebaseGlobal = window.firebase;

        return {
            auth: window.firebase.auth(),
            db: window.firebase.firestore(),
        };
    })();

    return servicesPromise;
}
