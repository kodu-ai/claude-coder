export const jsWriteToFileTool = {
	toolName: "writeFile",
	path: "script.js",
	value: `let currentOperand = '';
let previousOperand = '';
let operation = undefined;
<content/><write_to_file>

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

// const parser = new ToolParser(
// 	tools.map((t) => t.schema),
// 	{
// 		onToolUpdate: (id, toolName, params, ts) => {
// 			console.log(params.content)
// 		},
// 		onToolEnd: (id, toolName, params, ts) => {
// 			console.log("End:", { id, toolName, params, ts })
// 		},
// 		onToolError: (id, toolName, error, ts) => {
// 			console.error("Error:", { id, toolName, error, ts })
// 		},
// 		onToolClosingError: (error) => {
// 			console.error("Closing Error:", error)
// 		},
// 	}
// )

// const input = `<thinking>
// I need to create a markdown file explaining the 5 most commonly used HTML tags and their use cases. This will be helpful for beginners learning HTML.

// Current step: Create a new markdown file with clear explanations of HTML tags
// Next step: Write comprehensive content about the most used HTML tags

// Questions before writing:
// - Did i read the file before writing to it? No (file doesn\'t exist yet)
// - Did i write to the file before? No
// - Did the user provide the content of the file? No
// - Do i have the last content of the file? No, this is a new file

// The file will be created at: /home/matan/code/test-3/kodu/test/html.md
// </thinking>

// <write_to_file>
// <path>html.md</path>
// <content># 5 Most Used HTML Tags and Their Use Cases

// ## 1. \`<div>\` - Division/Container Tag
// The \`<div>\` tag is a container element used to group other HTML elements together. It\'s the most versatile block-level element.

// **Use Cases:**
// - Creating sections in a webpage
// - Grouping elements for styling
// - Building layout structures
// - Organizing content into logical divisions

// ## 2. \`<p>\` - Paragraph Tag
// The \`<p>\` tag defines a paragraph of text. It automatically adds space before and after the content.

// **Use Cases:**
// - Writing text content
// - Creating readable blocks of content
// - Separating text into logical paragraphs
// - Maintaining proper text spacing

// ## 3. \`<a>\` - Anchor Tag
// The \`<a>\` tag creates hyperlinks to other web pages, files, or locations within the same page.

// **Use Cases:**
// - Creating links to other websites
// - Making email links
// - Creating internal page navigation
// - Downloading files
// \`\`\`html
// <a href="https://example.com">Visit Example</a>
// \`\`\`

// ## 4. \`<img>\` - Image Tag
// The \`<img>\` tag embeds images into your webpage. It\'s a self-closing tag that requires a source attribute.

// **Use Cases:**
// - Displaying photos and illustrations
// - Adding logos and icons
// - Showing product images
// - Creating visual content
// \`\`\`html
// <img src="image.jpg" alt="Description of image">
// \`\`\`

// ## 5. \`<h1>\` to \`<h6>\` - Heading Tags
// Heading tags define different levels of headings, with \`<h1>\` being the most important and \`<h6>\` the least.

// **Use Cases:**
// - Creating page titles
// - Organizing content hierarchy
// - Improving SEO
// - Structuring document sections
// \`\`\`html
// <h1>Main Title</h1>
// <h2>Subtitle</h2>
// \`\`\`

// These tags form the foundation of HTML document structure and are essential for creating well-organized, semantic web content.</content>
// </write_to_file>

// <thinking>
// I have created a comprehensive markdown file that:
// 1. Lists the 5 most commonly used HTML tags
// 2. Provides clear explanations for each tag
// 3. Includes specific use cases for each tag
// 4. Added code examples where relevant
// 5. Formatted the content in a clean, readable way using markdown

// Now that the file has been created with complete content, I can attempt to complete the task.
// </thinking>

// <attempt_completion>
// <result>
// I have created the html.md file with detailed explanations of the 5 most commonly used HTML tags. The file includes:
// - Comprehensive descriptions of each tag
// - Specific use cases for each tag
// - Code examples where appropriate
// - Clear markdown formatting for readability

// The file has been written to /home/matan/code/test-3/kodu/test/html.md
// </result>
// </attempt_completion>`

// parser.appendText(input)
// parser.endParsing()
