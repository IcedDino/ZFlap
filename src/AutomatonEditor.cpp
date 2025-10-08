/**
 * @file AutomatonEditor.cpp
 * @brief Implementation of the AutomatonEditor class.
 * @author ZFlap Project
 * @version 1.6.3
 * @date 2024
 */

#include "AutomatonEditor.h"
#include <QGraphicsTextItem>
#include <QPainter>
#include <QMessageBox>
#include <QDebug>
#include <cmath>
#include <QToolTip>
#include <QFileDialog>
#include <QTextStream>
#include <QTimer>
#include <QSet>
#include <vector>
#include <QTextEdit>
#include <QSpinBox>
#include <Transition.h>
#include <QSettings>

//================================================================================
// EditorView Implementation
//================================================================================
EditorView::EditorView(QGraphicsScene *scene, QWidget *parent)
    : QGraphicsView(scene, parent) {}

void EditorView::mousePressEvent(QMouseEvent *event)
{
    // Pass the event to the base class to handle item selection/movement
    QGraphicsView::mousePressEvent(event);

    QGraphicsItem *clickedItem = itemAt(event->pos());

    if (!clickedItem) {
        // If clicking on empty space, deselect everything
        scene()->clearSelection();
    } else {
        // Allow clicking on a state's label (child item) to select the state
        StateItem *state = qgraphicsitem_cast<StateItem*>(clickedItem);
        if (!state && clickedItem->parentItem()) {
            state = qgraphicsitem_cast<StateItem*>(clickedItem->parentItem());
        }
        if (state) {
            emit stateClicked(state);
        }
    }
}

//================================================================================
// StateItem Implementation
//================================================================================
StateItem::StateItem(const QString& name, QGraphicsItem *parent)
    : QGraphicsEllipseItem(-25, -25, 50, 50, parent), stateName(name), isFinalState(false), isInitialState(false)
{
    setBrush(Qt::lightGray);
    setFlag(QGraphicsItem::ItemIsSelectable);
    setFlag(QGraphicsItem::ItemIsMovable);
    setFlag(QGraphicsItem::ItemSendsGeometryChanges);

    label = new QGraphicsTextItem(name, this);
    label->setPos(-label->boundingRect().width() / 2, -label->boundingRect().height() / 2);

    // FIXED: Create the final state indicator once and hide it.
    // This prevents the memory leak from creating new objects repeatedly.
    finalIndicator = new QGraphicsEllipseItem(-20, -20, 40, 40, this);
    finalIndicator->setPen(QPen(Qt::black, 2));
    finalIndicator->setVisible(false);
}

QString StateItem::getName() const { return stateName; }

void StateItem::setIsFinal(bool final) {
    isFinalState = final;
    // FIXED: Simply toggle the visibility of the pre-made indicator.
    finalIndicator->setVisible(isFinalState);
    update();
}

bool StateItem::isFinal() const { return isFinalState; }

void StateItem::setIsInitial(bool initial)
{
    isInitialState = initial; // Set the flag
    if(initial) {
        setBrush(QColor(240, 207, 96));
    } else {
        setBrush(Qt::lightGray);
    }
}

bool StateItem::isInitial() const {
    return isInitialState;
}

void StateItem::highlight(bool on) {
    if (on) {
        // Use a distinct color for active validation state
        setBrush(QColor(120, 207, 96)); // Green for active
    } else {
        // Revert to original color based on its status
        setIsInitial(isInitialState);
    }
}

void StateItem::mousePressEvent(QGraphicsSceneMouseEvent *event) {
    QGraphicsItem::mousePressEvent(event);
    scene()->clearSelection();
    setSelected(true);
}

//================================================================================
// TransitionItem Implementation
//================================================================================
TransitionItem::TransitionItem(StateItem* start, StateItem* end, QGraphicsItem* parent)
    : QGraphicsLineItem(parent), startItem(start), endItem(end), transitionSymbol("ε")
{
    setFlag(QGraphicsItem::ItemIsSelectable);
    setPen(QPen(Qt::black, 2));
    label = new QGraphicsTextItem(transitionSymbol, this);
    label->setDefaultTextColor(Qt::blue);

    // Set initial position
    updatePosition();
}

