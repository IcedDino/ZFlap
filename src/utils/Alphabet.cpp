#include "Alphabet.h"
#include <set>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cctype>

using namespace std;

// Strips leading and trailing whitespace from s.
static string trim(const string &s) {
    size_t start = 0;
    while (start < s.size() && isspace(static_cast<unsigned char>(s[start]))) ++start;
    size_t end = s.size();
    while (end > start && isspace(static_cast<unsigned char>(s[end - 1]))) --end;
    return s.substr(start, end - start);
}

vector<char> parseAlphabet(const string &input) {
    vector<char> result;
    set<char> seen;

    if (input.empty()) {
        throw invalid_argument("Error: alphabet cannot be empty.");
    }

    if (input.front() != '(' || input.back() != ')') {
        throw invalid_argument("Error: alphabet must be enclosed in parentheses ( ).");
    }

    string content = input.substr(1, input.size() - 2);

    if (content.empty()) {
        throw invalid_argument("Error: alphabet cannot be empty.");
    }

    stringstream ss(content);
    string rawToken;
    while (getline(ss, rawToken, ',')) {
        // An empty token means two adjacent commas, e.g. "(a,,b)".
        if (rawToken.empty()) {
            throw invalid_argument("Error: each symbol must be a single character.");
        }

        string trimmed = trim(rawToken);

        char c;
        if (trimmed.size() == 1) {
            c = trimmed[0];
        } else if (trimmed.empty()) {
            // rawToken was all spaces — accept a single space as a valid symbol.
            if (rawToken.size() == 1) {
                c = rawToken[0];
            } else {
                throw invalid_argument("Error: each symbol must be a single character.");
            }
        } else {
            // Multi-character token, e.g. "ab".
            throw invalid_argument("Error: each symbol must be a single character.");
        }

        if (seen.count(c)) {
            throw invalid_argument("Error: duplicate symbol in alphabet.");
        }

        seen.insert(c);
        result.push_back(c);
    }

    if (result.empty()) {
        throw invalid_argument("Error: alphabet cannot be empty.");
    }

    return result;
}
