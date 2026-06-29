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
            if (!dialog.open) dialog.showModal();
            return;
        }

        if (dialog.open) dialog.close();
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
            setStatus(getAuthErrorMessage(error), true);
            setButtonsDisabled(authButtons, false);
        }
    };

    const submitGoogleSignIn = async () => {
        setButtonsDisabled(authButtons, true);
        setStatus('Opening Google sign-in...');

        try {
            await auth.signInWithPopup(googleProvider);
        } catch (error) {
            setStatus(getAuthErrorMessage(error), true);
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
}
