#include "validacion_cadenas.h"
#include <queue>
#include <map>
#include <set>

using namespace std;

/**
 * @brief Estructura para rastrear el estado de exploración BFS
 */
struct EstadoExploracion {
    string estado;
    int posicion;

    bool operator<(const EstadoExploracion &other) const {
        if (estado != other.estado) return estado < other.estado;
        return posicion < other.posicion;
    }
};

std::set<std::string> validarCadena(const Transition &t,
                                    const std::string &estadoInicial,
                                    const std::string &cadena) {
    set<string> estadosFinales;
    set<EstadoExploracion> visitados;
    queue<EstadoExploracion> cola;

    // Comenzar desde el estado inicial en posición 0
    cola.push({estadoInicial, 0});
    visitados.insert({estadoInicial, 0});

    while (!cola.empty()) {
        EstadoExploracion actual = cola.front();
        cola.pop();

        // Si ya procesamos toda la cadena, este es un estado final alcanzable
        if (actual.posicion == cadena.size()) {
            estadosFinales.insert(actual.estado);
            continue;
        }

        // Obtener el símbolo actual
        char simbolo = cadena[actual.posicion];

        // Obtener todos los posibles estados siguientes
        vector<string> siguientes = t.getNextStates(actual.estado, simbolo);

        // Explorar cada transición posible
        for (const string &siguienteEstado : siguientes) {
            EstadoExploracion nuevoEstado = {siguienteEstado, actual.posicion + 1};

            // Solo procesar si no hemos visitado este estado en esta posición
            if (visitados.find(nuevoEstado) == visitados.end()) {
                visitados.insert(nuevoEstado);
                cola.push(nuevoEstado);
            }
        }
    }

    return estadosFinales;
}

/**
 * @brief Verifica si una cadena es aceptada por el autómata
 *
 * @param t Transiciones del autómata
 * @param estadoInicial Estado inicial del autómata
 * @param estadosFinales Conjunto de estados de aceptación
 * @param cadena Cadena a verificar
 * @return true si la cadena es aceptada, false en caso contrario
 */
bool esAceptada(const Transition &t,
                const string &estadoInicial,
                const set<string> &estadosFinales,
                const string &cadena) {
    set<string> estadosAlcanzados = validarCadena(t, estadoInicial, cadena);

    // Verificar si alguno de los estados alcanzados es un estado final
    for (const string &estado : estadosAlcanzados) {
        if (estadosFinales.count(estado) > 0) {
            return true;
        }
    }

    return false;
}

/**
 * @brief Genera todas las cadenas aceptadas hasta una longitud máxima
 *
 * @param t Transiciones del autómata
 * @param estadoInicial Estado inicial del autómata
 * @param estadosFinales Conjunto de estados de aceptación
 * @param alfabeto Vector con los símbolos del alfabeto
 * @param longitudMaxima Longitud máxima de las cadenas a generar
 * @return vector<string> Vector con todas las cadenas aceptadas
 */
vector<string> generarCadenasAceptadas(const Transition &t,
                                       const string &estadoInicial,const set<string> &estadosFinales,
                                       const vector<char> &alfabeto,
                                       int longitudMaxima) {
    vector<string> cadenasAceptadas;
    queue<pair<string, string>> cola; // (estado actual, cadena formada)

    // Verificar si la cadena vacía es aceptada
    if (estadosFinales.count(estadoInicial) > 0) {
        cadenasAceptadas.push_back("");
    }

    // Inicializar con el estado inicial y cadena vacía
    cola.push({estadoInicial, ""});

    while (!cola.empty()) {
        auto [estadoActual, cadenaActual] = cola.front();
        cola.pop();

        // Si alcanzamos la longitud máxima, no expandir más
        if (cadenaActual.size() >= longitudMaxima) {
            continue;
        }

        // Probar cada símbolo del alfabeto
        for (char simbolo : alfabeto) {
            vector<string> siguientes = t.getNextStates(estadoActual, simbolo);

            for (const string &siguienteEstado : siguientes) {
                string nuevaCadena = cadenaActual + simbolo;

                // Si llegamos a un estado final, agregar la cadena
                if (estadosFinales.count(siguienteEstado) > 0) {
                    cadenasAceptadas.push_back(nuevaCadena);
                }

                // Continuar explorando si no hemos alcanzado la longitud máxima
                if (nuevaCadena.size() < longitudMaxima) {
                    cola.push({siguienteEstado, nuevaCadena});
                }
            }
        }
    }

    return cadenasAceptadas;
}

/**
 * @brief Genera todas las combinaciones posibles limitando ciclos
 *
 * Esta versión es más eficiente para autómatas con ciclos,
 * limitando la exploración de caminos repetitivos.
 *
 * @param t Transiciones del autómata
 * @param estadoInicial Estado inicial del autómata
 * @param estadosFinales Conjunto de estados de aceptación
 * @param alfabeto Vector con los símbolos del alfabeto
 * @param longitudMaxima Longitud máxima de las cadenas
 * @param limiteCiclos Límite de veces que se puede visitar un estado
 * @return vector<string> Vector con cadenas aceptadas
 */
vector<string> generarCadenasConLimite(const Transition &t,
                                       const string &estadoInicial,
                                       const set<string> &estadosFinales,
                                       const vector<char> &alfabeto,
                                       int longitudMaxima,
                                       int limiteCiclos) {
    vector<string> cadenasAceptadas;

    // Estructura: (estado, cadena, mapa de visitas por estado)
    struct Exploracion {
        string estado;
        string cadena;
        map<string, int> visitas;
    };

    queue<Exploracion> cola;

    // Verificar cadena vacía
    if (estadosFinales.count(estadoInicial) > 0) {
        cadenasAceptadas.push_back("");
    }

    // Inicializar
    Exploracion inicial;
    inicial.estado = estadoInicial;
    inicial.cadena = "";
    inicial.visitas[estadoInicial] = 1;
    cola.push(inicial);

    while (!cola.empty()) {
        Exploracion actual = cola.front();
        cola.pop();

        if (actual.cadena.size() >= longitudMaxima) {
            continue;
        }

        for (char simbolo : alfabeto) {
            vector<string> siguientes = t.getNextStates(actual.estado, simbolo);

            for (const string &siguienteEstado : siguientes) {
                Exploracion nueva;
                nueva.estado = siguienteEstado;
                nueva.cadena = actual.cadena + simbolo;
                nueva.visitas = actual.visitas;
                nueva.visitas[siguienteEstado]++;

                // Limitar ciclos
                if (nueva.visitas[siguienteEstado] > limiteCiclos) {
                    continue;
                }

                // Si es estado final, guardar
                if (estadosFinales.count(siguienteEstado) > 0) {
                    cadenasAceptadas.push_back(nueva.cadena);
                }

                // Continuar explorando
                if (nueva.cadena.size() < longitudMaxima) {
                    cola.push(nueva);
                }
            }
        }
    }

    return cadenasAceptadas;
}