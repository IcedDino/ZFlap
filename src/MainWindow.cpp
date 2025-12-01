#include "MainWindow.h"
#include "AutomatonEditor.h"
#include "AlphabetSelector.h"

#include <QApplication>
#include <QScreen>
#include <QMessageBox>
#include <QHeaderView>
#include <QSplitter>
#include <QSettings>
#include <QFileInfo>
#include <regex>
#include <algorithm>

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QLabel>
#include <QDialog>
#include <QLineEdit>
#include <QTextEdit>
#include <QListWidget>
#include <QTabWidget>
#include <QTableWidget>
#include <QFont>
#include <QPalette>
#include <QComboBox> // Include QComboBox

// --- Estilos y Colores Mejorados ---
const QColor WARM_WHITE(255, 254, 245);
const QColor ZFLAP_YELLOW(240, 207, 96);
const QColor DARK_YELLOW(220, 187, 76);
const QColor ZFLAP_BLACK(0, 0, 0);
const QColor BORDER_GRAY(200, 200, 200);
const QColor BUTTON_GRAY(225, 225, 225);
const QColor LIGHT_GRAY(235, 235, 235);

const QString BUTTON_STYLE_PRIMARY = QString(
    "QPushButton { background-color: %1; color: %2; border: 1px solid %2; padding: 8px 16px; font-weight: bold; }"
    "QPushButton:hover { background-color: %3; }"
).arg(ZFLAP_YELLOW.name(), ZFLAP_BLACK.name(), DARK_YELLOW.name());

const QString BUTTON_STYLE_SECONDARY = QString(
    "QPushButton { background-color: %1; color: %2; border: 1px solid %3; padding: 8px 16px; }"
    "QPushButton:hover { border-color: %2; }"
).arg(BUTTON_GRAY.name(), ZFLAP_BLACK.name(), BORDER_GRAY.name());

const QString TEXT_EDIT_STYLE = "QTextEdit, QLineEdit, QListWidget, QComboBox { background-color: #FFFFFF; color: %1; border: 1px solid %2; border-radius: 4px; padding: 5px; }";
const QString TABLE_STYLE = "QTableWidget { background-color: #FFFFFF; border: 1px solid %1; gridline-color: %2; } QHeaderView::section { background-color: %3; color: %4; padding: 4px; border: 1px solid %1; font-weight: bold; } QTableWidget::item { color: %4; }";
const QString TAB_WIDGET_STYLE = QString(
    "QTabWidget::pane { border: none; background: %1; }"
    "QTabBar::tab { background: %2; color: %3; border: 1px solid %4; border-bottom: none; padding: 8px 20px; }"
    "QTabBar::tab:selected { background: %1; font-weight: bold; border-color: %4; border-bottom-color: %1; }"
    "QTabBar::tab:!selected:hover { background: %5; }"
).arg(WARM_WHITE.name(), BUTTON_GRAY.name(), ZFLAP_BLACK.name(), BORDER_GRAY.name(), DARK_YELLOW.name());
const QString SPLITTER_STYLE = "QSplitter::handle { background-color: %1; } QSplitter::handle:horizontal { width: 1px; } QSplitter::handle:vertical { height: 1px; }";
const QString LABEL_STYLE = "QLabel { color: %1; }";


MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent)
{
    setupStyling();
    setupUI();
    createMainMenuTab();
    createStaticLexerTab();
    createDynamicLexerTab();
    createAutomatonDialogs();
    alphabetSelector = new AlphabetSelector(this);
}

MainWindow::~MainWindow() {}

void MainWindow::setupUI()
{
    mainTabWidget = new QTabWidget(this);
    mainTabWidget->setStyleSheet(TAB_WIDGET_STYLE);
    setCentralWidget(mainTabWidget);
    setWindowTitle("ZFlap - Integrated Tool");
    resize(1400, 900);
}

