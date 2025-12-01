#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <vector>
#include <set>

#include "Lexer.h" 
#include "AdP.h" // Include AdP.h

// --- Forward Declarations ---
class QWidget;
class QVBoxLayout;
class QHBoxLayout;
class QPushButton;
class QLabel;
class QDialog;
class QLineEdit;
class QTextEdit;
class QListWidget;
class QTabWidget;
class QTableWidget;
class QSplitter;
class AutomatonEditor;
class AlphabetSelector;
class QComboBox; // Added for automaton type selection

// --- Estructuras de Datos para Analizadores ---
struct LexicalRule {
    QString tokenName;
    QString regexPattern;
};

struct SyntacticRule {
    QString patternName;
    QStringList tokenSequence;
};

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    // Enum for automaton types
    enum AutomatonType {
        FiniteAutomaton,
        StackAutomaton,
        TuringMachine
    };

    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    // Slots para Autómatas
    void onCreateAutomaton();
    void onSelectAutomaton();
    void onCreateNewAutomaton();
    void onSelectAlphabet();
    void onCancelCreate();
    void onCancelSelect();

    // Slot para Analizador Estático (Reto)
    void onStaticLexerAnalyze();

    // Slots para Analizador Dinámico
    void onDynamicLexerAnalyze();
    void onAddLexicalRule();      // Slot para el botón
    void onRemoveLexicalRule();
    void onAddSyntacticRule();    // Slot para el botón
    void onRemoveSyntacticRule();

private:
    // --- Métodos de Configuración de UI ---
    void setupUI();
    void setupStyling();
    void createMainMenuTab();
    void createStaticLexerTab();
    void createDynamicLexerTab();
    void createAutomatonDialogs();

    // --- Lógica de Backend ---
    void openEditorWithFile(const QString& filePath);
    void loadSelectedAutomaton(const QString& automatonName);
    void setupButtonAnimation(QPushButton* button);
    
    // Funciones de ayuda (¡Nombres diferentes a los slots!)
    void addLexicalRule(const QString& name = "NUEVO_TOKEN", const QString& pattern = "regex");
    void addSyntacticRule(const QString& name = "NUEVO_PATRON", const QString& sequence = "TOKEN1 TOKEN2");

    // Motores de Análisis
    void checkForPatterns(const std::vector<Token>& tokens); // Para el estático
    std::vector<std::pair<QString, QString>> dynamicTokenize(const QString& text, const std::vector<LexicalRule>& rules);
    QStringList findSyntacticPatterns(const std::vector<std::pair<QString, QString>>& tokens, const std::vector<SyntacticRule>& rules);

    // --- Componentes Globales ---
    QTabWidget *mainTabWidget;

    // --- Pestaña Principal ---
    QPushButton *createAutomatonButton;
    QPushButton *selectAutomatonButton;

    // --- Analizador Estático (Reto) ---
    QTextEdit *staticLexerInput;
    QTextEdit *staticLexerOutput;

    // --- Analizador Dinámico ---
    QTableWidget *lexicalRuleTable;
    QPushButton *addLexicalRuleButton;
    QPushButton *removeLexicalRuleButton;
    
    QTableWidget *syntacticRuleTable;
    QPushButton *addSyntacticRuleButton;
    QPushButton *removeSyntacticRuleButton;
    
    QTextEdit *dynamicLexerInput;
    QTextEdit *dynamicLexerOutput;

    // --- Diálogos de Autómatas ---
    QDialog *createDialog;
    QLineEdit *automatonNameEdit;
    QTextEdit *descriptionEdit;
    QPushButton *selectAlphabetButton;
    QLabel *selectedAlphabetLabel;
    QComboBox *automatonTypeComboBox; // Added for automaton type selection
    QComboBox *initialStackSymbolComboBox; // Added for initial stack symbol
    
    QDialog *selectDialog;
    QListWidget *automatonList;

    // --- Clases de Ayuda y Datos ---
    AlphabetSelector *alphabetSelector;
    std::set<char> selectedAlphabet;
    char initialStackSymbol; // Member to store the initial stack symbol
    
    // --- Estilos ---
    QFont titleFont;
    QFont buttonFont;
    QFont textFont;
};

#endif // MAINWINDOW_H
