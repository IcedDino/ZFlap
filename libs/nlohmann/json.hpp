
#ifndef NLOHMANN_JSON_HPP
#define NLOHMANN_JSON_HPP

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <stdexcept>
#include <sstream>

namespace nlohmann {
    class json {
    public:
        enum class value_t {
            null, object, array, string, boolean, number_integer, number_unsigned, number_float
        };

        json() : m_type(value_t::null) {}
        json(std::nullptr_t) : m_type(value_t::null) {}
        json(const std::string& value) : m_type(value_t::string), m_value_string(value) {}
        json(const char* value) : m_type(value_t::string), m_value_string(value) {}
        json(bool value) : m_type(value_t::boolean), m_value_boolean(value) {}
        json(int value) : m_type(value_t::number_integer), m_value_integer(value) {}
        json(unsigned value) : m_type(value_t::number_unsigned), m_value_unsigned(value) {}
        json(double value) : m_type(value_t::number_float), m_value_float(value) {}

        static json object() {
            return json(value_t::object);
        }

        static json array() {
            return json(value_t::array);
        }

        void push_back(const json& j) {
            if (m_type != value_t::array) {
                if (m_type == value_t::null) {
                    m_type = value_t::array;
                } else {
                    throw std::runtime_error("Not an array");
                }
            }
            m_value_array.push_back(j);
        }

        json& operator[](const std::string& key) {
            if (m_type != value_t::object) {
                if (m_type == value_t::null) {
                    m_type = value_t::object;
                } else {
                    throw std::runtime_error("Not an object");
                }
            }
            return m_value_object[key];
        }

        std::string dump(int indent = -1) const {
            std::stringstream ss;
            dump(ss, indent, 0);
            return ss.str();
        }

        static json parse(const std::string& s) {
            auto it = s.begin();
            return parse_value(it, s.end());
        }

        bool is_string() const { return m_type == value_t::string; }
        const std::string& get_string() const {
            if (!is_string()) throw std::runtime_error("Not a string");
            return m_value_string;
        }

    private:
        json(value_t type) : m_type(type) {}

        void dump(std::stringstream& ss, int indent, int level) const {
            switch (m_type) {
                case value_t::null:
                    ss << "null";
                    break;
                case value_t::object: {
                    ss << "{";
                    if (indent > 0) ss << "\n";
                    bool first = true;
                    for (const auto& el : m_value_object) {
                        if (!first) {
                            ss << ",";
                            if (indent > 0) ss << "\n";
                        }
                        if (indent > 0) ss << std::string(indent * (level + 1), ' ');
                        ss << "\"" << el.first << "\":";
                        if (indent > 0) ss << " ";
                        el.second.dump(ss, indent, level + 1);
                        first = false;
                    }
                    if (indent > 0) ss << "\n" << std::string(indent * level, ' ');
                    ss << "}";
                    break;
                }
                case value_t::array: {
                    ss << "[";
                    if (indent > 0) ss << "\n";
                    bool first = true;
                    for (const auto& el : m_value_array) {
                        if (!first) {
                            ss << ",";
                            if (indent > 0) ss << "\n";
                        }
                        if (indent > 0) ss << std::string(indent * (level + 1), ' ');
                        el.dump(ss, indent, level + 1);
                        first = false;
                    }
                    if (indent > 0) ss << "\n" << std::string(indent * level, ' ');
                    ss << "]";
                    break;
                }
                case value_t::string:
                    ss << "\"" << m_value_string << "\"";
                    break;
                case value_t::boolean:
                    ss << (m_value_boolean ? "true" : "false");
                    break;
                case value_t::number_integer:
                    ss << m_value_integer;
                    break;
                case value_t::number_unsigned:
                    ss << m_value_unsigned;
                    break;
                case value_t::number_float:
                    ss << m_value_float;
                    break;
            }
        }

        static void skip_whitespace(std::string::const_iterator& it, const std::string::const_iterator& end) {
            while (it != end && std::isspace(*it)) {
                ++it;
            }
        }