void MainWindow::setupStyling()
{
    QPalette palette;
    palette.setColor(QPalette::Window, WARM_WHITE);
    palette.setColor(QPalette::WindowText, ZFLAP_BLACK);
    setPalette(palette);
    setAutoFillBackground(true);
    qApp->setStyleSheet(LABEL_STYLE.arg(ZFLAP_BLACK.name()));
    titleFont.setFamily("Charter");
    titleFont.setPointSize(36);
    titleFont.setBold(true);
    buttonFont.setFamily("Arial");
    buttonFont.setPointSize(12);
    textFont.setFamily("Arial");
    textFont.setPointSize(12);
}

void MainWindow::createMainMenuTab()
{
    auto* mainMenuTab = new QWidget();
    auto* layout = new QVBoxLayout(mainMenuTab);
    layout->setAlignment(Qt::AlignCenter);
    auto* titleLabel = new QLabel("ZFlap Automaton Manager", this);
    titleLabel->setFont(titleFont);
    layout->addWidget(titleLabel, 0, Qt::AlignHCenter);
    auto* buttonLayout = new QHBoxLayout();
    createAutomatonButton = new QPushButton("Crear Nuevo Autómata");
    selectAutomatonButton = new QPushButton("Seleccionar Autómata Existente");
    createAutomatonButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    selectAutomatonButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    buttonLayout->addWidget(createAutomatonButton);
    buttonLayout->addWidget(selectAutomatonButton);
    layout->addLayout(buttonLayout);
    mainTabWidget->addTab(mainMenuTab, "Gestor de Autómatas");
    connect(createAutomatonButton, &QPushButton::clicked, this, &MainWindow::onCreateAutomaton);
    connect(selectAutomatonButton, &QPushButton::clicked, this, &MainWindow::onSelectAutomaton);
}

void MainWindow::createStaticLexerTab()
{
    auto* staticLexerTab = new QWidget();
    auto* layout = new QVBoxLayout(staticLexerTab);
    staticLexerInput = new QTextEdit();
    staticLexerInput->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    auto* staticLexerAnalyzeButton = new QPushButton("Analizar"); // <-- CAMBIO AQUÍ
    staticLexerAnalyzeButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    staticLexerOutput = new QTextEdit();
    staticLexerOutput->setReadOnly(true);
    staticLexerOutput->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    layout->addWidget(new QLabel("Texto de Entrada:"));
    layout->addWidget(staticLexerInput);
    layout->addWidget(staticLexerAnalyzeButton);
    layout->addWidget(new QLabel("Tokens Reconocidos:"));
    layout->addWidget(staticLexerOutput);
    mainTabWidget->addTab(staticLexerTab, "Analizador Léxico"); // <-- CAMBIO AQUÍ
    connect(staticLexerAnalyzeButton, &QPushButton::clicked, this, &MainWindow::onStaticLexerAnalyze);
}