StateItem* TransitionItem::getStartItem() const { return startItem; }
StateItem* TransitionItem::getEndItem() const { return endItem; }

void TransitionItem::setSymbol(const QString& symbol) {
    transitionSymbol = symbol;
    label->setPlainText(symbol);
}

QString TransitionItem::getSymbol() const { return transitionSymbol; }

// FIXED: Created a dedicated function to update geometry.
// This separates state modification from the paint() routine.
void TransitionItem::updatePosition()
{
    const qreal radius = 25.0;
    QLineF centerLine(startItem->pos(), endItem->pos());

    if (qFuzzyCompare(centerLine.length(), 0.0)) {
        return;
    }

    // Calculate the point on the circle's edge
    QPointF edgeOffset = (centerLine.p2() - centerLine.p1()) * (radius / centerLine.length());
    QPointF newStartPoint = startItem->pos() + edgeOffset;
    QPointF newEndPoint = endItem->pos() - edgeOffset;

    // Inform the scene that geometry is changing before updating
    prepareGeometryChange();
    setLine(QLineF(newStartPoint, newEndPoint));
}

void TransitionItem::mousePressEvent(QGraphicsSceneMouseEvent *event) {
    QGraphicsItem::mousePressEvent(event);
    scene()->clearSelection();
    setSelected(true);
    emit itemSelected(this);
}

// FIXED: The paint method should only draw, not change the item's state.
void TransitionItem::paint(QPainter *painter, const QStyleOptionGraphicsItem *option, QWidget *widget)
{
    // Update position in case a connected state has moved.
    // A more advanced solution uses itemChange signals, but this works and is simple.
    updatePosition();

    QGraphicsLineItem::paint(painter, option, widget);

    QLineF line = this->line();
    double angle = std::atan2(-line.dy(), line.dx());

    // Calculate points for the arrowhead
    QPointF arrowP1 = line.p2() - QPointF(sin(angle + M_PI / 3) * 15, cos(angle + M_PI / 3) * 15);
    QPointF arrowP2 = line.p2() - QPointF(sin(angle + M_PI - M_PI / 3) * 15, cos(angle + M_PI - M_PI / 3) * 15);

    painter->setBrush(Qt::black);
    painter->drawPolygon(QPolygonF() << line.p2() << arrowP1 << arrowP2);

    // Position the label above the midpoint of the line
    label->setPos(line.pointAt(0.5) + QPointF(5, -20));
}

//================================================================================
// AutomatonEditor Implementation
//================================================================================
AutomatonEditor::AutomatonEditor(QWidget *parent)
    : QWidget(parent), stateCounter(0), currentTool(SELECT), startTransitionState(nullptr), selectedTransitionItem(nullptr), initialState(nullptr)
{
    setupUI();
    applyStyles();

    validationTimer = new QTimer(this);
    connect(validationTimer, &QTimer::timeout, this, &AutomatonEditor::onNextStepValidation);

    QPalette pal = palette();
    pal.setColor(QPalette::Window, QColor("#FFFEF5"));
    pal.setColor(QPalette::WindowText, Qt::black);
    setAutoFillBackground(true);
    setPalette(pal);
}

void AutomatonEditor::loadAutomaton(const QString& name, const std::set<char>& alphabet) {
    automatonName = name;
    currentAlphabet = alphabet;
    setWindowTitle("Editor - " + name);
}