        static json parse_value(std::string::const_iterator& it, const std::string::const_iterator& end) {
            skip_whitespace(it, end);
            if (it == end) throw std::runtime_error("Unexpected end of input");

            switch (*it) {
                case '{':
                    return parse_object(it, end);
                case '[':
                    return parse_array(it, end);
                case '"':
                    return parse_string(it, end);
                case 't':
                case 'f':
                    return parse_boolean(it, end);
                case 'n':
                    return parse_null(it, end);
                default:
                    if (*it == '-' || std::isdigit(*it)) {
                        return parse_number(it, end);
                    }
                    throw std::runtime_error("Unexpected character");
            }
        }

        static json parse_object(std::string::const_iterator& it, const std::string::const_iterator& end) {
            json obj = json::object();
            ++it; // consume '{'
            skip_whitespace(it, end);

            if (*it == '}') {
                ++it;
                return obj;
            }

            while (true) {
                json key = parse_string(it, end);
                skip_whitespace(it, end);
                if (*it != ':') throw std::runtime_error("Expected ':' in object");
                ++it; // consume ':'
                skip_whitespace(it, end);
                json value = parse_value(it, end);
                obj[key.get_string()] = value;
                skip_whitespace(it, end);

                if (*it == '}') {
                    ++it;
                    break;
                }
                if (*it != ',') throw std::runtime_error("Expected ',' or '}' in object");
                ++it; // consume ','
                skip_whitespace(it, end);
            }
            return obj;
        }

        static json parse_array(std::string::const_iterator& it, const std::string::const_iterator& end) {
            json arr = json::array();
            ++it; // consume '['
            skip_whitespace(it, end);

            if (*it == ']') {
                ++it;
                return arr;
            }

            while (true) {
                arr.push_back(parse_value(it, end));
                skip_whitespace(it, end);

                if (*it == ']') {
                    ++it;
                    break;
                }
                if (*it != ',') throw std::runtime_error("Expected ',' or ']' in array");
                ++it; // consume ','
                skip_whitespace(it, end);
            }
            return arr;
        }

        static json parse_string(std::string::const_iterator& it, const std::string::const_iterator& end) {
            ++it; // consume '"'
            std::string s;
            while (it != end && *it != '"') {
                s += *it;
                ++it;
            }
            if (it == end) throw std::runtime_error("Unterminated string");
            ++it; // consume '"'
            return json(s);
        }

        static json parse_boolean(std::string::const_iterator& it, const std::string::const_iterator& end) {
            if (std::string(it, it + 4) == "true") {
                it += 4;
                return json(true);
            }
            if (std::string(it, it + 5) == "false") {
                it += 5;
                return json(false);
            }
            throw std::runtime_error("Invalid boolean value");
        }

        static json parse_null(std::string::const_iterator& it, const std::string::const_iterator& end) {
            if (std::string(it, it + 4) == "null") {
                it += 4;
                return json(nullptr);
            }
            throw std::runtime_error("Invalid null value");
        }

        static json parse_number(std::string::const_iterator& it, const std::string::const_iterator& end) {
            auto start = it;
            bool is_float = false;
            while (it != end && (*it == '-' || std::isdigit(*it) || *it == '.')) {
                if (*it == '.') is_float = true;
                ++it;
            }
            std::string num_str(start, it);
            if (is_float) {
                return json(std::stod(num_str));
            }
            return json(std::stoi(num_str));
        }

        value_t m_type;
        union {
            std::map<std::string, json> m_value_object;
            std::vector<json> m_value_array;
            std::string m_value_string;
            bool m_value_boolean;
            int m_value_integer;
            unsigned m_value_unsigned;
            double m_value_float;
        };

        // Destructor and copy/move constructors/assignments are needed for proper memory management
        // This is a simplified version and omits them for brevity.
    };
}

#endif // NLOHMANN_JSON_HPP
