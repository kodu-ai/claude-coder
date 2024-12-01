import { CodeDiffFormatter } from "../../../../src/integrations/editor/code-diff-formatter"
import * as assert from "assert"
import * as vscode from "vscode"

/**
 * Unit tests for CodeDiffFormatter
 */
describe("CodeDiffFormatter", () => {
	let formatter: CodeDiffFormatter

	beforeEach(() => {
		formatter = new CodeDiffFormatter()
	})

	it("handles TypeScript class changes", () => {
		const original = `
class Person {
    private name: string;
    
    constructor(name: string) {
        this.name = name;
    }
}`.trim()

		const modified = `
class Person {
    private name: string;
    private age: number;
    
    constructor(name: string, age: number) {
        this.name = name;
        this.age = age;
    }
    
    getAge(): number {
        return this.age;
    }
}`.trim()

		const result = formatter.generateTruncatedDiff(original, modified)
		assert.strictEqual(result.includes("class Person {"), true)
		assert.strictEqual(result.includes("private age: number"), true)
		assert.strictEqual(result.includes("getAge(): number"), true)
		assert.strictEqual(result.includes("..."), true)
	})

	it("handles Python function changes", () => {
		const original = `
def calculate_total(items):
    return sum(items)

def process_data(data):
    return data.strip()`.trim()

		const modified = `
def calculate_total(items):
    return sum(items)

def process_data(data):
    data = data.strip()
    return data.lower()

def validate_input(data):
    return bool(data)`.trim()

		const result = formatter.generateTruncatedDiff(original, modified, { language: "python" })
		assert.strictEqual(result.includes("def calculate_total(items):"), true)
		assert.strictEqual(result.includes("def process_data(data):"), true)
		assert.strictEqual(result.includes("return data.lower()"), true)
		assert.strictEqual(result.includes("def validate_input(data):"), true)
		assert.strictEqual(result.includes("..."), true)
	})

	it("handles Java class and method changes", () => {
		const original = `
public class Calculator {
    private int value;
    
    public Calculator(int initial) {
        this.value = initial;
    }
    
    public int add(int x) {
        return value + x;
    }
}`.trim()

		const modified = `
public class Calculator {
    private int value;
    private String name;
    
    public Calculator(int initial, String name) {
        this.value = initial;
        this.name = name;
    }
    
    public int add(int x) {
        return value + x;
    }
    
    public String getName() {
        return name;
    }
}`.trim()

		const result = formatter.generateTruncatedDiff(original, modified, { language: "java" })
		assert.strictEqual(result.includes("public class Calculator"), true)
		assert.strictEqual(result.includes("private String name;"), true)
		assert.strictEqual(result.includes("public String getName()"), true)
		assert.strictEqual(result.includes("..."), true)
	})

	it("handles Go struct and interface changes", () => {
		const original = `
package main

type User struct {
    ID   int
    Name string
}

func (u *User) GetName() string {
    return u.Name
}`.trim()

		const modified = `
package main

type User struct {
    ID       int
    Name     string
    Email    string
    Active   bool
}

func (u *User) GetName() string {
    return u.Name
}

func (u *User) IsActive() bool {
    return u.Active
}`.trim()

		const result = formatter.generateTruncatedDiff(original, modified, { language: "go" })
		assert.strictEqual(result.includes("type User struct"), true)
		assert.strictEqual(result.includes("Email    string"), true)
		assert.strictEqual(result.includes("Active   bool"), true)
		assert.strictEqual(result.includes("func (u *User) IsActive()"), true)
		assert.strictEqual(result.includes("..."), true)
	})

	it("handles Ruby class and module changes", () => {
		const original = `
module UserManagement
  class User
    attr_reader :name
    
    def initialize(name)
      @name = name
    end
  end
end`.trim()

		const modified = `
module UserManagement
  class User
    attr_reader :name, :email
    attr_accessor :status
    
    def initialize(name, email)
      @name = name
      @email = email
      @status = 'active'
    end
    
    def active?
      @status == 'active'
    end
  end
end`.trim()

		const result = formatter.generateTruncatedDiff(original, modified, { language: "ruby" })
		assert.strictEqual(result.includes("module UserManagement"), true)
		assert.strictEqual(result.includes("class User"), true)
		assert.strictEqual(result.includes("attr_reader :name, :email"), true)
		assert.strictEqual(result.includes("def active?"), true)
		assert.strictEqual(result.includes("..."), true)
	})

	it("handles Rust struct and impl changes", () => {
		const original = `
pub struct Point {
    x: f64,
    y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Point {
        Point { x, y }
    }
}`.trim()

		const modified = `
pub struct Point {
    x: f64,
    y: f64,
    z: f64,
}

impl Point {
    pub fn new(x: f64, y: f64, z: f64) -> Point {
        Point { x, y, z }
    }
    
    pub fn distance_from_origin(&self) -> f64 {
        (self.x.powi(2) + self.y.powi(2) + self.z.powi(2)).sqrt()
    }
}`.trim()

		const result = formatter.generateTruncatedDiff(original, modified, { language: "rust" })
		assert.strictEqual(result.includes("pub struct Point"), true)
		assert.strictEqual(result.includes("z: f64"), true)
		assert.strictEqual(result.includes("pub fn distance_from_origin"), true)
		assert.strictEqual(result.includes("..."), true)
	})
})