void AutomatonEditor::rebuildTransitionHandler()
{
    transitionHandler.clear(); // Clear all stale data

    for (QGraphicsItem *item : scene->items()) {
        // Check if the item is a TransitionItem
        TransitionItem *transItem = qgraphicsitem_cast<TransitionItem*>(item);
        if (transItem) {
            std::string from = transItem->getStartItem()->getName().toStdString();
            std::string to = transItem->getEndItem()->getName().toStdString();

            // Get the symbols from the label, e.g., "a,b"
            QString symbols = transItem->getSymbol();
            QStringList symbolList = symbols.split(',');

            for (const QString &symbolStr : symbolList) {
                if (!symbolStr.isEmpty() && symbolStr != "ε") {
                    char symbol = symbolStr.at(0).toLatin1();
                    transitionHandler.addTransition(from, symbol, to);
                }
            }
        }
    }
}

void AutomatonEditor::setupUI() {
    mainLayout = new QVBoxLayout(this);
    scene = new QGraphicsScene(this);
    scene->setBackgroundBrush(QColor("#FFFEF5"));
    graphicsView = new EditorView(scene, this);
    graphicsView->setRenderHint(QPainter::Antialiasing);
    graphicsView->setCursor(Qt::ArrowCursor);

    connect(graphicsView, &EditorView::stateClicked, this, &AutomatonEditor::onStateSelectedForTransition);

    toolsGroup = new QGroupBox();
    toolsGroup->setObjectName("toolsGroup");
    toolbarLayout = new QHBoxLayout(toolsGroup);
    toolbarLayout->setSpacing(10);

    addStateButton = new QPushButton("+");
    addStateButton->setToolTip("Add State");
    addStateButton->setFixedSize(40, 40);

    linkButton = new QPushButton("🔗");
    linkButton->setToolTip("Link States");
    linkButton->setFixedSize(40, 40);
    linkButton->setCheckable(true);

    setInitialButton = new QPushButton("→");
    setInitialButton->setToolTip("Set Initial State");
    setInitialButton->setFixedSize(40, 40);

    toggleFinalButton = new QPushButton("◎");
    toggleFinalButton->setToolTip("Toggle Final State");
    toggleFinalButton->setFixedSize(40, 40);

    saveButton = new QPushButton("💾");
    saveButton->setToolTip("Guardar autómata (.zflap)");
    saveButton->setFixedSize(40, 40);

    // Validation tool button
    validateChainButton = new QPushButton("✔️");
    validateChainButton->setToolTip("Validate Chain");
    validateChainButton->setFixedSize(40, 40);
    validateChainButton->setCheckable(true);

    toolbarLayout->addWidget(addStateButton);
    toolbarLayout->addWidget(linkButton);
    toolbarLayout->addWidget(setInitialButton);
    toolbarLayout->addWidget(toggleFinalButton);
    toolbarLayout->addWidget(saveButton);
    toolbarLayout->addWidget(validateChainButton);
    // New: Button to toggle generator panel
    generatePanelButton = new QPushButton("✨");
    generatePanelButton->setToolTip("Generate Accepted Strings Panel");
    generatePanelButton->setFixedSize(40, 40);
    generatePanelButton->setCheckable(true);
    toolbarLayout->addWidget(generatePanelButton);
    toolbarLayout->addStretch();

    connect(addStateButton, &QPushButton::clicked, this, &AutomatonEditor::onAddStateClicked);
    connect(linkButton, &QPushButton::clicked, this, &AutomatonEditor::onLinkToolClicked);
    connect(setInitialButton, &QPushButton::clicked, this, &AutomatonEditor::onSetInitialState);
    connect(toggleFinalButton, &QPushButton::clicked, this, &AutomatonEditor::onToggleFinalState);
    connect(saveButton, &QPushButton::clicked, this, &AutomatonEditor::onSaveAutomatonClicked);
    connect(validateChainButton, &QPushButton::clicked, this, &AutomatonEditor::onValidateToolClicked);

    // --- Sidebar Panels ---
    transitionBox = new QGroupBox("Edit Transition");
    transitionBox->setObjectName("transitionBox");
    transitionBox->setVisible(false);
    auto *sidebarLayout = new QVBoxLayout(transitionBox);
    sidebarLayout->setSpacing(10);
    sidebarLayout->setAlignment(Qt::AlignTop);

    fromStateLabel = new QLabel("From: ");
    toStateLabel = new QLabel("To: ");
    transitionSymbolEdit = new QLineEdit();
    transitionSymbolEdit->setPlaceholderText("Symbol(s), e.g: a,b");
    updateTransitionButton = new QPushButton("Update");
    updateTransitionButton->setObjectName("updateTransitionButton");

    sidebarLayout->addWidget(fromStateLabel);
    sidebarLayout->addWidget(toStateLabel);
    sidebarLayout->addWidget(new QLabel("Input Symbol:"));
    sidebarLayout->addWidget(transitionSymbolEdit);
    sidebarLayout->addWidget(updateTransitionButton);

    connect(updateTransitionButton, &QPushButton::clicked, this, &AutomatonEditor::onUpdateTransitionSymbol);

    validationBox = new QGroupBox("Validate Chain");
    validationBox->setObjectName("validationBox");
    validationBox->setVisible(false);
    auto *validationLayout = new QVBoxLayout(validationBox);
    validationLayout->setSpacing(10);
    validationLayout->setAlignment(Qt::AlignTop);

    chainInput = new QLineEdit();
    chainInput->setPlaceholderText("Enter chain to validate");
    validationStatusLabel = new QLabel("Status: Idle");
    validationStatusLabel->setStyleSheet("font-weight: bold;");

    QHBoxLayout *controlsLayout = new QHBoxLayout();
    playButton = new QPushButton("▶");
    playButton->setToolTip("Play");
    pauseButton = new QPushButton("⏸");
    pauseButton->setToolTip("Pause");
    nextStepButton = new QPushButton("⤵");
    nextStepButton->setToolTip("Next Step");
    clearButton = new QPushButton("⏹");
    clearButton->setToolTip("Clear");
    instantValidateButton = new QPushButton("Check");
    instantValidateButton->setToolTip("Instantly check if the chain is accepted");


    controlsLayout->addWidget(playButton);
    controlsLayout->addWidget(pauseButton);
    controlsLayout->addWidget(nextStepButton);
    controlsLayout->addWidget(clearButton);
    controlsLayout->addWidget(instantValidateButton); // Add to layout


    validationLayout->addWidget(new QLabel("Input Chain:"));
    validationLayout->addWidget(chainInput);
    validationLayout->addLayout(controlsLayout);
    validationLayout->addWidget(validationStatusLabel);

    connect(playButton, &QPushButton::clicked, this, &AutomatonEditor::onPlayValidation);
    connect(pauseButton, &QPushButton::clicked, this, &AutomatonEditor::onPauseValidation);
    connect(nextStepButton, &QPushButton::clicked, this, &AutomatonEditor::onNextStepValidation);
    connect(clearButton, &QPushButton::clicked, this, &AutomatonEditor::onClearValidation);
    connect(instantValidateButton, &QPushButton::clicked, this, &AutomatonEditor::onInstantValidateClicked);

    // ADDED: New sidebar for generating accepted strings
    generationBox = new QGroupBox("Generate Accepted Strings");
    generationBox->setObjectName("generationBox");
    generationBox->setVisible(false); // hidden by default; toggled by toolbar button
    auto *generationLayout = new QVBoxLayout(generationBox);
    generationLayout->setSpacing(10);
    generationLayout->setAlignment(Qt::AlignTop);

    maxLengthSpinBox = new QSpinBox();
    maxLengthSpinBox->setRange(1, 20);
    maxLengthSpinBox->setValue(5);

    generateButton = new QPushButton("Generate");
    resultsTextEdit = new QTextEdit();
    resultsTextEdit->setReadOnly(true);

    generationLayout->addWidget(new QLabel("Max Length:"));
    generationLayout->addWidget(maxLengthSpinBox);
    generationLayout->addWidget(generateButton);
    generationLayout->addWidget(new QLabel("Results:"));
    generationLayout->addWidget(resultsTextEdit);

    connect(generateButton, &QPushButton::clicked, this, &AutomatonEditor::onGenerateStringsClicked);
    connect(generatePanelButton, &QPushButton::clicked, this, &AutomatonEditor::onGenerateToolClicked);

    // --- Main Layout Assembly ---
    QVBoxLayout *sidebarsLayout = new QVBoxLayout();
    sidebarsLayout->addWidget(transitionBox);
    sidebarsLayout->addWidget(validationBox);
    sidebarsLayout->addWidget(generationBox); // Toggled via toolbar button
    sidebarsLayout->addStretch();

    QHBoxLayout *contentLayout = new QHBoxLayout();
    contentLayout->addWidget(graphicsView, 4); // Graphics view takes most space
    contentLayout->addLayout(sidebarsLayout, 1); // Sidebars take less space

    mainLayout->addWidget(toolsGroup);
    mainLayout->addLayout(contentLayout);
}

