export function canSpeak() {
    return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

const SPEAK_BUTTON_ICON_HTML = `
    <svg class="speak-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 10v4h4l5 4V6L7 10H3z" fill="currentColor"></path>
        <path d="M16.5 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
        <path d="M19.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
    </svg>
    <span class="visually-hidden">Speak word</span>
`;

export function createSpeechController(getCurrentWord) {
    let availableVoices = [];
    let selectedVoiceName = '';
    let voiceLoadRetryCount = 0;

    function loadAvailableVoices() {
        if (!canSpeak()) return [];

        availableVoices = window.speechSynthesis
            .getVoices()
            .filter((voice) => voice.lang && voice.lang.startsWith('en'));

        return availableVoices;
    }

    function getPreferredVoice() {
        if (!canSpeak()) return null;

        const voices = availableVoices.length ? availableVoices : loadAvailableVoices();
        const selectedVoice = voices.find((voice) => voice.name === selectedVoiceName);
        if (selectedVoice) return selectedVoice;

        const preferredVoiceNames = [
            'Google US English',
            'Microsoft Aria Online',
            'Microsoft Jenny Online',
            'Microsoft Guy Online',
            'Samantha',
        ];

        return preferredVoiceNames
            .map((voiceName) => voices.find((voice) => voice.name.includes(voiceName)))
            .find(Boolean)
            || voices.find((voice) => voice.lang === 'en-US')
            || voices.find((voice) => voice.lang && voice.lang.startsWith('en'))
            || null;
    }

    function renderVoiceSelect() {
        const voiceSelect = document.getElementById('voice-select');
        if (!voiceSelect) return;

        const voices = loadAvailableVoices();
        voiceSelect.innerHTML = '';

        if (voices.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.innerText = canSpeak() ? 'Use browser default voice' : 'Speech is not supported';
            voiceSelect.appendChild(option);
            voiceSelect.disabled = true;
            return;
        }

        const preferredVoice = getPreferredVoice();
        selectedVoiceName = selectedVoiceName || (preferredVoice ? preferredVoice.name : voices[0].name);

        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.innerText = `${voice.name} (${voice.lang})`;
            option.selected = voice.name === selectedVoiceName;
            voiceSelect.appendChild(option);
        });

        voiceSelect.disabled = false;
    }

    function retryLoadVoices() {
        if (!canSpeak()) return;

        renderVoiceSelect();
        if (availableVoices.length > 0 || voiceLoadRetryCount >= 20) return;

        voiceLoadRetryCount++;
        setTimeout(retryLoadVoices, 250);
    }

    function setSelectedVoice(voiceName, event) {
        if (event) {
            event.stopPropagation();
        }

        selectedVoiceName = voiceName;
    }

    function speakCurrentWord(event) {
        if (event) {
            event.stopPropagation();
        }

        const currentWord = getCurrentWord();
        if (!canSpeak() || !currentWord) return;

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentWord.w);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        const preferredVoice = getPreferredVoice();
        if (preferredVoice) {
            utterance.voice = preferredVoice;
            utterance.lang = preferredVoice.lang;
        }
        window.speechSynthesis.speak(utterance);
    }

    function updateSpeakButton() {
        const speakButton = document.getElementById('speak-word');
        if (!speakButton) return;

        if (!speakButton.querySelector('.speak-button-icon')) {
            speakButton.innerHTML = SPEAK_BUTTON_ICON_HTML;
        }
        speakButton.disabled = !canSpeak() || !getCurrentWord();
    }

    return {
        retryLoadVoices,
        setSelectedVoice,
        speakCurrentWord,
        updateSpeakButton,
    };
}
