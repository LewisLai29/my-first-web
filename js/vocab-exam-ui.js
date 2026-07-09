export function renderQuizResultScreen(attempt, { renderExampleText } = {}) {
    if (!attempt) return;

    const scoreElement = document.getElementById('quiz-score');
    if (scoreElement) {
        scoreElement.innerText = `${attempt.score} points`;
    }

    const noteElement = document.getElementById('quiz-result-note');
    if (noteElement) {
        noteElement.innerText = `${attempt.correctCount} / ${attempt.totalCount} correct`;
    }

    renderQuizAnalysisList(Array.isArray(attempt.answers) ? attempt.answers : [], { renderExampleText });
}

function renderQuizAnalysisList(answers, { renderExampleText } = {}) {
    const list = document.getElementById('quiz-analysis-list');
    if (!list) return;

    list.innerHTML = '';
    answers.forEach((answer, index) => {
        const item = document.createElement('li');
        item.className = answer.isRight ? 'quiz-analysis-item quiz-analysis-right' : 'quiz-analysis-item quiz-analysis-wrong';

        const heading = document.createElement('div');
        heading.className = 'quiz-analysis-heading';

        const word = document.createElement('strong');
        word.innerText = `${index + 1}. ${answer.w}`;

        const pos = document.createElement('span');
        pos.className = 'quiz-analysis-pos';
        pos.innerText = answer.pos ? `(${answer.pos})` : '';

        const result = document.createElement('span');
        result.className = 'quiz-analysis-result';
        result.innerText = answer.isRight ? 'Correct' : 'Wrong';

        heading.append(word, pos, result);

        const meaning = document.createElement('p');
        meaning.className = 'quiz-analysis-meaning';
        meaning.innerText = answer.m || 'No explanation';

        const example = document.createElement('p');
        example.className = 'example quiz-analysis-example';
        if (typeof renderExampleText === 'function') {
            renderExampleText(example, answer.e || 'No example');
        } else {
            example.innerText = answer.e || 'No example';
        }

        item.append(heading, meaning, example);
        list.appendChild(item);
    });
}