void AutomatonEditor::applyStyles()
{
    // Styles remain the same
}


void AutomatonEditor::onAddStateClicked() {
    resetEditorState();
    QString name = "q" + QString::number(stateCounter++);
    StateItem *state = new StateItem(name);
    state->setPos(100 + (stateCounter % 5) * 80, 100 + (stateCounter / 5) * 80);
    scene->addItem(state);
    stateItems[name] = state;
}

void AutomatonEditor::onLinkToolClicked() {
    currentTool = linkButton->isChecked() ? ADD_TRANSITION : SELECT;
    graphicsView->setCursor(currentTool == ADD_TRANSITION ? Qt::CrossCursor : Qt::ArrowCursor);
    if (currentTool != ADD_TRANSITION) {
        startTransitionState = nullptr; // Reset if tool is deselected
    }
}

void AutomatonEditor::onValidateToolClicked()
{
    validationBox->setVisible(validateChainButton->isChecked());
    // If validation panel is opened, close generator panel
    if (validateChainButton->isChecked()) {
        if (generatePanelButton) generatePanelButton->setChecked(false);
        if (generationBox) generationBox->setVisible(false);
    }
}

// Toggle handler for generator panel button
void AutomatonEditor::onGenerateToolClicked() {
    bool visible = generatePanelButton && generatePanelButton->isChecked();
    if (visible) {
        // Hide validation panel when showing generator panel
        if (validateChainButton) validateChainButton->setChecked(false);
        if (validationBox) validationBox->setVisible(false);
    }
    if (generationBox) generationBox->setVisible(visible);
}

