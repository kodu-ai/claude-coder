export const jsWriteToFileTool = {
	toolName: "writeFile",
	path: "script.js",
	value: `let currentOperand = '';
let previousOperand = '';
let operation = undefined;

const currentOperandTextElement = document.getElementById('current-operand');
const previousOperandTextElement = document.getElementById('previous-operand');

function appendToDisplay(value) {
    if (value === '.' && currentOperand.includes('.')) return;
    currentOperand = currentOperand.toString() + value.toString();
    updateDisplay();
}

function clearDisplay() {
    currentOperand = '';
    previousOperand = '';
    operation = undefined;
    updateDisplay();
}

function deleteLastChar() {
    currentOperand = currentOperand.toString().slice(0, -1);
    updateDisplay();
}

function chooseOperation(op) {
    if (currentOperand === '') return;
    if (previousOperand !== '') {
        compute();
    }
    operation = op;
    previousOperand = currentOperand;
    currentOperand = '';
    updateDisplay();
}

function compute() {
    let computation;
    const prev = parseFloat(previousOperand);
    const current = parseFloat(currentOperand);
    if (isNaN(prev) || isNaN(current)) return;
    switch (operation) {
        case '+':
            computation = prev + current;
            break;
        case '-':
            computation = prev - current;
            break;
        case '*':
            computation = prev * current;
            break;
        case '/':
            if (current === 0) {
                alert("Error: Division by Zero");
                clearDisplay();
                return;
            }
            computation = prev / current;
            break;
        case '^':
            computation = Math.pow(prev, current);
            break;
        case '√':
            computation = Math.sqrt(current);
            break;
        default:
            return;
    }
    currentOperand = computation;
    operation = undefined;
    previousOperand = '';
    updateDisplay();
}

function updateDisplay() {
    currentOperandTextElement.innerText = currentOperand;
    if (operation != null) {
        previousOperandTextElement.innerText = \`\${previousOperand} \${operation}\`;
    } else {
        previousOperandTextElement.innerText = '';
    }
}

function calculate() {
    if (operation === '√') {
        currentOperand = Math.sqrt(parseFloat(currentOperand));
    } else {
        compute();
    }
    updateDisplay();
}

// Add keyboard support
document.addEventListener('keydown', function(event) {
    if (event.key >= '0' && event.key <= '9' || event.key === '.') {
        appendToDisplay(event.key);
    } else if (event.key === '+' || event.key === '-' || event.key === '*' || event.key === '/') {
        chooseOperation(event.key);
    } else if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        calculate();
    } else if (event.key === 'Escape') {
        clearDisplay();
    } else if (event.key === 'Backspace') {
        deleteLastChar();
    }
});

// Initialize display
updateDisplay();
`,
}
