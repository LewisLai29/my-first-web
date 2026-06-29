import { ensureFirebaseServices } from './firebase.js';

function getElement(id) {
    return document.getElementById(id);
}

function getAuthErrorMessage(error) {
    switch (error?.code) {
        case 'auth/popup-closed-by-user':
            return 'Sign-in cancelled.';
        case 'auth/popup-blocked':
            return 'Popup blocked by browser.';
        case 'auth/redirect-cancelled-by-user':
            return 'Sign-in cancelled.';
        case 'auth/redirect-operation-pending':
            return 'Another sign-in is already in progress.';
        case 'auth/operation-not-supported-in-this-environment':
            return 'Sign-in is not supported in this browser.';
        case 'auth/unauthorized-domain':
            return 'This domain is not authorized for sign-in.';
        case 'auth/web-storage-unsupported':
            return 'This browser blocks required storage.';
        case 'auth/network-request-failed':
            return 'Network request failed.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/wrong-password':
            return 'Wrong password.';
        case 'auth/email-already-in-use':
            return 'Email already in use.';
        case 'auth/weak-password':
            return 'Password is too weak.';
        default:
            return 'Sign-in failed.';
    }
}

function getAuthErrorDetails(error) {
    if (!error) return null;

    const details = {
        code: error.code || 'unknown',
        message: error.message || '',
        name: error.name || '',
    };

    if (error.stack) {
        details.stack = error.stack;
    }

    if (error.customData) {
        details.customData = error.customData;
    }

    if (error.email) {
        details.email = error.email;
    }

    if (error.credential) {
        details.credential = error.credential;
    }

    return details;
}

function logAuthError(context, error) {
    const details = getAuthErrorDetails(error) || error;
    console.error(`[auth] ${context}`, details);

    // Show brief error summary on the main UI if available
    try {
        const summary = document.getElementById('auth-summary-status');
        if (summary) {
            const short = details && details.message ? details.message : (details && details.code ? details.code : String(details));
            summary.innerText = `${context}: ${short}`;
            summary.classList.add('auth-status-error');
        }

        // Append full details to the bottom auth log if present
        const logContainer = document.getElementById('auth-log-entries');
        if (logContainer) {
            const time = new Date().toLocaleTimeString();
            const entry = document.createElement('div');
            entry.style.padding = '6px 0';
            entry.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            entry.textContent = `[${time}] ${context}: ${details && details.message ? details.message : (details && details.code ? details.code : String(details))}`;

            // If stack available, add it on next line
            if (details && details.stack) {
                const stack = document.createElement('pre');
                stack.style.margin = '6px 0 0 0';
                stack.style.whiteSpace = 'pre-wrap';
                stack.textContent = details.stack;
                entry.appendChild(stack);
            }

            logContainer.appendChild(entry);
        }
    } catch (e) {
        // ignore DOM errors in non-browser runtimes
    }
}

function getAuthElements() {
    return {
        dialog: getElement('auth-dialog'),
        closeButton: getElement('auth-dialog-close'),
        openButton: getElement('auth-open-sign-in'),
        emailInput: getElement('auth-email'),
        passwordInput: getElement('auth-password'),
        signInButton: getElement('auth-sign-in'),
        signUpButton: getElement('auth-sign-up'),
        googleButton: getElement('auth-google-sign-in'),
        signOutButton: getElement('auth-sign-out'),
        summaryStatus: getElement('auth-summary-status'),
        dialogStatus: getElement('auth-dialog-status'),
    };
}

function shouldUseRedirectSignIn() {
    if (typeof navigator === 'undefined') return false;

    const userAgent = navigator.userAgent || '';
    const isMobileBrowser = navigator.userAgentData?.mobile
        || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    return Boolean(isMobileBrowser);
}

function setButtonsDisabled(buttons, disabled) {
    buttons.forEach((button) => {
        button.disabled = disabled;
    });
}