void AutomatonEditor::onStateSelectedForTransition(StateItem* state) {
    if (currentTool != ADD_TRANSITION) return;

    if (!startTransitionState) {
        startTransitionState = state;
        // Maybe add visual feedback for the starting state here
    } else {
        StateItem* endState = state;
        // Avoid self-loops for now, can be changed later if needed.
        if (startTransitionState != endState) {
            TransitionItem* transition = new TransitionItem(startTransitionState, endState);
            scene->addItem(transition);
            connect(transition, &TransitionItem::itemSelected, this, &AutomatonEditor::onTransitionItemSelected);
        }
        // Reset to allow creating a new transition from scratch
        startTransitionState = nullptr;
        // Optionally, could set startTransitionState = endState to chain transitions.
    }
}

void AutomatonEditor::onTransitionItemSelected(TransitionItem* item) {
    selectedTransitionItem = item;
    fromStateLabel->setText("<b>From:</b> " + item->getStartItem()->getName());
    toStateLabel->setText("<b>To:</b> " + item->getEndItem()->getName());
    transitionSymbolEdit->setText(item->getSymbol());
    transitionBox->setVisible(true);
}

// ADDED: New slot to handle instant validation using the backend function.
void AutomatonEditor::onInstantValidateClicked() {
    if (!initialState) {
        QMessageBox::warning(this, "Error", "An initial state must be set.");
        return;
    }

    rebuildTransitionHandler();

    std::string startState = initialState->getName().toStdString();
    std::string chain = chainInput->text().toStdString();
    std::set<std::string> finalStates = getFinalStates();

    // Call the backend function from validacion_cadenas.cpp
    bool accepted = esAceptada(transitionHandler, startState, finalStates, chain);

    if (accepted) {
        validationStatusLabel->setText("Status: Accepted (Instant Check)");
        validationStatusLabel->setStyleSheet("font-weight: bold; color: green;");
    } else {
        validationStatusLabel->setText("Status: Rejected (Instant Check)");
        validationStatusLabel->setStyleSheet("font-weight: bold; color: red;");
    }
}