void MainWindow::createDynamicLexerTab()
{
    auto* dynamicLexerTab = new QWidget();
    auto* mainLayout = new QVBoxLayout(dynamicLexerTab);
    QSplitter *mainSplitter = new QSplitter(Qt::Vertical, dynamicLexerTab);
    QWidget *topPanel = new QWidget();
    auto* topLayout = new QVBoxLayout(topPanel);
    QSplitter *ruleSplitter = new QSplitter(Qt::Horizontal, topPanel);
    ruleSplitter->setStyleSheet(SPLITTER_STYLE.arg(BORDER_GRAY.name()));
    QWidget *lexicalPanel = new QWidget();
    auto* lexicalLayout = new QVBoxLayout(lexicalPanel);
    lexicalRuleTable = new QTableWidget();
    lexicalRuleTable->setColumnCount(2);
    lexicalRuleTable->setHorizontalHeaderLabels({"Nombre de Token", "Expresión Regular"});
    lexicalRuleTable->horizontalHeader()->setStretchLastSection(true);
    lexicalRuleTable->setStyleSheet(TABLE_STYLE.arg(BORDER_GRAY.name(), LIGHT_GRAY.name(), ZFLAP_YELLOW.name(), ZFLAP_BLACK.name()));
    addLexicalRuleButton = new QPushButton("Añadir Token");
    addLexicalRuleButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    removeLexicalRuleButton = new QPushButton("Eliminar Token");
    removeLexicalRuleButton->setStyleSheet(BUTTON_STYLE_SECONDARY);
    lexicalLayout->addWidget(new QLabel("1. Define los Tokens (Léxico):"));
    lexicalLayout->addWidget(lexicalRuleTable);
    auto* lexicalButtons = new QHBoxLayout();
    lexicalButtons->addWidget(addLexicalRuleButton);
    lexicalButtons->addWidget(removeLexicalRuleButton);
    lexicalLayout->addLayout(lexicalButtons);
    lexicalPanel->setLayout(lexicalLayout);
    QWidget *syntacticPanel = new QWidget();
    auto* syntacticLayout = new QVBoxLayout(syntacticPanel);
    syntacticRuleTable = new QTableWidget();
    syntacticRuleTable->setColumnCount(2);
    syntacticRuleTable->setHorizontalHeaderLabels({"Nombre de Patrón", "Secuencia de Tokens (separados por espacio)"});
    syntacticRuleTable->horizontalHeader()->setStretchLastSection(true);
    syntacticRuleTable->setStyleSheet(TABLE_STYLE.arg(BORDER_GRAY.name(), LIGHT_GRAY.name(), ZFLAP_YELLOW.name(), ZFLAP_BLACK.name()));
    addSyntacticRuleButton = new QPushButton("Añadir Patrón");
    addSyntacticRuleButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    removeSyntacticRuleButton = new QPushButton("Eliminar Patrón");
    removeSyntacticRuleButton->setStyleSheet(BUTTON_STYLE_SECONDARY);
    syntacticLayout->addWidget(new QLabel("2. Define los Patrones (Sintaxis):"));
    syntacticLayout->addWidget(syntacticRuleTable);
    auto* syntacticButtons = new QHBoxLayout();
    syntacticButtons->addWidget(addSyntacticRuleButton);
    syntacticButtons->addWidget(removeSyntacticRuleButton);
    syntacticLayout->addLayout(syntacticButtons);
    syntacticPanel->setLayout(syntacticLayout);
    ruleSplitter->addWidget(lexicalPanel);
    ruleSplitter->addWidget(syntacticPanel);
    topLayout->addWidget(ruleSplitter);
    topPanel->setLayout(topLayout);
    QWidget *bottomPanel = new QWidget();
    auto* bottomLayout = new QVBoxLayout(bottomPanel);
    auto* analyzeSplitter = new QSplitter(Qt::Horizontal, bottomPanel);
    analyzeSplitter->setStyleSheet(SPLITTER_STYLE.arg(BORDER_GRAY.name()));
    QWidget *inputPanel = new QWidget();
    auto* inputLayout = new QVBoxLayout(inputPanel);
    dynamicLexerInput = new QTextEdit();
    dynamicLexerInput->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    inputLayout->addWidget(new QLabel("3. Escribe el código a analizar:"));
    inputLayout->addWidget(dynamicLexerInput);
    inputPanel->setLayout(inputLayout);
    QWidget *outputPanel = new QWidget();
    auto* outputLayout = new QVBoxLayout(outputPanel);
    dynamicLexerOutput = new QTextEdit();
    dynamicLexerOutput->setReadOnly(true);
    dynamicLexerOutput->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    outputLayout->addWidget(new QLabel("4. Resultados:"));
    outputLayout->addWidget(dynamicLexerOutput);
    outputPanel->setLayout(outputLayout);
    analyzeSplitter->addWidget(inputPanel);
    analyzeSplitter->addWidget(outputPanel);
    auto* analyzeButton = new QPushButton("Analizar Todo");
    analyzeButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    bottomLayout->addWidget(analyzeSplitter);
    bottomLayout->addWidget(analyzeButton);
    bottomPanel->setLayout(bottomLayout);
    mainSplitter->addWidget(topPanel);
    mainSplitter->addWidget(bottomPanel);
    mainLayout->addWidget(mainSplitter);
    mainTabWidget->addTab(dynamicLexerTab, "Creador de Lenguajes");
    connect(addLexicalRuleButton, &QPushButton::clicked, this, &MainWindow::onAddLexicalRule);
    connect(removeLexicalRuleButton, &QPushButton::clicked, this, &MainWindow::onRemoveLexicalRule);
    connect(addSyntacticRuleButton, &QPushButton::clicked, this, &MainWindow::onAddSyntacticRule);
    connect(removeSyntacticRuleButton, &QPushButton::clicked, this, &MainWindow::onRemoveSyntacticRule);
    connect(analyzeButton, &QPushButton::clicked, this, &MainWindow::onDynamicLexerAnalyze);
    addLexicalRule("TIPO_DATO", "int|float|string");
    addLexicalRule("IDENTIFICADOR", "[a-zA-Z_][a-zA-Z0-9_]*");
    addLexicalRule("ASIGNACION", "=");
    addLexicalRule("NUMERO", "[0-9]+(\\.[0-9]+)?");
    addLexicalRule("PUNTO_Y_COMA", ";");
    addLexicalRule("WHITESPACE", "\\s+");
    addSyntacticRule("DeclaracionVariable", "TIPO_DATO IDENTIFICADOR ASIGNACION NUMERO PUNTO_Y_COMA");
}