export async function setupAuthUI() {
    const {
        dialog,
        closeButton,
        openButton,
        emailInput,
        passwordInput,
        signInButton,
        signUpButton,
        googleButton,
        signOutButton,
        summaryStatus,
        dialogStatus,
    } = getAuthElements();

    if (!dialog || !closeButton || !openButton || !emailInput || !passwordInput || !signInButton || !signUpButton || !googleButton || !signOutButton || !summaryStatus || !dialogStatus) {
        return;
    }

    if (dialog.dataset.authWired === 'true') {
        return;
    }
    dialog.dataset.authWired = 'true';

    let hasError = false;
    const authButtons = [signInButton, signUpButton, googleButton];
    const statusNodes = [summaryStatus, dialogStatus];
    const authInputs = [emailInput, passwordInput];

    const setStatus = (message, isError = false) => {
        hasError = isError;
        statusNodes.forEach((node) => {
            node.innerText = message;
            node.classList.toggle('auth-status-error', isError);
        });
        authInputs.forEach((input) => {
            input.classList.toggle('auth-input-error', isError);
        });
    };

    const setDialogOpen = (open) => {
        if (open) {
            if (dialog.open || dialog.hasAttribute('open')) return;

            if (typeof dialog.showModal === 'function') {
                try {
                    dialog.showModal();
                    return;
                } catch {
                    // Fall through to the non-modal fallback below.
                }
            }

            if (typeof dialog.show === 'function') {
                try {
                    dialog.show();
                    return;
                } catch {
                    // Fall through to the attribute fallback below.
                }
            }

            dialog.setAttribute('open', '');
            return;
        }

        if (dialog.open || dialog.hasAttribute('open')) {
            if (typeof dialog.close === 'function') {
                try {
                    dialog.close();
                } catch {
                    dialog.removeAttribute('open');
                }
                return;
            }

            dialog.removeAttribute('open');
        }
    };

    const services = await ensureFirebaseServices();
    if (!services) {
        openButton.disabled = true;
        openButton.innerText = 'Sign in unavailable';
        signOutButton.hidden = true;
        setStatus('Firebase is not available in this runtime.', true);
        return;
    }

    const { auth } = services;
    const googleProvider = new window.firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters?.({ prompt: 'select_account' });

    const onSignedOut = () => {
        setStatus('Not signed in');
        openButton.hidden = false;
        openButton.disabled = false;
        signOutButton.hidden = true;
        setDialogOpen(false);
    };

    const onSignedIn = (user) => {
        setStatus(`Signed in as ${user.displayName || user.email || 'Signed in user'}`);
        openButton.hidden = true;
        signOutButton.hidden = false;
        signOutButton.innerText = 'Sign out';
        setDialogOpen(false);
    };

    const submitEmailPassword = async (isNewAccount) => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            setStatus('Email and password are required.', true);
            return;
        }

        setButtonsDisabled(authButtons, true);
        setStatus(isNewAccount ? 'Creating account...' : 'Signing in...');

        try {
            if (isNewAccount) {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            logAuthError('Email/password sign-in failed', error);
            setStatus(getAuthErrorMessage(error), true);
            setButtonsDisabled(authButtons, false);
        }
    };

    const submitGoogleSignIn = async () => {
        setButtonsDisabled(authButtons, true);
        setStatus('Opening Google sign-in...');

        try {
            if (shouldUseRedirectSignIn() && auth.signInWithRedirect) {
                try {
                    await auth.signInWithRedirect(googleProvider);
                    return;
                } catch (redirectError) {
                    logAuthError('Google redirect sign-in failed', redirectError);
                    if (auth.signInWithPopup) {
                        await auth.signInWithPopup(googleProvider);
                        return;
                    }

                    throw redirectError;
                }
            }

            await auth.signInWithPopup(googleProvider);
        } catch (error) {
            if (error?.code === 'auth/popup-blocked' && auth.signInWithRedirect) {
                try {
                    await auth.signInWithRedirect(googleProvider);
                    return;
                } catch (redirectError) {
                    logAuthError('Google popup fallback redirect failed', redirectError);
                    const fallbackMsg = redirectError?.message || getAuthErrorMessage(redirectError);
                    setStatus(fallbackMsg, true);
                    setButtonsDisabled(authButtons, false);
                    return;
                }
            }

            logAuthError('Google sign-in failed', error);
            const errMsg = error?.message || getAuthErrorMessage(error);
            if (error?.code === 'auth/unauthorized-domain') {
                setStatus(`${errMsg} — Ensure this app's domain is listed under Firebase Console → Authentication → Sign-in method → Authorized domains.`, true);
            } else {
                setStatus(errMsg, true);
            }

            setButtonsDisabled(authButtons, false);
        }
    };

    openButton.addEventListener('click', () => {
        setDialogOpen(true);
        setButtonsDisabled(authButtons, false);
        emailInput.focus();

        if (!hasError) {
            setStatus('Not signed in');
        }
    });

    closeButton.addEventListener('click', () => setDialogOpen(false));
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        setDialogOpen(false);
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
            setDialogOpen(false);
        }
    });

    emailInput.addEventListener('input', () => {
        if (hasError) setStatus('Not signed in');
    });

    passwordInput.addEventListener('input', () => {
        if (hasError) setStatus('Not signed in');
    });

    signInButton.addEventListener('click', () => submitEmailPassword(false));
    signUpButton.addEventListener('click', () => submitEmailPassword(true));
    googleButton.addEventListener('click', submitGoogleSignIn);
    signOutButton.addEventListener('click', () => auth.signOut());

    auth.onAuthStateChanged((user) => {
        if (user) {
            onSignedIn(user);
            return;
        }

        onSignedOut();
    });

    try {
        await auth.getRedirectResult?.();
    } catch (error) {
        logAuthError('getRedirectResult failed', error);
        const errMsg = error?.message || getAuthErrorMessage(error);
        if (error?.code === 'auth/unauthorized-domain') {
            setStatus(`${errMsg} — Ensure this domain is added to Firebase Console → Authentication → Sign-in method → Authorized domains.`, true);
        } else {
            setStatus(errMsg, true);
        }

        setButtonsDisabled(authButtons, false);
    }
}