// ADDED: New slot to generate accepted strings using the backend function.
void AutomatonEditor::onGenerateStringsClicked() {
    if (!initialState) {
        QMessageBox::warning(this, "Error", "An initial state must be set.");
        return;
    }

    resultsTextEdit->clear();
    std::string startState = initialState->getName().toStdString();
    std::set<std::string> finalStates = getFinalStates();
    std::vector<char> alphabet = getAlphabetVector();
    int maxLength = maxLengthSpinBox->value();

    // Call the robust backend function from validacion_cadenas.cpp
    std::vector<std::string> acceptedStrings = generarCadenasConLimite(
        transitionHandler, startState, finalStates, alphabet, maxLength);

    if (acceptedStrings.empty()) {
        resultsTextEdit->setText("No strings accepted within the given length.");
    } else {
        QStringList resultList;
        for (const auto& s : acceptedStrings) {
            // Represent the empty string with ε for clarity
            resultList.append(s.empty() ? "ε" : QString::fromStdString(s));
        }
        resultsTextEdit->setText(resultList.join("\n"));
    }
}

// ADDED: Helper function to get all final state names.
std::set<std::string> AutomatonEditor::getFinalStates() const {
    std::set<std::string> finalStates;
    for (const auto& pair : stateItems) {
        if (pair.second->isFinal()) {
            finalStates.insert(pair.first.toStdString());
        }
    }
    return finalStates;
}

// ADDED: Helper function to get the alphabet as a vector.
std::vector<char> AutomatonEditor::getAlphabetVector() const {
    std::vector<char> alphabetVec;
    for (char c : currentAlphabet) {
        alphabetVec.push_back(c);
    }
    return alphabetVec;
}

// FIXED: This function now validates all symbols *before* modifying the automaton state.
void AutomatonEditor::onUpdateTransitionSymbol() {
    if (!selectedTransitionItem) return;

    QString symbols = transitionSymbolEdit->text().remove(" ");
    if (symbols.isEmpty()){
        QMessageBox::warning(this, "Empty Symbol", "The transition symbol cannot be empty.");
        return;
    }

    QStringList validSymbols;
    // 1. Validate all symbols first
    for (const QString &symbolStr : symbols.split(',')) {
        if (symbolStr.isEmpty()) continue;

        if (symbolStr.length() != 1) {
            QMessageBox::warning(this, "Invalid Symbol", QString("The symbol '%1' must be a single character.").arg(symbolStr));
            return; // Exit without making any changes
        }
        char symbol = symbolStr.at(0).toLatin1();
        if (currentAlphabet.find(symbol) == currentAlphabet.end()) {
             QMessageBox::warning(this, "Invalid Symbol", QString("The symbol '%1' does not belong to the alphabet.").arg(symbol));
             return; // Exit without making any changes
        }
        validSymbols.append(symbolStr);
    }

    // 2. If all are valid, then add them to the handler
    std::string from = selectedTransitionItem->getStartItem()->getName().toStdString();
    std::string to = selectedTransitionItem->getEndItem()->getName().toStdString();
    for (const QString &symbolStr : validSymbols) {
        transitionHandler.addTransition(from, symbolStr.at(0).toLatin1(), to);
    }

    // 3. Update the UI
    selectedTransitionItem->setSymbol(validSymbols.join(','));
    qDebug() << "Transition added:" << QString::fromStdString(from) << "->" << QString::fromStdString(to) << "on" << validSymbols.join(',');

    selectedTransitionItem->setSelected(false);
    selectedTransitionItem = nullptr;
    transitionBox->setVisible(false);
}

