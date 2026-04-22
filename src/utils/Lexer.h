#ifndef LEXER_H
#define LEXER_H

#include <vector>
#include <string>

// --- Todos los tipos de token requeridos por el reto ---
enum TokenType {
    // Requerimientos de Etapa 3
    URL,
    PLACA_AGS,
    EMAIL_UAA,

    // Requerimientos de Etapa 4: Palabras Clave y Tipos
    CLASS, EXTENDS,
    TIPO_INT, TIPO_FLOAT, TIPO_DOUBLE, TIPO_BOOLEAN, TIPO_CHAR, TIPO_STRING, TIPO_VOID,
    IF, WHILE, DO, SWITCH, ELSE, MAIN, NEW, TRUE, FALSE,

    // Control de acceso
    PRIVATE, PUBLIC, PROTECTED,

    // Identificadores y Literales
    IDENTIFICADOR,
    NUMERO_ENTERO,
    NUMERO_FLOTANTE,

    // Operadores
    OP_ASIGNACION,      // =
    OP_COMPARACION,     // ==
    OP_DIFERENTE,       // !=
    OP_MENOR,           // <
    OP_MAYOR,           // >
    OP_MENOR_IGUAL,     // <=
    OP_MAYOR_IGUAL,     // >=
    OP_SUMA,            // +
    OP_RESTA,           // -
    OP_MULT,            // *
    OP_DIV,             // /

    // Delimitadores y Separadores
    LLAVE_ABRE,         // {
    LLAVE_CIERRA,       // }
    PARENTESIS_ABRE,    // (
    PARENTESIS_CIERRA,  // )
    CORCHETE_ABRE,      // [
    CORCHETE_CIERRA,    // ]
    PUNTO_Y_COMA,       // ;
    COMA,               // ,
    PUNTO,              // .

    // Token para errores o símbolos no reconocidos
    DESCONOCIDO
};

// La estructura del Token ahora usa nuestro enum
struct Token {
    TokenType type;
    std::string lexeme;
};

// La firma de la función que será generada por Flex
std::vector<Token> tokenize(const char* text);

#endif // LEXER_H