void MainWindow::createAutomatonDialogs() {
    createDialog = new QDialog(this);
    createDialog->setPalette(this->palette());
    createDialog->setWindowTitle("Crear Nuevo Autómata");
    auto* createLayout = new QVBoxLayout(createDialog);

    automatonNameEdit = new QLineEdit();
    automatonNameEdit->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    descriptionEdit = new QTextEdit();
    descriptionEdit->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));

    // Automaton Type Selector
    automatonTypeComboBox = new QComboBox();
    automatonTypeComboBox->setStyleSheet(QString(
        "QComboBox { background-color: %1; color: %2; border: 1px solid %3; border-radius: 4px; padding: 5px; }"
    ).arg(WARM_WHITE.name(), ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    automatonTypeComboBox->addItem("Autómata Finito", FiniteAutomaton);
    automatonTypeComboBox->addItem("Autómata de Pila", StackAutomaton);
    automatonTypeComboBox->addItem("Máquina de Turing", TuringMachine);

    // Initial Stack Symbol (for Stack Automaton)
    initialStackSymbolComboBox = new QComboBox();
    initialStackSymbolComboBox->setStyleSheet(QString(
        "QComboBox { background-color: %1; color: %2; border: 1px solid %3; border-radius: 4px; padding: 5px; }"
    ).arg(WARM_WHITE.name(), ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    initialStackSymbolComboBox->addItem("Z0"); // Default initial symbol

    selectAlphabetButton = new QPushButton("Seleccionar Alfabeto");
    selectAlphabetButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    selectedAlphabetLabel = new QLabel("Alfabeto: (ninguno)");

    auto* createConfirmButton = new QPushButton("Crear");
    createConfirmButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    auto* createCancelButton = new QPushButton("Cancelar");
    createCancelButton->setStyleSheet(BUTTON_STYLE_SECONDARY);

    createLayout->addWidget(new QLabel("Nombre:"));
    createLayout->addWidget(automatonNameEdit);
    createLayout->addWidget(new QLabel("Descripción:"));
    createLayout->addWidget(descriptionEdit);
    createLayout->addWidget(new QLabel("Tipo de Autómata:"));
    createLayout->addWidget(automatonTypeComboBox);
    createLayout->addWidget(new QLabel("Símbolo Inicial de Pila (solo para Autómata de Pila):"));
    createLayout->addWidget(initialStackSymbolComboBox);
    createLayout->addWidget(selectAlphabetButton);
    createLayout->addWidget(selectedAlphabetLabel);

    auto* createButtonLayout = new QHBoxLayout();
    createButtonLayout->addWidget(createConfirmButton);
    createButtonLayout->addWidget(createCancelButton);
    createLayout->addLayout(createButtonLayout);

    connect(selectAlphabetButton, &QPushButton::clicked, this, &MainWindow::onSelectAlphabet);
    connect(createConfirmButton, &QPushButton::clicked, this, &MainWindow::onCreateNewAutomaton);
    connect(createCancelButton, &QPushButton::clicked, this, &MainWindow::onCancelCreate);
    connect(automatonTypeComboBox, QOverload<int>::of(&QComboBox::currentIndexChanged), this, [this](int index){
        AutomatonType type = static_cast<AutomatonType>(automatonTypeComboBox->itemData(index).toInt());
        initialStackSymbolComboBox->setVisible(type == StackAutomaton);
        initialStackSymbolComboBox->setEnabled(type == StackAutomaton);
    });

    // Initialize visibility based on default selection
    initialStackSymbolComboBox->setVisible(false);
    initialStackSymbolComboBox->setEnabled(false);

    selectDialog = new QDialog(this);
    selectDialog->setPalette(this->palette());
    selectDialog->setWindowTitle("Seleccionar Autómata");
    auto* selectLayout = new QVBoxLayout(selectDialog);
    automatonList = new QListWidget();
    automatonList->setStyleSheet(TEXT_EDIT_STYLE.arg(ZFLAP_BLACK.name(), BORDER_GRAY.name()));
    auto* selectConfirmButton = new QPushButton("Seleccionar");
    selectConfirmButton->setStyleSheet(BUTTON_STYLE_PRIMARY);
    auto* selectCancelButton = new QPushButton("Cancelar");
    selectCancelButton->setStyleSheet(BUTTON_STYLE_SECONDARY);
    selectLayout->addWidget(automatonList);
    auto* selectButtonLayout = new QHBoxLayout();
    selectButtonLayout->addWidget(selectConfirmButton);
    selectButtonLayout->addWidget(selectCancelButton);
    selectLayout->addLayout(selectButtonLayout);
    connect(selectConfirmButton, &QPushButton::clicked, this, &MainWindow::onSelectAutomaton);
    connect(selectCancelButton, &QPushButton::clicked, this, &MainWindow::onCancelSelect);
}

void MainWindow::onAddLexicalRule() { addLexicalRule(); }
void MainWindow::addLexicalRule(const QString& name, const QString& pattern) { int newRow = lexicalRuleTable->rowCount(); lexicalRuleTable->insertRow(newRow); lexicalRuleTable->setItem(newRow, 0, new QTableWidgetItem(name)); lexicalRuleTable->setItem(newRow, 1, new QTableWidgetItem(pattern)); }
void MainWindow::onRemoveLexicalRule() { if (lexicalRuleTable->currentRow() >= 0) { lexicalRuleTable->removeRow(lexicalRuleTable->currentRow()); } else { QMessageBox::warning(this, "Sin selección", "Por favor, selecciona un token de la tabla para eliminar."); } }
void MainWindow::onAddSyntacticRule() { addSyntacticRule(); }
void MainWindow::addSyntacticRule(const QString& name, const QString& sequence) { int newRow = syntacticRuleTable->rowCount(); syntacticRuleTable->insertRow(newRow); syntacticRuleTable->setItem(newRow, 0, new QTableWidgetItem(name)); syntacticRuleTable->setItem(newRow, 1, new QTableWidgetItem(sequence)); }
void MainWindow::onRemoveSyntacticRule() { if (syntacticRuleTable->currentRow() >= 0) { syntacticRuleTable->removeRow(syntacticRuleTable->currentRow()); } else { QMessageBox::warning(this, "Sin selección", "Por favor, selecciona un patrón de la tabla para eliminar."); } }

void MainWindow::onDynamicLexerAnalyze() {
    std::vector<LexicalRule> lexicalRules;
    for (int i = 0; i < lexicalRuleTable->rowCount(); ++i) { if (lexicalRuleTable->item(i, 0) && lexicalRuleTable->item(i, 1)) { lexicalRules.push_back({lexicalRuleTable->item(i, 0)->text(), lexicalRuleTable->item(i, 1)->text()}); } }
    std::vector<SyntacticRule> syntacticRules;
    for (int i = 0; i < syntacticRuleTable->rowCount(); ++i) { if (syntacticRuleTable->item(i, 0) && syntacticRuleTable->item(i, 1)) { QStringList tokenSequence = syntacticRuleTable->item(i, 1)->text().split(' ', Qt::SkipEmptyParts); if (!tokenSequence.isEmpty()) { syntacticRules.push_back({syntacticRuleTable->item(i, 0)->text(), tokenSequence}); } } }
    auto tokens = dynamicTokenize(dynamicLexerInput->toPlainText(), lexicalRules);
    auto patternsFound = findSyntacticPatterns(tokens, syntacticRules);
    dynamicLexerOutput->clear();
    dynamicLexerOutput->append("--- TOKENS ENCONTRADOS (LÉXICO) ---\n");
    for (const auto& token : tokens) { dynamicLexerOutput->append(QString("[%1]: %2").arg(token.first).arg(token.second)); }
    if (!patternsFound.isEmpty()) { dynamicLexerOutput->append("\n--- PATRONES ENCONTRADOS (SINTAXIS) ---\n"); dynamicLexerOutput->append(patternsFound.join("\n")); }
}

QStringList MainWindow::findSyntacticPatterns(const std::vector<std::pair<QString, QString>>& tokens, const std::vector<SyntacticRule>& rules) {
    QStringList patternsFound;
    std::vector<QString> tokenNames;
    for(const auto& token : tokens) { tokenNames.push_back(token.first); }
    for (const auto& rule : rules) {
        if (rule.tokenSequence.isEmpty()) continue;
        auto search_start = tokenNames.begin();
        while(true) {
            auto it = std::search(search_start, tokenNames.end(), rule.tokenSequence.begin(), rule.tokenSequence.end());
            if (it == tokenNames.end()) break;
            size_t found_index = std::distance(tokenNames.begin(), it);
            patternsFound.append(QString("Se encontró el patrón '%1' en la posición de token %2.").arg(rule.patternName).arg(found_index));
            search_start = it + 1;
        }
    }
    return patternsFound;
}

std::vector<std::pair<QString, QString>> MainWindow::dynamicTokenize(const QString& text, const std::vector<LexicalRule>& rules) {
    std::vector<std::pair<QString, QString>> recognizedTokens;
    std::string stdText = text.toStdString();
    auto cursor = stdText.cbegin();
    auto end = stdText.cend();
    while (cursor != end) {
        std::smatch bestMatch;
        const LexicalRule* bestRule = nullptr;
        std::smatch::difference_type bestLength = 0;
        for (const auto& rule : rules) {
            try {
                std::regex currentRegex(rule.regexPattern.toStdString());
                std::smatch currentMatch;
                if (std::regex_search(cursor, end, currentMatch, currentRegex, std::regex_constants::match_continuous)) {
                    if (currentMatch.length() > bestLength) {
                        bestLength = currentMatch.length();
                        bestMatch = currentMatch;
                        bestRule = &rule;
                    }
                }
            } catch (const std::regex_error&) {}
        }
        if (bestRule) {
            if (bestRule->tokenName.toUpper() != "WHITESPACE") { recognizedTokens.push_back({bestRule->tokenName, QString::fromStdString(bestMatch.str())}); }
            cursor += bestMatch.length();
        } else {
            recognizedTokens.push_back({"DESCONOCIDO", QString(*cursor)});
            ++cursor;
        }
    }
    return recognizedTokens;
}

void MainWindow::onStaticLexerAnalyze() {
    QString text = staticLexerInput->toPlainText();
    std::vector<Token> tokens = tokenize(text.toStdString().c_str());
    QString result;
    for (const auto& token : tokens) {
        QString tokenTypeStr;
        switch (token.type) {
            case URL: tokenTypeStr = "URL"; break;
            case PLACA_AGS: tokenTypeStr = "Placa de Aguascalientes"; break;
            case EMAIL_UAA: tokenTypeStr = "Email Institucional UAA"; break;
            case CLASS: tokenTypeStr = "Palabra Clave: class"; break;
            case EXTENDS: tokenTypeStr = "Palabra Clave: extends"; break;
            case TIPO_INT: tokenTypeStr = "Tipo de Dato: int"; break;
            case TIPO_FLOAT: tokenTypeStr = "Tipo de Dato: float"; break;
            case TIPO_DOUBLE: tokenTypeStr = "Tipo de Dato: double"; break;
            case TIPO_BOOLEAN: tokenTypeStr = "Tipo de Dato: boolean"; break;
            case TIPO_CHAR: tokenTypeStr = "Tipo de Dato: char"; break;
            case TIPO_STRING: tokenTypeStr = "Tipo de Dato: String"; break;
            case TIPO_VOID: tokenTypeStr = "Tipo de Dato: void"; break;
            case IF: tokenTypeStr = "Palabra Clave: if"; break;
            case WHILE: tokenTypeStr = "Palabra Clave: while"; break;
            case DO: tokenTypeStr = "Palabra Clave: do"; break;
            case SWITCH: tokenTypeStr = "Palabra Clave: switch"; break;
            case ELSE: tokenTypeStr = "Palabra Clave: else"; break;
            case MAIN: tokenTypeStr = "Palabra Clave: main"; break;
            case NEW: tokenTypeStr = "Palabra Clave: new"; break;
            case TRUE: tokenTypeStr = "Booleano: true"; break;
            case FALSE: tokenTypeStr = "Booleano: false"; break;
            case PRIVATE: tokenTypeStr = "Control de Acceso: private"; break;
            case PUBLIC: tokenTypeStr = "Control de Acceso: public"; break;
            case PROTECTED: tokenTypeStr = "Control de Acceso: protected"; break;
            case IDENTIFICADOR: tokenTypeStr = "Identificador"; break;
            case NUMERO_ENTERO: tokenTypeStr = "Número Entero"; break;
            case NUMERO_FLOTANTE: tokenTypeStr = "Número Flotante"; break;
            case OP_ASIGNACION: tokenTypeStr = "Operador de Asignación"; break;
            case OP_COMPARACION: tokenTypeStr = "Operador de Comparación"; break;
            case OP_DIFERENTE: tokenTypeStr = "Operador Diferente de"; break;
            case OP_MENOR: tokenTypeStr = "Operador Menor que"; break;
            case OP_MAYOR: tokenTypeStr = "Operador Mayor que"; break;
            case OP_MENOR_IGUAL: tokenTypeStr = "Operador Menor o Igual que"; break;
            case OP_MAYOR_IGUAL: tokenTypeStr = "Operador Mayor o Igual que"; break;
            case OP_SUMA: tokenTypeStr = "Operador de Suma"; break;
            case OP_RESTA: tokenTypeStr = "Operador de Resta"; break;
            case OP_MULT: tokenTypeStr = "Operador de Multiplicación"; break;
            case OP_DIV: tokenTypeStr = "Operador de División"; break;
            case LLAVE_ABRE: tokenTypeStr = "Delimitador: Llave Abierta"; break;
            case LLAVE_CIERRA: tokenTypeStr = "Delimitador: Llave Cerrada"; break;
            case PARENTESIS_ABRE: tokenTypeStr = "Delimitador: Paréntesis Abierto"; break;
            case PARENTESIS_CIERRA: tokenTypeStr = "Delimitador: Paréntesis Cerrado"; break;
            case CORCHETE_ABRE: tokenTypeStr = "Delimitador: Corchete Abierto"; break;
            case CORCHETE_CIERRA: tokenTypeStr = "Delimitador: Corchete Cerrado"; break;
            case PUNTO_Y_COMA: tokenTypeStr = "Separador: Punto y Coma"; break;
            case COMA: tokenTypeStr = "Separador: Coma"; break;
            case PUNTO: tokenTypeStr = "Separador: Punto"; break;
            case DESCONOCIDO: tokenTypeStr = "Error: Símbolo Desconocido"; break;
        }
        result += QString("[%1]: %2\n").arg(tokenTypeStr).arg(token.lexeme.c_str());
    }
    staticLexerOutput->setText(result);
    checkForPatterns(tokens);
}
void MainWindow::checkForPatterns(const std::vector<Token>& tokens) {
    if (tokens.size() >= 8) {
        for (size_t i = 0; i <= tokens.size() - 8; ++i) {
            if (tokens[i].type == IDENTIFICADOR && tokens[i+1].type == IDENTIFICADOR && tokens[i+2].type == OP_ASIGNACION &&
                tokens[i+3].type == NEW && tokens[i+4].type == IDENTIFICADOR && tokens[i+5].type == PARENTESIS_ABRE &&
                tokens[i+6].type == PARENTESIS_CIERRA && tokens[i+7].type == PUNTO_Y_COMA) {
                staticLexerOutput->append(QString("\n--- PATRÓN ENCONTRADO ---\nInstanciación de Objeto: '%1' de clase '%2'.\n").arg(tokens[i+1].lexeme.c_str()).arg(tokens[i].lexeme.c_str()));
            }
        }
    }
}
void MainWindow::onCreateAutomaton() {
    automatonNameEdit->clear();
    descriptionEdit->clear();
    selectedAlphabet.clear();
    selectedAlphabetLabel->setText("Alfabeto: (ninguno)");
    automatonTypeComboBox->setCurrentIndex(0); // Reset to Finite Automaton
    initialStackSymbolComboBox->clear();
    initialStackSymbolComboBox->addItem("Z0"); // Default initial symbol
    initialStackSymbolComboBox->setVisible(false);
    initialStackSymbolComboBox->setEnabled(false);
    createDialog->exec();
}
void MainWindow::onSelectAutomaton() {
    if (sender() == selectAutomatonButton) {
        QSettings settings("ZFlap", "ZFlap");
        QStringList recent = settings.value("recentAutomata").toStringList();
        automatonList->clear();
        for (const QString &path : recent) { automatonList->addItem(QFileInfo(path).completeBaseName()); }
        selectDialog->exec();
    } else {
        if (automatonList->currentItem()) {
            loadSelectedAutomaton(automatonList->currentItem()->text());
            selectDialog->accept();
        }
    }
}
void MainWindow::onCreateNewAutomaton() {
    QString name = automatonNameEdit->text().trimmed();
    if (name.isEmpty() || selectedAlphabet.empty()) { QMessageBox::warning(this, "Datos incompletos", "El nombre y el alfabeto son obligatorios."); return; }

    AutomatonType type = static_cast<AutomatonType>(automatonTypeComboBox->currentData().toInt());
    char initialStackSymbol = '\0';
    if (type == StackAutomaton) {
        if (initialStackSymbolComboBox->currentText().isEmpty()) {
            QMessageBox::warning(this, "Datos incompletos", "El símbolo inicial de pila es obligatorio para Autómatas de Pila.");
            return;
        }
        initialStackSymbol = initialStackSymbolComboBox->currentText().at(0).toLatin1();
    }

    auto* editor = new AutomatonEditor();
    editor->loadAutomaton(name, selectedAlphabet, type, initialStackSymbol);
    int index = mainTabWidget->addTab(editor, QString("Autómata: %1").arg(name));
    mainTabWidget->setCurrentIndex(index);
    createDialog->accept();
}
void MainWindow::onSelectAlphabet() {
    if (alphabetSelector->exec() == QDialog::Accepted) {
        selectedAlphabet = alphabetSelector->getSelectedAlphabet();
        QStringList alphabetList;
        for(char c : selectedAlphabet) { alphabetList << QString(c); }
        selectedAlphabetLabel->setText(QString("Alfabeto: {%1}").arg(alphabetList.join(", ")));

        // Update initial stack symbol combobox with selected alphabet characters
        initialStackSymbolComboBox->clear();
        initialStackSymbolComboBox->addItem("Z0"); // Always include default Z0
        for(char c : selectedAlphabet) {
            initialStackSymbolComboBox->addItem(QString(c));
        }
    }
}
void MainWindow::onCancelCreate() { createDialog->reject(); }
void MainWindow::onCancelSelect() { selectDialog->reject(); }
void MainWindow::loadSelectedAutomaton(const QString &) { /* ... */ }
void MainWindow::openEditorWithFile(const QString &) { /* ... */ }
void MainWindow::setupButtonAnimation(QPushButton*) { /* ... */ }