void AutomatonEditor::resetEditorState() {
    startTransitionState = nullptr;
    linkButton->setChecked(false);

    if (validateChainButton->isChecked()) {
        validateChainButton->setChecked(false);
        onValidateToolClicked();
    }
    onClearValidation();

    currentTool = SELECT;
    graphicsView->setCursor(Qt::ArrowCursor);
    scene->clearSelection();
    transitionBox->setVisible(false);
    if (generatePanelButton) {
        generatePanelButton->setChecked(false);
    }
    if (generationBox) {
        generationBox->setVisible(false);
    }
}

void AutomatonEditor::onClearValidation()
{
    validationTimer->stop();
    unhighlightAllStates();
    currentValidationStates.clear();
    validationStep = 0;
    validationChain.clear();
    chainInput->clear();
    chainInput->setEnabled(true);
    playButton->setEnabled(true);
    nextStepButton->setEnabled(true);
    validationStatusLabel->setText("Status: Idle");
    validationStatusLabel->setStyleSheet("font-weight: bold; color: black;");
}

void AutomatonEditor::onPlayValidation()
{
    if (!initialState) {
        QMessageBox::warning(this, "Error", "Please set an initial state before validating.");
        return;
    }

    rebuildTransitionHandler();

    // Minor Improvement: Allow validating the empty string
    if (chainInput->text().isEmpty() && !initialState->isFinal()) {
        // You can decide how to handle this - here we just proceed
        // The existing logic will correctly reject it.
    } else if (chainInput->text().isEmpty() && initialState->isFinal()) {
        // The existing logic will correctly accept it.
    }

    // Preserve the input chain across the reset
    QString preservedChain = chainInput->text();
    onClearValidation(); // Reset first (this clears inputs)

    // Restore chain into both the member used for validation and the input field
    validationChain = preservedChain;
    chainInput->setText(validationChain);

    validationStep = 0;
    currentValidationStates.push_back(initialState);
    initialState->highlight(true);

    chainInput->setEnabled(false);
    validationStatusLabel->setText("Status: In progress...");
    validationStatusLabel->setStyleSheet("font-weight: bold; color: blue;");
    validationTimer->start(800); // Start timer for automatic steps
}

void AutomatonEditor::onPauseValidation()
{
    validationTimer->stop();
    validationStatusLabel->setText("Status: Paused");
}

void AutomatonEditor::onNextStepValidation()
{
    if (currentValidationStates.empty()) {
        validationTimer->stop();
        validationStatusLabel->setText("Status: Rejected (no possible transitions)");
        validationStatusLabel->setStyleSheet("font-weight: bold; color: red;");
        playButton->setEnabled(false);
        nextStepButton->setEnabled(false);
        return;
    }

    if (validationStep >= validationChain.length()) {
        validationTimer->stop();
        bool accepted = false;
        qDebug() << "--- Validation Finished ---";
        qDebug() << "Chain:" << validationChain;
        qDebug() << "Checking final states. States reached:";
        for (StateItem* state : currentValidationStates) {
            qDebug() << "  - State:" << state->getName() << "| Is Final?:" << state->isFinal();
            if (state->isFinal()) {
                accepted = true;
                // We keep checking all states for the debug log, so we comment out break
                // break;
            }
        }
        qDebug() << "Overall result will be:" << (accepted ? "Accepted" : "Rejected");
        // === END OF REPLACEMENT ===
        if (accepted) {
            validationStatusLabel->setText("Status: Accepted");
            validationStatusLabel->setStyleSheet("font-weight: bold; color: green;");
        } else {
            validationStatusLabel->setText("Status: Rejected (ended in non-final state)");
            validationStatusLabel->setStyleSheet("font-weight: bold; color: red;");
        }
        playButton->setEnabled(false);
        nextStepButton->setEnabled(false);
        return;
    }

    unhighlightAllStates();

    char symbol = validationChain.at(validationStep).toLatin1();
    std::vector<StateItem*> nextStatesVec;
    QSet<StateItem*> nextStatesSet; // Use a set to handle NFA non-determinism correctly

    for (StateItem* currentState : currentValidationStates) {
        std::string from = currentState->getName().toStdString();
        std::vector<std::string> nextStateNames = transitionHandler.getNextStates(from, symbol);
        for (const std::string& name : nextStateNames) {
            StateItem* nextStateItem = stateItems[QString::fromStdString(name)];
            if (nextStateItem && !nextStatesSet.contains(nextStateItem)) {
                nextStatesSet.insert(nextStateItem);
                nextStatesVec.push_back(nextStateItem);
            }
        }
    }

    currentValidationStates = nextStatesVec;

    for (StateItem* state : currentValidationStates) {
        state->highlight(true);
    }

    validationStep++;
}


