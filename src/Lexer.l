%{
#include "Lexer.h"
#include <vector>
#include <string>

std::vector<Token> tokens;
%}

%option noyywrap

/* --- Macros (Definiciones para reutilizar) --- */
LETRA       [a-zA-Z]
DIGITO      [0-9]
ID_CHAR     [a-zA-Z0-9_]
ID_START    [a-zA-Z_]

%%
https?:\/\/[a-zA-Z0-9_.-]+          { tokens.push_back({URL, yytext}); }
AE{LETRA}-{DIGITO}{3}-{LETRA}       { tokens.push_back({PLACA_AGS, yytext}); }
(a|l|L){DIGITO}{6}@uaa\.mx          { tokens.push_back({EMAIL_UAA, yytext}); }

"class"     { tokens.push_back({CLASS, yytext}); }
"extends"   { tokens.push_back({EXTENDS, yytext}); }
"int"       { tokens.push_back({TIPO_INT, yytext}); }
"float"     { tokens.push_back({TIPO_FLOAT, yytext}); }
"double"    { tokens.push_back({TIPO_DOUBLE, yytext}); }
"boolean"   { tokens.push_back({TIPO_BOOLEAN, yytext}); }
"char"      { tokens.push_back({TIPO_CHAR, yytext}); }
"String"    { tokens.push_back({TIPO_STRING, yytext}); }
"void"      { tokens.push_back({TIPO_VOID, yytext}); }
"if"        { tokens.push_back({IF, yytext}); }
"while"     { tokens.push_back({WHILE, yytext}); }
"do"        { tokens.push_back({DO, yytext}); }
"switch"    { tokens.push_back({SWITCH, yytext}); }
"else"      { tokens.push_back({ELSE, yytext}); }
"main"      { tokens.push_back({MAIN, yytext}); }
"new"       { tokens.push_back({NEW, yytext}); }
"true"      { tokens.push_back({TRUE, yytext}); }
"false"     { tokens.push_back({FALSE, yytext}); }
"private"   { tokens.push_back({PRIVATE, yytext}); }
"public"    { tokens.push_back({PUBLIC, yytext}); }
"protected" { tokens.push_back({PROTECTED, yytext}); }

{ID_START}{ID_CHAR}*   { tokens.push_back({IDENTIFICADOR, yytext}); }
{DIGITO}+\.{DIGITO}+    { tokens.push_back({NUMERO_FLOTANTE, yytext}); }
{DIGITO}+               { tokens.push_back({NUMERO_ENTERO, yytext}); }

"=="    { tokens.push_back({OP_COMPARACION, yytext}); }
"!="    { tokens.push_back({OP_DIFERENTE, yytext}); }
"<="    { tokens.push_back({OP_MENOR_IGUAL, yytext}); }
">="    { tokens.push_back({OP_MAYOR_IGUAL, yytext}); }
"="     { tokens.push_back({OP_ASIGNACION, yytext}); }
"<"     { tokens.push_back({OP_MENOR, yytext}); }
">"     { tokens.push_back({OP_MAYOR, yytext}); }
"+"     { tokens.push_back({OP_SUMA, yytext}); }
"-"     { tokens.push_back({OP_RESTA, yytext}); }
"*"     { tokens.push_back({OP_MULT, yytext}); }
"/"     { tokens.push_back({OP_DIV, yytext}); }

"{"     { tokens.push_back({LLAVE_ABRE, yytext}); }
"}"     { tokens.push_back({LLAVE_CIERRA, yytext}); }
"("     { tokens.push_back({PARENTESIS_ABRE, yytext}); }
")"     { tokens.push_back({PARENTESIS_CIERRA, yytext}); }
"["     { tokens.push_back({CORCHETE_ABRE, yytext}); }
"]"     { tokens.push_back({CORCHETE_CIERRA, yytext}); }
";"     { tokens.push_back({PUNTO_Y_COMA, yytext}); }
","     { tokens.push_back({COMA, yytext}); }
"."     { tokens.push_back({PUNTO, yytext}); }

[ \t\n\r]+  { /* Ignorar espacios en blanco */ }

.       { tokens.push_back({DESCONOCIDO, yytext}); }

%%

std::vector<Token> tokenize(const char* text) {
    tokens.clear();
    yy_scan_string(text);
    yylex();
    return tokens;
}
