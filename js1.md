# JavaScript Basics

## Introduction to JavaScript

JavaScript is a versatile, high-level programming language primarily used for web development. It enables interactive web pages and is an essential part of web applications.

## Variables and Data Types

```javascript
// Variable declaration
let name = "John";       // String
const age = 30;          // Number
var isActive = true;     // Boolean

// Arrays
let colors = ["red", "green", "blue"];

// Objects
let person = {
  firstName: "Jane",
  lastName: "Doe",
  age: 25
};
```

## Functions

```javascript
// Function declaration
function greet(name) {
  return `Hello, ${name}!`;
}

// Arrow function
const multiply = (a, b) => a * b;

// Function expression
const sum = function(a, b) {
  return a + b;
};
```

## Control Flow

```javascript
// Conditionals
if (age >= 18) {
  console.log("Adult");
} else {
  console.log("Minor");
}

// Loops
for (let i = 0; i < 5; i++) {
  console.log(i);
}

let i = 0;
while (i < 5) {
  console.log(i);
  i++;
}
```

## DOM Manipulation

```javascript
// Selecting elements
const element = document.getElementById("myElement");
const buttons = document.querySelectorAll(".btn");

// Modifying content
element.textContent = "New text";
element.innerHTML = "<span>HTML content</span>";

// Event handling
element.addEventListener("click", function() {
  alert("Element clicked!");
});
```

## Error Handling

```javascript
try {
  // Code that might throw an error
  const result = riskyOperation();
} catch (error) {
  console.error("An error occurred:", error.message);
} finally {
  // Code that will run regardless of an error
  cleanupResources();
}
```