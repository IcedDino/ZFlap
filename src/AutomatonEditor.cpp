/**
 * @file AutomatonEditor.cpp
 * @brief Implementation of the AutomatonEditor class.
 * @author ZFlap Project
 * @version 1.1.0
 * @date 2024
 */

#include "AutomatonEditor.h"
#include <QGraphicsTextItem>
#include <QPainter>
#include <QMessageBox>
#include <QDebug>
#include <cmath>

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
        // --- NEW LOGIC ---
        // First, check if the clicked item is a StateItem itself.
        StateItem *state = qgraphicsitem_cast<StateItem*>(clickedItem);

        // If not, check if its PARENT is a StateItem.
        // This makes the text label's hitbox work for the state.
        if (!state && clickedItem->parentItem()) {
            state = qgraphicsitem_cast<StateItem*>(clickedItem->parentItem());
        }

        // If we found a state directly or via its parent, emit the signal.
        if (state) {
            emit stateClicked(state);
        }
    }
}

//================================================================================
// StateItem Implementation
//================================================================================
StateItem::StateItem(const QString& name, QGraphicsItem *parent)
    : QGraphicsEllipseItem(-25, -25, 50, 50, parent), stateName(name), isFinalState(false)
{
    setBrush(Qt::lightGray);
    setFlag(QGraphicsItem::ItemIsSelectable);
    setFlag(QGraphicsItem::ItemIsMovable);
    setFlag(QGraphicsItem::ItemSendsGeometryChanges);

    label = new QGraphicsTextItem(name, this);
    label->setPos(-label->boundingRect().width() / 2, -label->boundingRect().height() / 2);
}

QString StateItem::getName() const { return stateName; }

void StateItem::setIsFinal(bool final) {
    isFinalState = final;
    if (isFinalState) {
        // Draw a concentric circle inside for final state
        QGraphicsEllipseItem* finalIndicator = new QGraphicsEllipseItem(-20, -20, 40, 40, this);
        finalIndicator->setPen(QPen(Qt::black, 2));
    } else {
        // This part is tricky - for now, we just add and don't remove the visual.
        // A better implementation would manage the indicator item.
    }
    update();
}

bool StateItem::isFinal() const { return isFinalState; }

