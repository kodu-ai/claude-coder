export default `; Minimal and Safe Python Queries

; Classes
(class_definition
  (identifier) @name.definition.class)

; Functions
(function_definition
  (identifier) @name.definition.function)

; Imports (capture identifiers inside dotted_name)
(import_statement
  (dotted_name
    (identifier) @name.import.module))

(import_from_statement
  (dotted_name
    (identifier) @name.import.module))

; Function Calls
(call
  (identifier) @name.call)

; Method Calls
(call
  (attribute
    (identifier) @name.method_call))
`