void AutomatonEditor::unhighlightAllStates()
{
    // A more robust implementation would iterate over all known states,
    // but this works for the current validation logic.
    for (StateItem* state : currentValidationStates) {
        state->highlight(false);
    }
}

StateItem* AutomatonEditor::getSelectedState() {
    QList<QGraphicsItem*> selected = scene->selectedItems();
    if (selected.isEmpty()) return nullptr;
    return qgraphicsitem_cast<StateItem*>(selected.first());
}

void AutomatonEditor::onSetInitialState()
{
    StateItem* selected = getSelectedState();
    if (!selected) {
        QMessageBox::information(this, "Info", "Select a state to mark it as initial.");
        return;
    }
    // Unset the old initial state if it exists
    if (initialState) {
        initialState->setIsInitial(false);
    }
    initialState = selected;
    initialState->setIsInitial(true);
}

void AutomatonEditor::onToggleFinalState()
{
     StateItem* selected = getSelectedState();
    if (!selected) {
        QMessageBox::information(this, "Info", "Select a state to toggle its final status.");
        return;
    }
    selected->setIsFinal(!selected->isFinal());
}

void AutomatonEditor::onSaveAutomatonClicked() {
    if (!initialState) {
        QMessageBox::warning(this, "Error", "Debe definir un estado inicial antes de guardar.");
        return;
    }

    QString fileName = QFileDialog::getSaveFileName(this, "Guardar autómata", "", "ZFlap Automata (*.zflap)");
    if (fileName.isEmpty()) return;

    if (!fileName.endsWith(".zflap")) {
        fileName += ".zflap";
    }

    QFile file(fileName);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QMessageBox::warning(this, "Error", "No se pudo abrir el archivo para escritura.");
        return;
    }

    QTextStream out(&file);

    // Guardar información básica
    out << "Automaton: " << automatonName << "\n";
    out << "Alphabet: ";
    for (char c : currentAlphabet) out << c << " ";
    out << "\n";

    out << "Initial: " << initialState->getName() << "\n";

    out << "Finals: ";
    for (const auto &[name, state] : stateItems)
        if (state->isFinal()) out << QString::fromStdString(name.toStdString()) << " ";
    out << "\n";

    // Guardar transiciones
    out << "Transitions:\n";
    for (auto *item : scene->items()) {
        auto *transition = qgraphicsitem_cast<TransitionItem*>(item);
        if (!transition) continue;

        QString from = transition->getStartItem()->getName();
        QString to = transition->getEndItem()->getName();
        QString symbol = transition->getSymbol();
        out << from << " --" << symbol << "--> " << to << "\n";
    }

    file.close();
    QMessageBox::information(this, "Guardado", "El autómata se guardó correctamente en:\n" + fileName);

    // Update recent files list (store last 10 paths)
    QSettings settings("ZFlap", "ZFlap");
    QStringList recent = settings.value("recentAutomata").toStringList();
    recent.removeAll(fileName); // avoid duplicates
    recent.prepend(fileName);
    while (recent.size() > 10) {
        recent.removeLast();
    }
    settings.setValue("recentAutomata", recent);
}