void StateItem::setIsInitial(bool initial)
{
    if(initial) {
        setBrush(QColor(144, 238, 144)); // Light green
    } else {
        setBrush(Qt::lightGray);
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

    // Create and position the label
    label = new QGraphicsTextItem(transitionSymbol, this);
    label->setDefaultTextColor(Qt::blue);

    // Position the line
    setLine(QLineF(startItem->pos(), endItem->pos()));
}

StateItem* TransitionItem::getStartItem() const { return startItem; }
StateItem* TransitionItem::getEndItem() const { return endItem; }
void TransitionItem::setSymbol(const QString& symbol) {
    transitionSymbol = symbol;
    label->setPlainText(symbol);
}
QString TransitionItem::getSymbol() const { return transitionSymbol; }

void TransitionItem::mousePressEvent(QGraphicsSceneMouseEvent *event) {
    QGraphicsItem::mousePressEvent(event);
    scene()->clearSelection();
    setSelected(true);
    emit itemSelected(this);
}

void TransitionItem::paint(QPainter *painter, const QStyleOptionGraphicsItem *option, QWidget *widget)
{
    // Define the radius of the state circles
    const qreal radius = 25.0;

    // Get the center points of the start and end states
    QPointF startPoint = startItem->pos();
    QPointF endPoint = endItem->pos();

    // Create a line between the centers to calculate the angle and length
    QLineF centerLine(startPoint, endPoint);

    // If the states are on top of each other, don't draw anything
    if (qFuzzyCompare(centerLine.length(), 0.0)) {
        return;
    }

    // --- NEW LOGIC ---
    // Calculate the new start and end points that lie on the edge of the circles.
    // We create a new point by moving along the center line from the start point.
    QPointF edgeOffset = (centerLine.p2() - centerLine.p1()) * (radius / centerLine.length());

    QPointF newStartPoint = startPoint + edgeOffset;
    QPointF newEndPoint = endPoint - edgeOffset;

    // Set the item's line to these new, shorter coordinates
    setLine(QLineF(newStartPoint, newEndPoint));

    // --- END OF NEW LOGIC ---


    // Draw the main line (now shortened)
    QGraphicsLineItem::paint(painter, option, widget);

    // Draw the arrowhead at the new endpoint
    QLineF line = this->line();
    double angle = std::atan2(-line.dy(), line.dx());

    // Calculate the two points for the arrowhead triangle
    QPointF arrowP1 = line.p2() - QPointF(sin(angle + M_PI / 3) * 15, cos(angle + M_PI / 3) * 15);
    QPointF arrowP2 = line.p2() - QPointF(sin(angle + M_PI - M_PI / 3) * 15, cos(angle + M_PI - M_PI / 3) * 15);

    painter->setBrush(Qt::black);
    painter->drawPolygon(QPolygonF() << line.p2() << arrowP1 << arrowP2);

    // Update label position to be in the middle of the new, shorter line
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
}

void AutomatonEditor::loadAutomaton(const QString& name, const std::set<char>& alphabet) {
    automatonName = name;
    currentAlphabet = alphabet;
    setWindowTitle("Editor - " + name);
    // You can also display the alphabet in a label if you want
}

void AutomatonEditor::setupUI() {
    // 1. The main layout is now a QVBoxLayout to stack the toolbar on top
    mainLayout = new QVBoxLayout(this);
    scene = new QGraphicsScene(this);
    graphicsView = new EditorView(scene, this);
    graphicsView->setRenderHint(QPainter::Antialiasing);

    connect(graphicsView, &EditorView::stateClicked, this, &AutomatonEditor::onStateSelectedForTransition);

    // 2. The toolbar is now a horizontal box of buttons
    toolsGroup = new QGroupBox("Herramientas");
    toolbarLayout = new QHBoxLayout(toolsGroup); // <-- Changed to QHBoxLayout
    toolbarLayout->setSpacing(15);
    // No vertical alignment needed anymore

    addStateButton = new QPushButton("+ Añadir Estado");
    linkButton = new QPushButton("🔗 Enlazar Estados");
    setInitialButton = new QPushButton("Marcar Inicial");
    toggleFinalButton = new QPushButton("Marcar Final");

    toolbarLayout->addWidget(addStateButton);
    toolbarLayout->addWidget(linkButton);
    toolbarLayout->addWidget(setInitialButton);
    toolbarLayout->addWidget(toggleFinalButton);
    toolbarLayout->addStretch(); // Pushes buttons to the left

    connect(addStateButton, &QPushButton::clicked, this, &AutomatonEditor::onAddStateClicked);
    connect(linkButton, &QPushButton::clicked, this, &AutomatonEditor::onLinkToolClicked);
    connect(setInitialButton, &QPushButton::clicked, this, &AutomatonEditor::onSetInitialState);
    connect(toggleFinalButton, &QPushButton::clicked, this, &AutomatonEditor::onToggleFinalState);

    // 3. The transition editing sidebar remains the same
    transitionBox = new QGroupBox("Editar Transición");
    transitionBox->setVisible(false);
    auto *sidebarLayout = new QVBoxLayout(transitionBox);
    sidebarLayout->setSpacing(10);
    sidebarLayout->setAlignment(Qt::AlignTop);

    fromStateLabel = new QLabel("De: ");
    toStateLabel = new QLabel("A: ");
    transitionSymbolEdit = new QLineEdit();
    transitionSymbolEdit->setPlaceholderText("Símbolo(s), ej: a,b");
    updateTransitionButton = new QPushButton("Actualizar");

    sidebarLayout->addWidget(fromStateLabel);
    sidebarLayout->addWidget(toStateLabel);
    sidebarLayout->addWidget(new QLabel("Símbolo de entrada:"));
    sidebarLayout->addWidget(transitionSymbolEdit);
    sidebarLayout->addWidget(updateTransitionButton);

    connect(updateTransitionButton, &QPushButton::clicked, this, &AutomatonEditor::onUpdateTransitionSymbol);

    // 4. Create a new content layout for the view and the sidebar
    QHBoxLayout *contentLayout = new QHBoxLayout();
    contentLayout->addWidget(graphicsView, 4); // Graphics view on the left
    contentLayout->addWidget(transitionBox, 1);  // Sidebar on the right

    // 5. Assemble the final layout
    mainLayout->addWidget(toolsGroup);      // Toolbar goes on top
    mainLayout->addLayout(contentLayout); // Content area (view + sidebar) goes below
}

void AutomatonEditor::applyStyles()
{
    // Consistent styling with MainWindow
    setStyleSheet(
        "QGroupBox { font-weight: bold; font-size: 14px; }"
        "QPushButton { "
        "    background-color: rgb(240, 207, 96);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 4px;"
        "    font-weight: normal;"
        "    padding: 10px;"
        "    font-size: 14px;"
        "}"
        "QPushButton:hover { background-color: rgb(220, 187, 76); }"
        "QLineEdit { border: 2px solid #000000; padding: 8px; border-radius: 4px; }"
    );
    linkButton->setStyleSheet(
        "QPushButton { background-color: rgb(100, 150, 200); color: white; }"
        "QPushButton:hover { background-color: rgb(80, 130, 180); }"
        "QPushButton:checked { background-color: rgb(60, 110, 160); }"
    );
    linkButton->setCheckable(true);
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
    if (currentTool == SELECT) {
        startTransitionState = nullptr; // Reset if tool is deselected
    }
}

void AutomatonEditor::onStateSelectedForTransition(StateItem* state) {
    scene->clearSelection();
    if (currentTool != ADD_TRANSITION) return;

    if (!startTransitionState) {
        // This is the first state clicked for a new chain
        startTransitionState = state;
    } else {
        // This is the next state in the chain
        StateItem* endState = state;

        // Create the transition graphically
        if (startTransitionState != endState) {
            TransitionItem* transition = new TransitionItem(startTransitionState, endState);
            scene->addItem(transition);
            connect(transition, &TransitionItem::itemSelected, this, &AutomatonEditor::onTransitionItemSelected);
        }

        // --- FIX ---
        // Set the start state for the NEXT transition to be the end state
        // of the one we just created. This enables chain linking.
        startTransitionState = endState;
    }
}

void AutomatonEditor::onTransitionItemSelected(TransitionItem* item) {
    selectedTransitionItem = item;
    fromStateLabel->setText("<b>De:</b> " + item->getStartItem()->getName());
    toStateLabel->setText("<b>A:</b> " + item->getEndItem()->getName());
    transitionSymbolEdit->setText(item->getSymbol());
    transitionBox->setVisible(true);
}

void AutomatonEditor::onUpdateTransitionSymbol() {
    if (!selectedTransitionItem) return;

    // Get all symbols, remove whitespace, and split by comma
    QString symbols = transitionSymbolEdit->text().remove(" ");
    if (symbols.isEmpty()){
        QMessageBox::warning(this, "Símbolo Vacío", "El símbolo de transición no puede estar vacío.");
        return;
    }

    // Backend update
    std::string from = selectedTransitionItem->getStartItem()->getName().toStdString();
    std::string to = selectedTransitionItem->getEndItem()->getName().toStdString();

    // We will build a new string for the label, containing only valid symbols
    QStringList validSymbols;

    // Corrected Loop: Iterate over a QStringList, so the variable must be a QString
    for (const QString &symbolStr : symbols.split(',')) {
        // Skip any empty parts that result from multiple commas (e.g., "a,,b")
        if (symbolStr.isEmpty()) {
            continue;
        }

        // Ensure the symbol is only a single character
        if (symbolStr.length() != 1) {
            QMessageBox::warning(this, "Símbolo Inválido", QString("El símbolo '%1' debe ser un único caracter.").arg(symbolStr));
            return; // Or 'continue' if you want to allow other valid symbols in the list
        }

        char symbol = symbolStr.at(0).toLatin1();

        // Check if the symbol is in the defined alphabet
        if (currentAlphabet.find(symbol) == currentAlphabet.end()) {
             QMessageBox::warning(this, "Símbolo Inválido", QString("El símbolo '%1' no pertenece al alfabeto.").arg(symbol));
             return; // Or 'continue'
        }

        // Add the transition to the backend
        transitionHandler.addTransition(from, symbol, to);
        validSymbols.append(symbolStr);
    }

    // UI update with the processed, valid symbols
    selectedTransitionItem->setSymbol(validSymbols.join(','));
    qDebug() << "Transition added:" << QString::fromStdString(from) << "->" << QString::fromStdString(to) << "on" << validSymbols.join(',');

    // Deselect and hide sidebar
    selectedTransitionItem->setSelected(false);
    selectedTransitionItem = nullptr;
    transitionBox->setVisible(false);
}

void AutomatonEditor::resetEditorState() {
    startTransitionState = nullptr;
    linkButton->setChecked(false);
    currentTool = SELECT;
    scene->clearSelection();
    transitionBox->setVisible(false);
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
        QMessageBox::information(this, "Info", "Seleccione un estado para marcarlo como inicial.");
        return;
    }

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
        QMessageBox::information(this, "Info", "Seleccione un estado para marcarlo como final.");
        return;
    }
    selected->setIsFinal(!selected->isFinal());
}
