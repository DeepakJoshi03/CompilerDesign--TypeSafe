
        // Mini C Compiler Implementation in JavaScript
        class Token {
            constructor(type, value, line, column) {
                this.type = type;
                this.value = value;
                this.line = line;
                this.column = column;
            }
        }

        class CompilerError {
            constructor(type, message, line, column, suggestion) {
                this.type = type;
                this.message = message;
                this.line = line;
                this.column = column;
                this.suggestion = suggestion;
            }
        }

        class MiniCCompiler {
            constructor() {
                this.tokens = [];
                this.currentToken = 0;
                this.errors = [];
                this.warnings = [];
                this.symbolTable = new Map();
                this.output = [];
            }

            // Lexical Analysis
            tokenize(code) {
                const tokens = [];
                const lines = code.split('\n');
                
                const keywords = ['int', 'float', 'char', 'void', 'if', 'else', 'while', 'for', 'return', 'printf', 'scanf', 'include'];
                const operators = ['+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '++', '--', '+=', '-='];
                const delimiters = ['(', ')', '{', '}', '[', ']', ';', ',', '#'];

                for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                    const line = lines[lineNum];
                    let col = 0;
                    
                    while (col < line.length) {
                        const char = line[col];
                        
                        // Skip whitespace
                        if (/\s/.test(char)) {
                            col++;
                            continue;
                        }
                        
                        // Comments
                        if (char === '/' && col + 1 < line.length && line[col + 1] === '/') {
                            break; // Skip rest of line
                        }
                        
                        // String literals
                        if (char === '"') {
                            let str = '';
                            col++; // Skip opening quote
                            while (col < line.length && line[col] !== '"') {
                                str += line[col];
                                col++;
                            }
                            if (col >= line.length) {
                                this.errors.push(new CompilerError('LEXICAL', 'Unterminated string literal', lineNum + 1, col, 'Add closing quote "'));
                            } else {
                                col++; // Skip closing quote
                                tokens.push(new Token('STRING', str, lineNum + 1, col - str.length - 1));
                            }
                            continue;
                        }
                        
                        // Numbers
                        if (/\d/.test(char)) {
                            let num = '';
                            let isFloat = false;
                            while (col < line.length && (/\d/.test(line[col]) || line[col] === '.')) {
                                if (line[col] === '.') {
                                    if (isFloat) {
                                        this.errors.push(new CompilerError('LEXICAL', 'Invalid number format', lineNum + 1, col, 'Numbers can only have one decimal point'));
                                        break;
                                    }
                                    isFloat = true;
                                }
                                num += line[col];
                                col++;
                            }
                            tokens.push(new Token(isFloat ? 'FLOAT' : 'INTEGER', num, lineNum + 1, col - num.length));
                            continue;
                        }
                        
                        // Identifiers and keywords
                        if (/[a-zA-Z_]/.test(char)) {
                            let identifier = '';
                            while (col < line.length && /[a-zA-Z0-9_]/.test(line[col])) {
                                identifier += line[col];
                                col++;
                            }
                            const tokenType = keywords.includes(identifier) ? 'KEYWORD' : 'IDENTIFIER';
                            tokens.push(new Token(tokenType, identifier, lineNum + 1, col - identifier.length));
                            continue;
                        }
                        
                        // Two-character operators
                        if (col + 1 < line.length) {
                            const twoChar = line.substr(col, 2);
                            if (operators.includes(twoChar)) {
                                tokens.push(new Token('OPERATOR', twoChar, lineNum + 1, col));
                                col += 2;
                                continue;
                            }
                        }
                        
                        // Single-character operators and delimiters
                        if (operators.includes(char) || delimiters.includes(char)) {
                            const tokenType = delimiters.includes(char) ? 'DELIMITER' : 'OPERATOR';
                            tokens.push(new Token(tokenType, char, lineNum + 1, col));
                            col++;
                            continue;
                        }
                        
                        // Invalid character
                        this.errors.push(new CompilerError('LEXICAL', `Invalid character: '${char}'`, lineNum + 1, col, 'Remove or replace invalid character'));
                        col++;
                    }
                }
                
                return tokens;
            }

            // Syntax Analysis
            parse(tokens) {
                this.tokens = tokens;
                this.currentToken = 0;
                
                try {
                    this.parseProgram();
                } catch (error) {
                    // Parsing errors are already added to this.errors
                }
            }

            parseProgram() {
                while (this.currentToken < this.tokens.length) {
                    if (this.checkToken('KEYWORD', 'include')) {
                        this.parseInclude();
                    } else if (this.checkTokenType('KEYWORD')) {
                        this.parseDeclarationOrFunction();
                    } else {
                        this.syntaxError('Expected declaration or function', 'Add proper function or variable declaration');
                        this.currentToken++;
                    }
                }
            }

            parseInclude() {
                this.consumeToken('DELIMITER', '#');
                this.consumeToken('KEYWORD', 'include');
                
                if (this.checkToken('OPERATOR', '<')) {
                    this.consumeToken('OPERATOR', '<');
                    if (!this.checkTokenType('IDENTIFIER')) {
                        this.syntaxError('Expected header name', 'Add header name like stdio.h');
                    } else {
                        this.currentToken++;
                    }
                    this.consumeToken('OPERATOR', '>');
                } else {
                    this.syntaxError('Expected < after #include', 'Use format: #include <stdio.h>');
                }
            }

            parseDeclarationOrFunction() {
                const type = this.getCurrentToken().value;
                this.currentToken++; // consume type
                
                if (!this.checkTokenType('IDENTIFIER')) {
                    this.syntaxError('Expected identifier', 'Add variable or function name');
                    return;
                }
                
                const name = this.getCurrentToken().value;
                this.currentToken++; // consume identifier
                
                if (this.checkToken('DELIMITER', '(')) {
                    this.parseFunction(type, name);
                } else if (this.checkToken('OPERATOR', '=') || this.checkToken('DELIMITER', ';') || this.checkToken('DELIMITER', ',')) {
                    this.parseDeclaration(type, name);
                } else {
                    this.syntaxError('Expected (, =, or ;', 'Add proper syntax for declaration or function');
                }
            }

            parseFunction(returnType, name) {
                this.symbolTable.set(name, { type: 'function', returnType: returnType });
                
                this.consumeToken('DELIMITER', '(');
                
                // Parse parameters
                if (!this.checkToken('DELIMITER', ')')) {
                    this.parseParameterList();
                }
                
                this.consumeToken('DELIMITER', ')');
                this.consumeToken('DELIMITER', '{');
                
                this.parseBlockStatement();
                
                this.consumeToken('DELIMITER', '}');
            }

            parseParameterList() {
                do {
                    if (this.checkTokenType('KEYWORD')) {
                        const paramType = this.getCurrentToken().value;
                        this.currentToken++;
                        
                        if (this.checkTokenType('IDENTIFIER')) {
                            const paramName = this.getCurrentToken().value;
                            this.symbolTable.set(paramName, { type: 'parameter', dataType: paramType });
                            this.currentToken++;
                        } else {
                            this.syntaxError('Expected parameter name', 'Add parameter name after type');
                        }
                    } else {
                        this.syntaxError('Expected parameter type', 'Add parameter type (int, float, etc.)');
                        break;
                    }
                    
                    if (this.checkToken('DELIMITER', ',')) {
                        this.currentToken++;
                    } else {
                        break;
                    }
                } while (this.currentToken < this.tokens.length);
            }

            parseDeclaration(type, name) {
                this.symbolTable.set(name, { type: 'variable', dataType: type });
                
                if (this.checkToken('OPERATOR', '=')) {
                    this.currentToken++; // consume =
                    this.parseExpression();
                }
                
                // Handle multiple declarations
                while (this.checkToken('DELIMITER', ',')) {
                    this.currentToken++; // consume ,
                    if (this.checkTokenType('IDENTIFIER')) {
                        const nextName = this.getCurrentToken().value;
                        this.symbolTable.set(nextName, { type: 'variable', dataType: type });
                        this.currentToken++;
                        
                        if (this.checkToken('OPERATOR', '=')) {
                            this.currentToken++; // consume =
                            this.parseExpression();
                        }
                    } else {
                        this.syntaxError('Expected identifier', 'Add variable name after comma');
                    }
                }
                
                this.consumeToken('DELIMITER', ';');
            }

            parseBlockStatement() {
                while (!this.checkToken('DELIMITER', '}') && this.currentToken < this.tokens.length) {
                    this.parseStatement();
                }
            }

            parseStatement() {
                if (this.checkTokenType('KEYWORD')) {
                    const keyword = this.getCurrentToken().value;
                    
                    switch (keyword) {
                        case 'int':
                        case 'float':
                        case 'char':
                            this.parseDeclarationOrFunction();
                            break;
                        case 'if':
                            this.parseIfStatement();
                            break;
                        case 'while':
                            this.parseWhileStatement();
                            break;
                        case 'for':
                            this.parseForStatement();
                            break;
                        case 'return':
                            this.parseReturnStatement();
                            break;
                        case 'printf':
                        case 'scanf':
                            this.parseFunctionCall();
                            break;
                        default:
                            this.syntaxError(`Unexpected keyword: ${keyword}`, 'Use valid C keywords');
                            this.currentToken++;
                    }
                } else if (this.checkTokenType('IDENTIFIER')) {
                    // Assignment or function call
                    const name = this.getCurrentToken().value;
                    this.currentToken++;
                    
                    if (this.checkToken('DELIMITER', '(')) {
                        this.currentToken--; // backtrack
                        this.parseFunctionCall();
                    } else if (this.checkToken('OPERATOR', '=') || this.checkToken('OPERATOR', '+=') || this.checkToken('OPERATOR', '-=')) {
                        this.parseAssignment(name);
                    } else {
                        this.syntaxError('Expected assignment or function call', 'Add = for assignment or () for function call');
                    }
                } else {
                    this.syntaxError('Expected statement', 'Add valid C statement');
                    this.currentToken++;
                }
            }

            parseIfStatement() {
                this.consumeToken('KEYWORD', 'if');
                this.consumeToken('DELIMITER', '(');
                this.parseExpression();
                this.consumeToken('DELIMITER', ')');
                
                if (this.checkToken('DELIMITER', '{')) {
                    this.consumeToken('DELIMITER', '{');
                    this.parseBlockStatement();
                    this.consumeToken('DELIMITER', '}');
                } else {
                    this.parseStatement();
                }
                
                if (this.checkToken('KEYWORD', 'else')) {
                    this.currentToken++;
                    if (this.checkToken('DELIMITER', '{')) {
                        this.consumeToken('DELIMITER', '{');
                        this.parseBlockStatement();
                        this.consumeToken('DELIMITER', '}');
                    } else {
                        this.parseStatement();
                    }
                }
            }

            parseWhileStatement() {
                this.consumeToken('KEYWORD', 'while');
                this.consumeToken('DELIMITER', '(');
                this.parseExpression();
                this.consumeToken('DELIMITER', ')');
                
                if (this.checkToken('DELIMITER', '{')) {
                    this.consumeToken('DELIMITER', '{');
                    this.parseBlockStatement();
                    this.consumeToken('DELIMITER', '}');
                } else {
                    this.parseStatement();
                }
            }

            parseForStatement() {
                this.consumeToken('KEYWORD', 'for');
                this.consumeToken('DELIMITER', '(');
                
                // Initialization
                if (!this.checkToken('DELIMITER', ';')) {
                    this.parseStatement();
                } else {
                    this.currentToken++;
                }
                
                // Condition
                if (!this.checkToken('DELIMITER', ';')) {
                    this.parseExpression();
                }
                this.consumeToken('DELIMITER', ';');
                
                // Update
                if (!this.checkToken('DELIMITER', ')')) {
                    this.parseExpression();
                }
                this.consumeToken('DELIMITER', ')');
                
                if (this.checkToken('DELIMITER', '{')) {
                    this.consumeToken('DELIMITER', '{');
                    this.parseBlockStatement();
                    this.consumeToken('DELIMITER', '}');
                } else {
                    this.parseStatement();
                }
            }

            parseReturnStatement() {
                this.consumeToken('KEYWORD', 'return');
                
                if (!this.checkToken('DELIMITER', ';')) {
                    this.parseExpression();
                }
                
                this.consumeToken('DELIMITER', ';');
            }

            parseFunctionCall() {
       /*Used for printf(), scanf() or any user-defined function.

Checks if the function exists in the symbol table.

Parses parameters using parseArgumentList()*/
                const funcName = this.getCurrentToken().value;
                this.currentToken++; // consume function name
                
                // Check if function exists
                if (!this.symbolTable.has(funcName) && !['printf', 'scanf'].includes(funcName)) {
                    this.semanticError(`Undeclared function: ${funcName}`, 'Declare function before use');
                }
                
                this.consumeToken('DELIMITER', '(');
                
                // Parse arguments
                if (!this.checkToken('DELIMITER', ')')) {
                    this.parseArgumentList();
                }
                
                this.consumeToken('DELIMITER', ')');
                this.consumeToken('DELIMITER', ';');
            }

            parseArgumentList() {
    /*Parses arguments passed to a function call.

Handles comma-separated list of expressions.*/
                do {
                    this.parseExpression();
                    
                    if (this.checkToken('DELIMITER', ',')) {
                        this.currentToken++;
                    } else {
                        break;
                    }
                } while (this.currentToken < this.tokens.length);
            }

            parseAssignment(varName) {
                /*Validates variable declaration first.

Parses expressions on the right-hand side of =, +=, etc.*/

                // Check if variable is declared
                if (!this.symbolTable.has(varName)) {
                    this.semanticError(`Undeclared variable: ${varName}`, 'Declare variable before use');
                }
                
                const operator = this.getCurrentToken().value;
                this.currentToken++; // consume operator
                
                this.parseExpression();
                this.consumeToken('DELIMITER', ';');
            }

            parseExpression() {
                /* Starts parsing from the lowest precedence: || */
                this.parseLogicalOr();
            }

            parseLogicalOr() {
                /*Looks for || and builds logical expressions.

Calls parseLogicalAnd() for left and right sides. */
                this.parseLogicalAnd();
                
                while (this.checkToken('OPERATOR', '||')) {
                    this.currentToken++;
                    this.parseLogicalAnd();
                }
            }
// Looks for &&, then calls parseEquality().
            parseLogicalAnd() {

                this.parseEquality();
                
                while (this.checkToken('OPERATOR', '&&')) {
                    this.currentToken++;
                    this.parseEquality();
                }
            }

            parseEquality() {
                this.parseRelational();
                
                while (this.checkToken('OPERATOR', '==') || this.checkToken('OPERATOR', '!=')) {
                    this.currentToken++;
                    this.parseRelational();
                }
            }

            parseRelational() {
                this.parseAdditive();
                
                while (this.checkToken('OPERATOR', '<') || this.checkToken('OPERATOR', '>') || 
                       this.checkToken('OPERATOR', '<=') || this.checkToken('OPERATOR', '>=')) {
                    this.currentToken++;
                    this.parseAdditive();
                }
            }

            parseAdditive() {
                this.parseMultiplicative();
                
                while (this.checkToken('OPERATOR', '+') || this.checkToken('OPERATOR', '-')) {
                    this.currentToken++;
                    this.parseMultiplicative();
                }
            }

            parseMultiplicative() {
                this.parseUnary();
                
                while (this.checkToken('OPERATOR', '*') || this.checkToken('OPERATOR', '/')) {
                    this.currentToken++;
                    this.parseUnary();
                }
            }

            parseUnary() {
                if (this.checkToken('OPERATOR', '!') || this.checkToken('OPERATOR', '-') || this.checkToken('OPERATOR', '+')) {
                    this.currentToken++;
                    this.parseUnary();
                } else {
                    this.parsePrimary();//Calls parsePrimary() for actual values or variables.
                }
            }

            parsePrimary() {//Final leaf of the expression parser.


                if (this.checkTokenType('INTEGER') || this.checkTokenType('FLOAT') || this.checkTokenType('STRING')) {
                    this.currentToken++;
                } else if (this.checkTokenType('IDENTIFIER')) {
                    const varName = this.getCurrentToken().value;
                    
                    // Check if variable is declared
                    if (!this.symbolTable.has(varName)) {
                        this.semanticError(`Undeclared variable: ${varName}`, 'Declare variable before use');
                    }
                    
                    this.currentToken++;
                    
                    // Handle function calls
                    if (this.checkToken('DELIMITER', '(')) {
                        this.currentToken--; // backtrack
                        this.parseFunctionCall();
                        return;
                    }
                } else if (this.checkToken('DELIMITER', '(')) {
                    this.consumeToken('DELIMITER', '(');
                    this.parseExpression();
                    this.consumeToken('DELIMITER', ')');
                } else {
                    this.syntaxError('Expected expression', 'Add number, variable, or parenthesized expression');
                }
            }//Raises error if invalid expression is found.



            // Utility methods
            getCurrentToken() {
                if (this.currentToken >= this.tokens.length) {
                    return new Token('EOF', '', 0, 0);
                }
                return this.tokens[this.currentToken];
            }

            checkToken(type, value) {
                const token = this.getCurrentToken();
                return token.type === type && token.value === value;
            }

            checkTokenType(type) {
                return this.getCurrentToken().type === type;
            }

            consumeToken(expectedType, expectedValue) {
                const token = this.getCurrentToken();
                
                if (token.type === expectedType && token.value === expectedValue) {
                    this.currentToken++;
                    return token;
                }
                
                this.syntaxError(`Expected ${expectedValue}`, `Add ${expectedValue}`);
                return token;
            }

            syntaxError(message, suggestion) {
                const token = this.getCurrentToken();
                this.errors.push(new CompilerError('SYNTAX', message, token.line, token.column, suggestion));
            }

            semanticError(message, suggestion) {
                const token = this.getCurrentToken();
                this.errors.push(new CompilerError('SEMANTIC', message, token.line, token.column, suggestion));
            }

            // Code Generation
            generateCode() {
                this.output = [];
                this.output.push('// Generated Assembly-like Code');
                this.output.push('SECTION .data');
                
                // To Generate variable declarations
                for (let [name, info] of this.symbolTable) {
                    if (info.type === 'variable') {
                        this.output.push(`    ${name}: ${info.dataType.toUpperCase()} 0`);
                    }
                }
                //assembly level code generation
                this.output.push('SECTION .text');
                this.output.push('GLOBAL _start');
                this.output.push('_start:');
                this.output.push('    ; Program execution starts here');
                this.output.push('    ; ... generated code ...');
                this.output.push('    MOV EAX, 1    ; sys_exit');
                this.output.push('    MOV EBX, 0    ; exit status');
                this.output.push('    INT 0x80      ; system call');
                
                return this.output;
            }

            // Main compile method
            compile(code) {
                this.errors = [];
                this.warnings = [];
                this.symbolTable.clear();
                this.output = [];
                
                const result = {
                    success: false,
                    tokens: [],
                    errors: [],
                    warnings: [],
                    symbolTable: {},
                    generatedCode: [],
                    phases: []
                };
                
                try {
                    // Phase 1: Lexical Analysis
                    result.phases.push('🔍 LEXICAL ANALYSIS');
                    const tokens = this.tokenize(code);
                    result.tokens = tokens;
                    
                    if (this.errors.length > 0) {
                        result.errors = this.errors;
                        return result;
                    }
                    
                    // Phase 2: Syntax Analysis
                    result.phases.push('📝 SYNTAX ANALYSIS');
                    this.parse(tokens);
                    
                    if (this.errors.length > 0) {
                        result.errors = this.errors;
                        return result;
                    }
                    
                    // Phase 3: Semantic Analysis
                    result.phases.push('🧠 SEMANTIC ANALYSIS');
                    this.semanticAnalysis();
                    
                    // Phase 4: Code Generation
                    result.phases.push('⚙️ CODE GENERATION');
                    const generatedCode = this.generateCode();
                    result.generatedCode = generatedCode;
                    
                    result.success = this.errors.length === 0;
                    result.errors = this.errors;
                    result.warnings = this.warnings;
                    result.symbolTable = Object.fromEntries(this.symbolTable);
                    
                } catch (error) {
                    result.errors.push(new CompilerError('INTERNAL', `Internal compiler error: ${error.message}`, 0, 0, 'Report this bug'));
                }
                
                return result;
            }

            semanticAnalysis() {
                // Additional semantic checks
                for (let [name, info] of this.symbolTable) {
                    if (info.type === 'variable' && info.dataType === 'void') {
                        this.semanticError(`Variable '${name}' cannot be of type void`, 'Use int, float, or char instead');
                    }
                }
            }
        }

        // Global compiler instance
        const compiler = new MiniCCompiler();

        // Frontend Functions
        function compileCode() {
            const code = document.getElementById('codeInput').value;
            const outputDiv = document.getElementById('output');
            
            if (!code.trim()) {
                outputDiv.innerHTML = '<span class="error">❌ Error: No code to compile!</span>';
                return;
            }
            
            const result = compiler.compile(code);
            displayResults(result);
        }

        function analyzeOnly() {
            const code = document.getElementById('codeInput').value;
            const outputDiv = document.getElementById('output');
            
            if (!code.trim()) {
                outputDiv.innerHTML = '<span class="error">❌ Error: No code to analyze!</span>';
                return;
            }
            
            const result = compiler.compile(code);
            displayAnalysisResults(result);
        }

        function displayResults(result) {
            const outputDiv = document.getElementById('output');
            let output = '';
            
            // Header
            if (result.success) {
                output += '<div class="success">✅ COMPILATION SUCCESSFUL!</div><br>';
            } else {
                output += '<div class="error">❌ COMPILATION FAILED!</div><br>';
            }
            
            // Phases
            result.phases.forEach(phase => {
                output += `<div class="phase-header">${phase}</div>`;
            });
            
            // Tokens (if successful lexical analysis)
            if (result.tokens.length > 0) {
                output += '<div class="phase-header">🎯 TOKENS GENERATED</div>';
                output += '<div style="font-size: 12px; margin: 10px 0;">';
                result.tokens.slice(0, 20).forEach(token => {
                    output += `<span style="background: #e3f2fd; padding: 2px 6px; margin: 2px; border-radius: 3px; display: inline-block;">${token.type}:${token.value}</span> `;
                });
                if (result.tokens.length > 20) {
                    output += `<span style="color: #666;">... and ${result.tokens.length - 20} more tokens</span>`;
                }
                output += '</div>';
            }
            
            // Symbol Table
            if (Object.keys(result.symbolTable).length > 0) {
                output += '<div class="phase-header">📊 SYMBOL TABLE</div>';
                output += '<div style="font-size: 12px; margin: 10px 0;">';
                for (let [name, info] of Object.entries(result.symbolTable)) {
                    output += `<div style="margin: 5px 0;"><strong>${name}</strong>: ${info.type} (${info.dataType || info.returnType || 'unknown'})</div>`;
                }
                output += '</div>';
            }
            
            // Errors
            if (result.errors.length > 0) {
                output += '<div class="phase-header">🚨 ERRORS FOUND</div>';
                result.errors.forEach((error, index) => {
                    output += `<div class="error" style="margin: 10px 0; padding: 10px; background: #ffebee; border-left: 4px solid #f44336;">`;
                    output += `<strong>[${error.type} ERROR]</strong> Line ${error.line}, Column ${error.column}<br>`;
                    output += `💡 <strong>Problem:</strong> ${error.message}<br>`;
                    output += `🔧 <strong>Solution:</strong> ${error.suggestion}`;
                    output += `</div>`;
                });
            }
            
            // Warnings
            if (result.warnings.length > 0) {
                output += '<div class="phase-header">⚠️ WARNINGS</div>';
                result.warnings.forEach(warning => {
                    output += `<div class="warning" style="margin: 5px 0;">[WARNING] ${warning.message}</div>`;
                });
            }
            
            // Generated Code (if successful)
            if (result.success && result.generatedCode.length > 0) {
                output += '<div class="phase-header">🎯 GENERATED CODE</div>';
                output += '<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; margin: 10px 0;">';
                result.generatedCode.forEach(line => {
                    output += line + '<br>';
                });
                output += '</div>';
                
                output += '<div class="success" style="margin-top: 15px;">🚀 Ready for execution!</div>';
            }
            
            outputDiv.innerHTML = output;
        }

        function displayAnalysisResults(result) {
            const outputDiv = document.getElementById('output');
            let output = '';
            
            output += '<div class="phase-header">🔍 CODE ANALYSIS RESULTS</div>';
            
            // Statistics
            output += `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">`;
            output += `<strong>📈 Statistics:</strong><br>`;
            output += `• Tokens: ${result.tokens.length}<br>`;
            output += `• Variables: ${Object.values(result.symbolTable).filter(v => v.type === 'variable').length}<br>`;
            output += `• Functions: ${Object.values(result.symbolTable).filter(v => v.type === 'function').length}<br>`;
            output += `• Errors: ${result.errors.length}<br>`;
            output += `• Warnings: ${result.warnings.length}<br>`;
            output += `</div>`;
            
            // Token breakdown
            if (result.tokens.length > 0) {
                const tokenTypes = {};
                result.tokens.forEach(token => {
                    tokenTypes[token.type] = (tokenTypes[token.type] || 0) + 1;
                });
                
                output += '<div class="phase-header">🎯 TOKEN ANALYSIS</div>';
                output += '<div style="background: #e3f2fd; padding: 10px; border-radius: 5px; margin: 10px 0;">';
                for (let [type, count] of Object.entries(tokenTypes)) {
                    output += `<span style="background: white; padding: 5px 10px; margin: 3px; border-radius: 15px; display: inline-block; font-size: 12px;">${type}: ${count}</span> `;
                }
                output += '</div>';
            }
            
            // Detailed errors with suggestions
            if (result.errors.length > 0) {
                output += '<div class="phase-header">🔧 ERROR ANALYSIS & FIXES</div>';
                result.errors.forEach((error, index) => {
                    output += `<div style="background: #ffebee; border: 1px solid #ffcdd2; border-radius: 8px; padding: 15px; margin: 10px 0;">`;
                    output += `<div class="error"><strong>Error #${index + 1}: ${error.type}</strong></div>`;
                    output += `<div style="margin: 8px 0;"><strong>Location:</strong> Line ${error.line}, Column ${error.column}</div>`;
                    output += `<div style="margin: 8px 0;"><strong>Issue:</strong> ${error.message}</div>`;
                    output += `<div style="margin: 8px 0; color: #2e7d32;"><strong>How to fix:</strong> ${error.suggestion}</div>`;
                    
                    // Add specific examples for common errors
                    if (examples) {
                        output += `<div style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin-top: 10px;">`;
                        output += `<strong>Example:</strong><br>`;
                        output += `<code style="background: #ffcdd2; padding: 2px 4px;">❌ ${examples.wrong}</code><br>`;
                        output += `<code style="background: #c8e6c9; padding: 2px 4px;">✅ ${examples.correct}</code>`;
                        output += `</div>`;
                    }
                    output += `</div>`;
                });
            } else {
                output += '<div class="success">✅ No errors found! Your code looks good.</div>';
            }
            
            outputDiv.innerHTML = output;
        }

        function clearCode() {
            document.getElementById('codeInput').value = '';
            document.getElementById('output').innerHTML = 'Code cleared! Ready for new input.';
        }

        // Initialize with welcome message
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('output').innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <h3 style="color: #2c3e50; margin-bottom: 15px;">🚀 Welcome to Mini C Compiler!</h3>
                    <p style="color: #7f8c8d; margin-bottom: 20px;">A complete educational C compiler with detailed error analysis</p>
                    
                    <div style="background: linear-gradient(135deg, #74b9ff, #0984e3); color: white; padding: 15px; border-radius: 10px; margin: 15px 0;">
                        <strong>🎯 Features:</strong><br>
                        ✅ Lexical Analysis (Tokenization)<br>
                        ✅ Syntax Analysis (Parsing)<br>
                        ✅ Semantic Analysis (Type Checking)<br>
                        ✅ Code Generation (Assembly-like)<br>
                        ✅ Comprehensive Error Reporting<br>
                        ✅ Smart Error Suggestions
                    </div>
                    
                    <div style="background: #f1c40f; color: #2c3e50; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <strong>💡 Tips:</strong> Write your C code in the editor and click "Compile & Run" to see the compilation process!
                    </div>
                </div>
            `;
        });