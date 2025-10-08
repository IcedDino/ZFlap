/**
 * @file AutomatonEditor.cpp
 * @brief Implementation of the AutomatonEditor class.
 * @author ZFlap Project
 * @version 1.6.2
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
        QGraphicsEllipseItem* finalIndicator = new QGraphicsEllipseItem(-20, -20, 40, 40, this);
        finalIndicator->setPen(QPen(Qt::black, 2));
    } else {
        // A better implementation would manage/remove the indicator item.
    }
    update();
}

bool StateItem::isFinal() const { return isFinalState; }

void StateItem::setIsInitial(bool initial)
{
    if(initial) {
        setBrush(QColor(240, 207, 96));
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
    label = new QGraphicsTextItem(transitionSymbol, this);
    label->setDefaultTextColor(Qt::blue);
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
    const qreal radius = 25.0;
    QPointF startPoint = startItem->pos();
    QPointF endPoint = endItem->pos();
    QLineF centerLine(startPoint, endPoint);

    if (qFuzzyCompare(centerLine.length(), 0.0)) {
        return;
    }

    QPointF edgeOffset = (centerLine.p2() - centerLine.p1()) * (radius / centerLine.length());
    QPointF newStartPoint = startPoint + edgeOffset;
    QPointF newEndPoint = endPoint - edgeOffset;
    setLine(QLineF(newStartPoint, newEndPoint));

    QGraphicsLineItem::paint(painter, option, widget);

    QLineF line = this->line();
    double angle = std::atan2(-line.dy(), line.dx());

    QPointF arrowP1 = line.p2() - QPointF(sin(angle + M_PI / 3) * 15, cos(angle + M_PI / 3) * 15);
    QPointF arrowP2 = line.p2() - QPointF(sin(angle + M_PI - M_PI / 3) * 15, cos(angle + M_PI - M_PI / 3) * 15);

    painter->setBrush(Qt::black);
    painter->drawPolygon(QPolygonF() << line.p2() << arrowP1 << arrowP2);

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

    QPalette pal = palette();
    pal.setColor(QPalette::Window, QColor("#FFFEF5"));
    // --- ADDED: Set the default text color to black for visibility ---
    pal.setColor(QPalette::WindowText, Qt::black);
    setAutoFillBackground(true);
    setPalette(pal);
}

void AutomatonEditor::loadAutomaton(const QString& name, const std::set<char>& alphabet) {
    automatonName = name;
    currentAlphabet = alphabet;
    setWindowTitle("Editor - " + name);
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
    addStateButton->setToolTip("Añadir Estado");
    addStateButton->setFixedSize(40, 40);

    linkButton = new QPushButton("🔗");
    linkButton->setToolTip("Enlazar Estados");
    linkButton->setFixedSize(40, 40);

    setInitialButton = new QPushButton("→");
    setInitialButton->setToolTip("Marcar Estado Inicial");
    setInitialButton->setFixedSize(40, 40);

    toggleFinalButton = new QPushButton("◎");
    toggleFinalButton->setToolTip("Alternar Estado Final");
    toggleFinalButton->setFixedSize(40, 40);

    saveButton = new QPushButton("💾");
    saveButton->setToolTip("Guardar autómata (.zflap)");
    saveButton->setFixedSize(40, 40);


    toolbarLayout->addWidget(addStateButton);
    toolbarLayout->addWidget(linkButton);
    toolbarLayout->addWidget(setInitialButton);
    toolbarLayout->addWidget(toggleFinalButton);
    toolbarLayout->addWidget(saveButton);
    toolbarLayout->addStretch();

    connect(addStateButton, &QPushButton::clicked, this, &AutomatonEditor::onAddStateClicked);
    connect(linkButton, &QPushButton::clicked, this, &AutomatonEditor::onLinkToolClicked);
    connect(setInitialButton, &QPushButton::clicked, this, &AutomatonEditor::onSetInitialState);
    connect(toggleFinalButton, &QPushButton::clicked, this, &AutomatonEditor::onToggleFinalState);
    connect(saveButton, &QPushButton::clicked, this, &AutomatonEditor::onSaveAutomatonClicked);


    transitionBox = new QGroupBox("Editar Transición");
    transitionBox->setObjectName("transitionBox");
    transitionBox->setVisible(false);
    auto *sidebarLayout = new QVBoxLayout(transitionBox);
    sidebarLayout->setSpacing(10);
    sidebarLayout->setAlignment(Qt::AlignTop);

    fromStateLabel = new QLabel("De: ");
    toStateLabel = new QLabel("A: ");
    transitionSymbolEdit = new QLineEdit();
    transitionSymbolEdit->setPlaceholderText("Símbolo(s), ej: a,b");
    updateTransitionButton = new QPushButton("Actualizar");
    updateTransitionButton->setObjectName("updateTransitionButton");

    sidebarLayout->addWidget(fromStateLabel);
    sidebarLayout->addWidget(toStateLabel);
    sidebarLayout->addWidget(new QLabel("Símbolo de entrada:"));
    sidebarLayout->addWidget(transitionSymbolEdit);
    sidebarLayout->addWidget(updateTransitionButton);

    connect(updateTransitionButton, &QPushButton::clicked, this, &AutomatonEditor::onUpdateTransitionSymbol);

    QHBoxLayout *contentLayout = new QHBoxLayout();
    contentLayout->addWidget(graphicsView, 4);
    contentLayout->addWidget(transitionBox, 1);

    mainLayout->addWidget(toolsGroup);
    mainLayout->addLayout(contentLayout);
}

void AutomatonEditor::applyStyles()
{
    static const QString kColorBg = "#FFFEF5";
    static const QString kColorMutedBorder = "#CCCCCC";

    setStyleSheet(
        "QGroupBox#transitionBox { font-weight: bold; font-size: 14px; border: 1px solid #CCCCCC; margin-top: 1ex; }"
        "QGroupBox#transitionBox::title { subcontrol-origin: margin; left: 10px; padding: 0 3px 0 3px; }"
        "QGroupBox#toolsGroup { "
        "    background-color: " + kColorBg + "; "
        "    border: 1px solid " + kColorMutedBorder + "; "
        "    border-radius: 4px; "
        "}"
        "QGraphicsView { "
        "    border: 1px solid " + kColorMutedBorder + "; "
        "    border-radius: 4px; "
        "}"
        "QPushButton { "
        "    background-color: rgb(240, 207, 96);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 4px;"
        "    font-weight: bold;"
        "    padding: 5px;"
        "    font-size: 18px;"
        "}"
        "QPushButton:hover { background-color: rgb(220, 187, 76); }"
        "QPushButton#updateTransitionButton { font-size: 14px; font-weight: normal; }"
        "QLineEdit { border: 2px solid #000000; padding: 8px; border-radius: 4px; background-color: white; }"
    );

    linkButton->setStyleSheet(
        "QPushButton { background-color: rgb(240, 207, 96); color: black; font-size: 18px; padding: 5px; border-radius: 4px; border: 1px solid #000000; }"
        "QPushButton:hover { background-color: rgb(220, 187, 76); }"
        "QPushButton:checked { background-color: rgb(200, 167, 56); border: 2px solid black; }"
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
    if (currentTool == ADD_TRANSITION) {
        graphicsView->setCursor(Qt::CrossCursor);
    } else {
        graphicsView->setCursor(Qt::ArrowCursor);
        startTransitionState = nullptr; // Reset if tool is deselected
    }
}

void AutomatonEditor::onStateSelectedForTransition(StateItem* state) {
    scene->clearSelection();
    if (currentTool != ADD_TRANSITION) return;

    if (!startTransitionState) {
        startTransitionState = state;
    } else {
        StateItem* endState = state;
        if (startTransitionState != endState) {
            TransitionItem* transition = new TransitionItem(startTransitionState, endState);
            scene->addItem(transition);
            connect(transition, &TransitionItem::itemSelected, this, &AutomatonEditor::onTransitionItemSelected);
        }
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

    QString symbols = transitionSymbolEdit->text().remove(" ");
    if (symbols.isEmpty()){
        QMessageBox::warning(this, "Símbolo Vacío", "El símbolo de transición no puede estar vacío.");
        return;
    }

    std::string from = selectedTransitionItem->getStartItem()->getName().toStdString();
    std::string to = selectedTransitionItem->getEndItem()->getName().toStdString();
    QStringList validSymbols;

    for (const QString &symbolStr : symbols.split(',')) {
        if (symbolStr.isEmpty()) {
            continue;
        }
        if (symbolStr.length() != 1) {
            QMessageBox::warning(this, "Símbolo Inválido", QString("El símbolo '%1' debe ser un único caracter.").arg(symbolStr));
            return;
        }
        char symbol = symbolStr.at(0).toLatin1();
        if (currentAlphabet.find(symbol) == currentAlphabet.end()) {
             QMessageBox::warning(this, "Símbolo Inválido", QString("El símbolo '%1' no pertenece al alfabeto.").arg(symbol));
             return;
        }
        transitionHandler.addTransition(from, symbol, to);
        validSymbols.append(symbolStr);
    }

    selectedTransitionItem->setSymbol(validSymbols.join(','));
    qDebug() << "Transition added:" << QString::fromStdString(from) << "->" << QString::fromStdString(to) << "on" << validSymbols.join(',');

    selectedTransitionItem->setSelected(false);
    selectedTransitionItem = nullptr;
    transitionBox->setVisible(false);
}

void AutomatonEditor::resetEditorState() {
    startTransitionState = nullptr;
    linkButton->setChecked(false);
    currentTool = SELECT;
    graphicsView->setCursor(Qt::ArrowCursor);
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
}
