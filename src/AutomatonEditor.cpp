/**
 * @file AutomatonEditor.cpp
 * @brief Implementation of the AutomatonEditor class.
 * @author ZFlap Project
 * @version 1.6.3
 * @date 2024
 */

#include "AutomatonEditor.h"
#include <QGraphicsTextItem>
#include <QMessageBox>
#include <cmath>
#include <QFileDialog>
#include <QTimer>
#include <vector>
#include <QTextEdit>
#include <QSpinBox>
#include <Transition.h>
#include <QSettings>
#include <QVBoxLayout>
#include <QGroupBox>
#include <QPushButton>
#include <QLabel>
#include <QButtonGroup>
#include <QLineEdit>
#include <QGraphicsView>
#include <QMouseEvent>
#include <QScrollBar>
#include <QGestureEvent>



//================================================================================
// EditorView Implementation
//================================================================================
EditorView::EditorView(QGraphicsScene *scene, QWidget *parent)
    : QGraphicsView(scene, parent)
{
    setRenderHint(QPainter::Antialiasing);
    setTransformationAnchor(QGraphicsView::AnchorUnderMouse);
    // Enable pinch and pan gestures for trackpad interaction
    grabGesture(Qt::PinchGesture);
    grabGesture(Qt::PanGesture);
    // Hide the scrollbars as panning is handled by gestures and middle-mouse drag.
    setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
}

bool EditorView::event(QEvent *event)
{
    if (event->type() == QEvent::Gesture) {
        auto* gestureEvent = static_cast<QGestureEvent*>(event);
        if (auto *pinch = gestureEvent->gesture(Qt::PinchGesture)) {
            auto *pinchGesture = static_cast<QPinchGesture*>(pinch);

            // Use the incremental scale factor to avoid the "jump" at the start of the gesture.
            // This provides a smooth zoom relative to the last event.
            qreal scaleFactor = pinchGesture->scaleFactor();

            // Apply the incremental zoom.
            scale(scaleFactor, scaleFactor);
            emit viewTransformed();

            return true;
        }
        if (auto *pan = gestureEvent->gesture(Qt::PanGesture)) {
            auto *panGesture = static_cast<QPanGesture*>(pan);
            QPointF delta = panGesture->delta();
            // Translate the view by the delta of the pan gesture
            horizontalScrollBar()->setValue(horizontalScrollBar()->value() - static_cast<int>(delta.x()));
            verticalScrollBar()->setValue(verticalScrollBar()->value() - static_cast<int>(delta.y()));
            return true;
        }
    }
    return QGraphicsView::event(event);
}

void EditorView::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::MiddleButton) {
        setDragMode(QGraphicsView::ScrollHandDrag);
        QMouseEvent fakeEvent(QEvent::MouseButtonPress, event->pos(),
                              Qt::LeftButton, Qt::LeftButton, Qt::NoModifier);
        QGraphicsView::mousePressEvent(&fakeEvent);
        return;
    }

    // For other buttons (e.g., left-click), let the base class handle selection/movement first
    QGraphicsView::mousePressEvent(event);

    // Then, apply custom logic for state clicks if it was a left-click and no item was selected by base
    if (event->button() == Qt::LeftButton) {
        QGraphicsItem *clickedItem = itemAt(event->pos());

        if (!clickedItem) {
            // If clicking on an empty space, deselect everything
            scene()->clearSelection();
            emit backgroundClicked();
        } else {
            // If a state's label (child) is clicked, treat it as clicking the state (parent)
            auto *state = qgraphicsitem_cast<StateItem*>(clickedItem);
            if (!state && clickedItem->parentItem()) {
                state = qgraphicsitem_cast<StateItem*>(clickedItem->parentItem());
            }
            if (state) {
                emit stateClicked(state);
            }
        }
    }
}

void EditorView::wheelEvent(QWheelEvent *event)
{
    // Determine if it's a zoom event (vertical scroll) or pan (horizontal scroll)
    // Trackpads often send both pixelDelta and angleDelta. pixelDelta is more granular.
    QPoint numPixels = event->pixelDelta();
    QPoint numDegrees = event->angleDelta() / 8; // QWheelEvent::angleDelta() reports in eighths of a degree

    if (!numPixels.isNull()) { // Trackpad or high-resolution mouse wheel
        // Zoom based on vertical pixel delta
        // For trackpads, vertical scroll now pans vertically. Zoom is handled by pinch gesture.
        verticalScrollBar()->setValue(verticalScrollBar()->value() - numPixels.y());

        // Pan based on horizontal pixel delta (if not zooming)
        if (numPixels.x() != 0) {
            horizontalScrollBar()->setValue(horizontalScrollBar()->value() - numPixels.x());
        }
        event->accept();

    } else if (!numDegrees.isNull()) { // Standard mouse wheel
        // Zoom based on vertical angle delta
        if (numDegrees.y() != 0) {
            qreal scaleFactor = 1.0 + (numDegrees.y() > 0 ? 0.1 : -0.1); // Larger step for mouse wheel
            scale(scaleFactor, scaleFactor);
            emit viewTransformed();
            event->accept();
        }
        // Pan based on horizontal angle delta (if not zooming)
        if (numDegrees.x() != 0) {
            horizontalScrollBar()->setValue(horizontalScrollBar()->value() - numDegrees.x());
            event->accept();
        }
    } else {
        // Fallback to default QGraphicsView behavior if no specific handling
        QGraphicsView::wheelEvent(event);
    }
}

void EditorView::mouseReleaseEvent(QMouseEvent *event)
{
    if (event->button() == Qt::MiddleButton) {
        QMouseEvent fakeEvent(QEvent::MouseButtonRelease, event->pos(),
                              Qt::LeftButton, Qt::LeftButton, Qt::NoModifier);
        QGraphicsView::mouseReleaseEvent(&fakeEvent);
        setDragMode(QGraphicsView::NoDrag);
        return;
    }
    QGraphicsView::mouseReleaseEvent(event);
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

void StateItem::setName(const QString& newName) {
    stateName = newName;
    label->setPlainText(newName);
    // Recenter the label after changing the text
    label->setPos(-label->boundingRect().width() / 2, -label->boundingRect().height() / 2);
}

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
        // Use a distinct color for an active validation state
        setBrush(QColor(120, 207, 96)); // Green for active
    } else {
        // Revert to the original color based on its status
        setIsInitial(isInitialState);
    }
}

void StateItem::mousePressEvent(QGraphicsSceneMouseEvent *event) {
    QGraphicsItem::mousePressEvent(event);
    scene()->clearSelection();
    setSelected(true);
}

// MODIFIED: The logic has been moved back here from mouseReleaseEvent to enable real-time updates.
QVariant StateItem::itemChange(GraphicsItemChange change, const QVariant &value)
{
    if (change == QGraphicsItem::ItemPositionHasChanged) {
        // Notify all connected transitions to update their position in real-time.
        // This is the correct way to handle dependent items without causing flicker.
        for (TransitionItem *transition : qAsConst(transitions)) {
            transition->updatePosition();
        }
    }
    return QGraphicsItem::itemChange(change, value);
}

// ADDED: Method to register a transition with this state.
void StateItem::addTransition(TransitionItem *transition) {
    transitions.append(transition);
}

// ADDED: Method to unregister a transition.
void StateItem::removeTransition(TransitionItem *transition) {
    transitions.removeAll(transition);
}

//================================================================================
// TransitionItem Implementation
//================================================================================
TransitionItem::TransitionItem(StateItem* start, StateItem* end, QGraphicsItem* parent)
    : QGraphicsLineItem(parent), startItem(start), endItem(end), isLoop(start == end), loopRotation(0.0), transitionSymbol("ε")
{
    setFlag(QGraphicsItem::ItemIsSelectable);
    setPen(QPen(Qt::black, 2));
    label = new QGraphicsTextItem(transitionSymbol, this);
    label->setDefaultTextColor(Qt::black);

    // Set an initial position
    startItem->addTransition(this);
    if (!isLoop) {
        endItem->addTransition(this);
    }
    updatePosition();
}

// ADDED: Destructor to clean up connections.
TransitionItem::~TransitionItem()
{
    if (startItem) startItem->removeTransition(this);
    if (endItem && !isLoop) endItem->removeTransition(this);
}

StateItem* TransitionItem::getStartItem() const { return startItem; }
StateItem* TransitionItem::getEndItem() const { return endItem; }

void TransitionItem::setSymbol(const QString& symbol) {
    transitionSymbol = symbol;
    label->setPlainText(symbol);
}

QString TransitionItem::getSymbol() const { return transitionSymbol; }

// ADDED: Override to define a larger bounding box for the item.
// This ensures the entire shape, including the wider hitbox and arrowhead, is redrawn correctly.
QRectF TransitionItem::boundingRect() const
{
    qreal extra = (pen().width() + 20) / 2.0; // Add padding around the line
    return QGraphicsLineItem::boundingRect().adjusted(-extra, -extra, extra, extra)
           .united(label->boundingRect().translated(label->pos())); // Include label area
}

// ADDED: Override to define a larger, more clickable shape for the transition.
QPainterPath TransitionItem::shape() const
{
    if (isLoop) {
        // Create the same path as the visual loop for an accurate hitbox.
        const qreal stateRadius = 25.0;
        const qreal arcWidth = stateRadius;
        const qreal arcHeight = stateRadius * 2.2;
        const qreal angleFromVertical = M_PI / 4.0;
        const qreal y_offset = -stateRadius * cos(angleFromVertical);
        const qreal x_offset = stateRadius * sin(angleFromVertical);
        QPointF startPoint(-x_offset, y_offset);
        QPointF endPoint(x_offset, y_offset);
        QPointF ctrlPoint(0, -arcHeight);

        QPainterPath path;
        path.moveTo(startPoint);
        path.quadTo(ctrlPoint, endPoint);

        // Rotate the path to match the visual rotation
        QTransform t;
        t.rotate(loopRotation);
        path = t.map(path);
        return path;
    }

    QPainterPathStroker stroker;
    // Make the hitbox 15 pixels wide for easy clicking
    stroker.setWidth(15.0);

    // Create a path from a shortened line to prevent the hitbox from overlapping the states.
    QLineF currentLine = line();
    if (currentLine.length() == 0) {
        return QPainterPath(); // Return an empty path if the line is invalid
    }

    // Shorten the line by an extra margin (e.g., 10 units) at both ends for the hitbox
    QLineF hitboxLine = currentLine;
    hitboxLine.setLength(currentLine.length() - 10.0); // Shorten from the end
    hitboxLine.translate(currentLine.dx() / currentLine.length() * 5.0, currentLine.dy() / currentLine.length() * 5.0); // Shift it forward

    QPainterPath linePath;
    linePath.moveTo(hitboxLine.p1());
    linePath.lineTo(hitboxLine.p2());

    // Return the shape created by stroking the line path
    return stroker.createStroke(linePath);
}

// ADDED: A new helper function to find the best position for a self-loop.
void TransitionItem::updateLoopPosition()
{
    if (!scene() || !startItem || !isLoop) return;

    // Define the bounding box of the un-rotated arc for collision checking.
    const qreal stateRadius = 25.0;
    const qreal arcHeight = stateRadius * 2.2;
    const qreal arcWidth = stateRadius;

    // --- MODIFIED: Use the actual path for collision detection, not just a bounding box ---
    const qreal angleFromVertical = M_PI / 4.0;
    const qreal y_offset = -stateRadius * cos(angleFromVertical);
    const qreal x_offset = stateRadius * sin(angleFromVertical);
    QPointF startPoint(-x_offset, y_offset);
    QPointF endPoint(x_offset, y_offset);
    QPointF ctrlPoint(0, -arcHeight);
    QPainterPath basePath;
    basePath.moveTo(startPoint);
    basePath.quadTo(ctrlPoint, endPoint);

    // Candidate rotations (top, right, bottom, left)
    std::vector<qreal> rotations = { 0.0, 90.0, 180.0, 270.0 };

    qreal bestRotation = loopRotation;
    int minCollisions = -1;

    for (qreal rotation : rotations) {
        QTransform t;
        t.rotate(rotation);
        // Create the potential path in scene coordinates.
        QPainterPath potentialPath = t.map(basePath);
        potentialPath.translate(startItem->pos());

        // Find items colliding with this potential loop position
        QList<QGraphicsItem*> colliding = scene()->items(potentialPath, Qt::IntersectsItemShape);
        int collisionCount = 0;
        for (QGraphicsItem* item : colliding) {
            // Ignore collisions with the state itself, its children (label, final indicator), and this transition's own label.
            if (item == startItem || item->parentItem() == startItem || item == label) {
                continue;
            }
            collisionCount++;
        }

        if (minCollisions == -1 || collisionCount < minCollisions) {
            minCollisions = collisionCount;
            bestRotation = rotation;
        }
    }
    loopRotation = bestRotation;
}

// FIXED: Created a dedicated function to update geometry.
// This separates state modification from the paint() routine.
void TransitionItem::updatePosition()
{
    if (isLoop) {
        updateLoopPosition(); // Find the best spot for the loop
        // For a loop, position the TransitionItem's origin at the StateItem's center.
        // The loop is drawn in the StateItem's coordinate system, so we just need to
        // position this TransitionItem at the StateItem's location.
        setPos(startItem->pos());
        return;
    }

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
    // REMOVED: The call to updatePosition() that was causing the flicker.
    // The position is now updated via StateItem::itemChange.
    if (isLoop) {
        painter->setRenderHint(QPainter::Antialiasing, true);
        painter->setPen(pen());
        painter->setBrush(Qt::NoBrush); // The arc itself is not filled

        // --- NEW, SIMPLIFIED DRAWING LOGIC ---
        // This logic creates a clean, semi-circular arc above the state.

        const qreal stateRadius = 25.0;
        const qreal arcWidth = stateRadius;      // The arc will span the full width of the state.
        const qreal arcHeight = stateRadius * 2.2; // The arc will be tall and sweeping.

        // --- MODIFIED: Connect to the "shoulders" of the circle, not the equator ---
        // Calculate points at 45 degrees from the top vertical axis for a "north-left" and "north-right" connection.
        const qreal angleFromVertical = M_PI / 4.0; // 45 degrees
        const qreal y_offset = -stateRadius * cos(angleFromVertical);
        const qreal x_offset = stateRadius * sin(angleFromVertical);
        QPointF startPoint(-x_offset, y_offset);
        QPointF endPoint(x_offset, y_offset);
        // The Bezier control point defines the peak of the arc.
        QPointF ctrlPoint(0, -arcHeight);

        // --- START: Label Positioning (un-rotated) ---
        QTransform t;
        t.rotate(loopRotation);
        QPointF rotatedCtrlPoint = t.map(ctrlPoint); // Calculate the peak of the rotated arc.

        // --- MODIFIED: Calculate label offset based on rotation ---
        QPointF labelOffset;
        if (qFuzzyCompare(loopRotation, 0.0)) { // Top
            labelOffset = QPointF(-label->boundingRect().width() / 2, -label->boundingRect().height() - 5);
        } else if (qFuzzyCompare(loopRotation, 90.0)) { // Right
            labelOffset = QPointF(5, -label->boundingRect().height() / 2);
        } else if (qFuzzyCompare(loopRotation, 180.0)) { // Bottom
            labelOffset = QPointF(-label->boundingRect().width() / 2, 5);
        } else { // Left (270.0)
            labelOffset = QPointF(-label->boundingRect().width() - 1, -label->boundingRect().height() / 2);
        }

        label->setPos(rotatedCtrlPoint + labelOffset);
        // --- END: Label Positioning ---

        // --- START: Rotated Arc Drawing ---
        painter->save();
        painter->rotate(loopRotation);

        // Create the arc path using a quadratic Bezier curve.
        QPainterPath path(startPoint);
        path.quadTo(ctrlPoint, endPoint);
        painter->drawPath(path);

        // Draw the arrowhead at the end of the arc.
        // The angle is calculated from the control point to the end point.
        qreal angle = std::atan2(-ctrlPoint.y() + endPoint.y(), -ctrlPoint.x() + endPoint.x());
        // --- CORRECTED: Symmetrical arrowhead calculation ---
        QPointF arrowTip = endPoint;
        // Calculate the two base points of the arrowhead by rotating the angle.
        QPointF arrowP1 = arrowTip - QPointF(cos(angle - M_PI / 6.0) * 12, sin(angle - M_PI / 6.0) * 12);
        QPointF arrowP2 = arrowTip - QPointF(cos(angle + M_PI / 6.0) * 12, sin(angle + M_PI / 6.0) * 12);
        // Draw the filled arrowhead polygon.
        painter->setBrush(Qt::black);
        painter->drawPolygon(QPolygonF() << arrowTip << arrowP1 << arrowP2);

        // Restore the painter's state
        painter->restore();
        // --- END: Rotated Arc Drawing ---
        return;
    }

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
    : QWidget(parent), stateCounter(0), currentTool(SELECT), startTransitionState(nullptr), selectedTransitionItem(nullptr), initialState(nullptr), toolButtonGroup(nullptr),
      saveButton(nullptr), mainLayout(nullptr), contentLayout(nullptr), graphicsView(nullptr), scene(nullptr), toolbarLayout(nullptr), toolsGroup(nullptr),
      addStateButton(nullptr), linkButton(nullptr), setInitialButton(nullptr), toggleFinalButton(nullptr), validateChainButton(nullptr),
      generatePanelButton(nullptr), validationBox(nullptr), chainInput(nullptr), playButton(nullptr), pauseButton(nullptr),
      nextStepButton(nullptr), clearButton(nullptr), instantValidateButton(nullptr), validationStatusLabel(nullptr),
      resetZoomButton(nullptr),
      transitionBox(nullptr), transitionSymbolEdit(nullptr), fromStateLabel(nullptr), toStateLabel(nullptr),
      updateTransitionButton(nullptr), generationBox(nullptr), maxLengthSpinBox(nullptr), generateButton(nullptr),
      resultsTextEdit(nullptr), inputSymbolLabel(nullptr), inputChainLabel(nullptr), maxLengthLabel(nullptr), resultsLabel(nullptr), validationStep(0)
{
    setupUI();
    setFocusPolicy(Qt::StrongFocus); // Allow the widget to receive key press events
    applyStyles();

    validationTimer = new QTimer(this);
    connect(validationTimer, &QTimer::timeout, this, &AutomatonEditor::onNextStepValidation);

}

AutomatonEditor::~AutomatonEditor()
{
    clearAutomaton();
}

void AutomatonEditor::loadAutomaton(const QString& name, const std::set<char>& alphabet) {
    clearAutomaton();
    automatonName = name;
    currentAlphabet = alphabet;
    setWindowTitle("Editor - " + name);
}

void AutomatonEditor::clearAutomaton()
{
    if (scene) {
        scene->clear();
    }
    stateItems.clear();
    transitionHandler.clear();
    stateCounter = 0;
    initialState = nullptr;
    currentTool = SELECT;
    startTransitionState = nullptr;
    selectedTransitionItem = nullptr;
    validationStep = 0;
    validationChain.clear();
    currentValidationStates.clear();
    resetEditorState();
}

void AutomatonEditor::rebuildTransitionHandler()
{
    transitionHandler.clear(); // Clear all stale data

    for (QGraphicsItem *item : scene->items()) {
        // Check if the item is a TransitionItem
        if (auto *transItem = qgraphicsitem_cast<TransitionItem*>(item)) {
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

void AutomatonEditor::keyPressEvent(QKeyEvent *event)
{
    if (event->key() == Qt::Key_Delete || event->key() == Qt::Key_Backspace) {
        QList<QGraphicsItem*> selectedItems = scene->selectedItems();
        if (selectedItems.isEmpty()) {
            return; // Nothing to do
        }

        // Separate items by type to handle states first
        StateItem* selectedState = nullptr;
        TransitionItem* selectedTransition = nullptr;

        for (QGraphicsItem* item : selectedItems) {
            if (auto* state = qgraphicsitem_cast<StateItem*>(item)) {
                selectedState = state;
                break; // Prioritize deleting the state
            }
            if (auto* transition = qgraphicsitem_cast<TransitionItem*>(item)) {
                selectedTransition = transition;
            }
        }

        if (selectedState) {
            deleteState(selectedState);
        } else if (selectedTransition) {
            deleteTransition(selectedTransition);
        }

        // After deletion, rebuild the handler to reflect the changes
        rebuildTransitionHandler();
    } else {
        // Pass other key events to the base class
        QWidget::keyPressEvent(event);
    }
}


void AutomatonEditor::setupUI() {
    // Change the main layout to arrange the toolbar and content side-by-side.
    mainLayout = new QHBoxLayout(this);
    // Set margins to keep the toolbar flush left, but provide padding elsewhere.
    mainLayout->setContentsMargins(0, 15, 15, 15);

    scene = new QGraphicsScene(this);
    // Set a large, fixed scene rectangle to allow "infinite" panning on the canvas.
    scene->setSceneRect(-5000, -5000, 10000, 10000);

    graphicsView = new EditorView(scene, this);
    graphicsView->setRenderHint(QPainter::Antialiasing);
    graphicsView->setCursor(Qt::ArrowCursor);

    connect(graphicsView, &EditorView::stateClicked, this, &AutomatonEditor::onStateClicked);
    connect(graphicsView, &EditorView::backgroundClicked, this, &AutomatonEditor::onBackgroundClicked);
    connect(graphicsView, &EditorView::viewTransformed, this, &AutomatonEditor::updateResetZoomButtonVisibility);

    // Create a dedicated widget for the vertical toolbar.
    auto* toolbarWidget = new QWidget();
    toolbarWidget->setObjectName("toolsGroup"); // Keep object name for styling
    toolbarWidget->setFixedWidth(70); // Give the vertical toolbar a fixed width.

    // Change the toolbar layout to stack buttons vertically and center them.
    toolbarLayout = new QVBoxLayout(toolbarWidget);
    toolbarLayout->setSpacing(10);
    toolbarLayout->setAlignment(Qt::AlignHCenter | Qt::AlignTop);

    addStateButton = new QPushButton("⊕");
    addStateButton->setToolTip("Add State");
    addStateButton->setFixedSize(40, 40);

    linkButton = new QPushButton("↪");
    linkButton->setToolTip("Link States");
    linkButton->setFixedSize(40, 40);
    linkButton->setCheckable(true);
    linkButton->setObjectName("linkButton");

    // New: Button to toggle generator panel
    generatePanelButton = new QPushButton("⇒");
    generatePanelButton->setToolTip("Generate Accepted Strings Panel");
    generatePanelButton->setFixedSize(40, 40);
    generatePanelButton->setCheckable(true);

    setInitialButton = new QPushButton("→"); // This one is already great
    setInitialButton->setToolTip("Set Initial State");
    setInitialButton->setFixedSize(40, 40);

    toggleFinalButton = new QPushButton("◎"); // This one is also perfect
    toggleFinalButton->setToolTip("Toggle Final State");
    toggleFinalButton->setFixedSize(40, 40);

    saveButton = new QPushButton("▼");
    saveButton->setToolTip("Guardar autómata (.zflap)");
    saveButton->setFixedSize(40, 40);

    // Validation tool button
    validateChainButton = new QPushButton("?");
    validateChainButton->setToolTip("Validate Chain");
    validateChainButton->setFixedSize(40, 40);
    validateChainButton->setCheckable(true);
    validateChainButton->setObjectName("validateChainButton");

    toolbarLayout->addWidget(addStateButton);
    toolbarLayout->addWidget(linkButton);
    toolbarLayout->addWidget(setInitialButton);
    toolbarLayout->addWidget(toggleFinalButton);
    toolbarLayout->addWidget(saveButton);
    toolbarLayout->addWidget(generatePanelButton);
    toolbarLayout->addWidget(validateChainButton);
    toolbarLayout->addStretch();

    // --- Tool Button Group for mutual exclusivity ---
    toolButtonGroup = new QButtonGroup(this);
    toolButtonGroup->addButton(linkButton);
    toolButtonGroup->addButton(validateChainButton);
    toolButtonGroup->addButton(generatePanelButton);
    toolButtonGroup->setExclusive(true); // Only one can be checked at a time

    connect(addStateButton, &QPushButton::clicked, this, &AutomatonEditor::onAddStateClicked);
    connect(linkButton, &QPushButton::clicked, this, &AutomatonEditor::onLinkToolClicked);
    connect(generatePanelButton, &QPushButton::clicked, this, &AutomatonEditor::onGenerateToolClicked);
    connect(setInitialButton, &QPushButton::clicked, this, &AutomatonEditor::onSetInitialState);
    connect(toggleFinalButton, &QPushButton::clicked, this, &AutomatonEditor::onToggleFinalState);
    connect(saveButton, &QPushButton::clicked, this, &AutomatonEditor::onSaveAutomatonClicked);
    connect(validateChainButton, &QPushButton::clicked, this, &AutomatonEditor::onValidateToolClicked);

    // --- Sidebar Panels ---
    transitionBox = new QGroupBox("Edit Transition");
    transitionBox->setObjectName("transitionBox");
    transitionBox->setVisible(false);
    transitionBox->setProperty("visibilityChanged", true);
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
    inputSymbolLabel = new QLabel("Input Symbol:");
    sidebarLayout->addWidget(inputSymbolLabel);
    sidebarLayout->addWidget(transitionSymbolEdit);
    sidebarLayout->addWidget(updateTransitionButton);

    connect(updateTransitionButton, &QPushButton::clicked, this, &AutomatonEditor::onUpdateTransitionSymbol);

    validationBox = new QGroupBox("Validate Chain");
    validationBox->setObjectName("validationBox");
    validationBox->setVisible(false);
    validationBox->setProperty("visibilityChanged", true);
    auto *validationLayout = new QVBoxLayout(validationBox);
    validationLayout->setSpacing(10);
    validationLayout->setAlignment(Qt::AlignTop);

    chainInput = new QLineEdit();
    chainInput->setPlaceholderText("Enter chain to validate");
    validationStatusLabel = new QLabel("Status: Idle");
    validationStatusLabel->setStyleSheet("font-weight: bold;");

    auto *controlsLayout = new QHBoxLayout();
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


    inputChainLabel = new QLabel("Input Chain:");
    validationLayout->addWidget(inputChainLabel);
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
    generationBox->setProperty("visibilityChanged", true);
    auto *generationLayout = new QVBoxLayout(generationBox);
    generationLayout->setSpacing(10);
    generationLayout->setAlignment(Qt::AlignTop);

    maxLengthSpinBox = new QSpinBox();
    maxLengthSpinBox->setRange(1, 20);
    maxLengthSpinBox->setValue(5);

    generateButton = new QPushButton("Generate");
    resultsTextEdit = new QTextEdit();
    resultsTextEdit->setReadOnly(true);

    maxLengthLabel = new QLabel("Max Length:");
    generationLayout->addWidget(maxLengthLabel);
    generationLayout->addWidget(maxLengthSpinBox);
    generationLayout->addWidget(generateButton);
    resultsLabel = new QLabel("Results:");
    generationLayout->addWidget(resultsLabel);
    generationLayout->addWidget(resultsTextEdit);

    connect(generateButton, &QPushButton::clicked, this, &AutomatonEditor::onGenerateStringsClicked);

    // --- Main Layout Assembly ---
    auto *sidebarsLayout = new QVBoxLayout();
    sidebarsLayout->addWidget(transitionBox);
    sidebarsLayout->addWidget(validationBox);
    sidebarsLayout->addWidget(generationBox); // Toggled via toolbar button
    sidebarsLayout->addStretch();

    contentLayout = new QHBoxLayout();
    contentLayout->addWidget(graphicsView); // Graphics view takes most space
    contentLayout->addLayout(sidebarsLayout); // Sidebars take less space

    // Let the editor fill everything initially
    contentLayout->setStretchFactor(graphicsView, 1);
    contentLayout->setStretchFactor(sidebarsLayout, 0);


    mainLayout->addWidget(toolbarWidget); // Add the toolbar to the left.
    mainLayout->addLayout(contentLayout);

    // --- Overlay Widgets ---
    resetZoomButton = new QPushButton("⚲", graphicsView);
    resetZoomButton->setToolTip("Reset View");
    resetZoomButton->setFixedSize(35, 35);
    resetZoomButton->setStyleSheet(
        "QPushButton { border-radius: 17px; background-color: rgba(240, 207, 96, 0.8); color: black; font-weight: bold; }"
        "QPushButton:hover { background-color: rgba(220, 187, 76, 1.0); }"
    );
    resetZoomButton->move(10, graphicsView->height() - resetZoomButton->height() - 10);
    resetZoomButton->setVisible(false);

    connect(resetZoomButton, &QPushButton::clicked, this, &AutomatonEditor::onResetZoomClicked);
}

void AutomatonEditor::applyStyles()
{
    // Define a modern, clean color palette and fonts
    // Consistent with AlphabetSelector for a unified look
    QColor bgColor("#FFFEF5");         // Creamy off-white
    QColor textColor("#1E1E1E");         // Almost black
    QColor borderColor("#D0D0D0");       // Light gray for borders
    QColor panelTitleColor("#3A4D6D");   // Dark blue-gray for titles

    // Toolbar button colors (from AlphabetSelector)
    QColor toolbarButtonColor("#F0CF60");       // cream/yellow
    QColor toolbarButtonHoverColor("#DCBB4C");  // deeper yellow
    QColor toolbarButtonCheckedColor("#A8781E"); // darker golden/brown
    QColor toolbarButtonCheckedHoverColor("#8C6118");
    QColor toolbarButtonPressedColor("#C8A738");

    // Set the main window background
    QPalette pal = palette();
    pal.setColor(QPalette::Window, bgColor);
    pal.setColor(QPalette::WindowText, textColor);
    setAutoFillBackground(true);
    setPalette(pal);

    // Set scene background
    if (scene) {
        scene->setBackgroundBrush(bgColor);
    }

    // Use a stylesheet for a consistent look and feel
    QString styleSheet = QString(
        "QWidget { font-family: 'Segoe UI', 'Arial', sans-serif; font-size: 11pt; color: %1; }"
        "QGroupBox { "
        "    background-color: %2; "
        "    border: 1px solid %3; "
        "    border-radius: 8px; "
        "    margin-top: 10px; "
        "    padding: 10px; "
        "}"
        "QGroupBox::title { "
        "    subcontrol-origin: margin; "
        "    subcontrol-position: top center; "
        "    padding: 0 10px; "
        "    background-color: %2; "
        "    color: %4; "
        "    font-weight: bold; "
        "}"
        // General style for buttons inside panels (like "Update", "Generate")
        "QGroupBox QPushButton, QGroupBox QSpinBox::up-button, QGroupBox QSpinBox::down-button { "
        "    background-color: %5; " // cream/yellow
        "    color: %1; "           // Black text
        "    border: 1px solid %1; "
        "    border-radius: 5px; "
        "    padding: 8px 12px; "
        "    font-weight: bold; "
        "}"
        "QGroupBox QPushButton:hover { background-color: %6; }" // deeper yellow
        "QGroupBox QPushButton:pressed { background-color: %7; }"
        // --- START OF FIX ---
        // Add styling for the new toolbar container (which is a QWidget)
        "QWidget#toolsGroup { "
        "    background-color: %2; "
        "    border-right: 1px solid %3; " // Add a border to the right side
        "}"
        // Specific style for toolbar buttons
        "QWidget#toolsGroup QPushButton { "
        "    background-color: %5; "
        "    color: %1; " // Black text
        "    border: 1px solid %1; "
        "}"
        "QWidget#toolsGroup QPushButton:hover { background-color: %6; }"
        "QWidget#toolsGroup QPushButton:pressed { background-color: %7; }"
        "QWidget#toolsGroup QPushButton:checked { background-color: %8; color: white; border: 1px solid %1; }"
        "QWidget#toolsGroup QPushButton:checked:hover { background-color: %9; }"
        // --- END OF FIX ---
        // Fix for invisible labels in side panels
        "QGroupBox QLabel { color: %1; }"
        "QLineEdit, QSpinBox, QTextEdit { "
        "    background-color: white; "
        "    border: 1px solid %3; "
        "    border-radius: 5px; "
        "    padding: 5px; "
        "}"
    ).arg(textColor.name(), bgColor.name(), borderColor.name(), panelTitleColor.name(),
          toolbarButtonColor.name(), toolbarButtonHoverColor.name(), toolbarButtonPressedColor.name(),
          toolbarButtonCheckedColor.name(), toolbarButtonCheckedHoverColor.name());

    this->setStyleSheet(styleSheet);
}

void AutomatonEditor::adjustSidebarLayout()
{
    if (!contentLayout || !graphicsView) return;

    bool sidebarVisible = transitionBox->isVisible() ||
                          validationBox->isVisible() ||
                          generationBox->isVisible();

    contentLayout->setStretchFactor(graphicsView, sidebarVisible ? 4 : 1);
    contentLayout->setStretchFactor(contentLayout->itemAt(1)->layout(), sidebarVisible ? 1 : 0);
}

void AutomatonEditor::onResetZoomClicked()
{
    graphicsView->resetTransform();

    // Also pan the view to center on state q0, if it exists.
    auto it = stateItems.find("q0");
    if (it != stateItems.end()) {
        graphicsView->centerOn(it->second);
    }

    updateResetZoomButtonVisibility();
}

void AutomatonEditor::updateResetZoomButtonVisibility()
{
    if (!graphicsView || !resetZoomButton) return;

    // The button should be visible if zoom is far from 1.0
    qreal currentScale = graphicsView->transform().m11();
    bool show = (currentScale < 0.85 || currentScale > 1.25);
    resetZoomButton->setVisible(show);

    // Ensure the button stays in the bottom-left corner of the view
    resetZoomButton->move(10, graphicsView->height() - resetZoomButton->height() - 10);
    resetZoomButton->raise(); // Keep it on top
}

void AutomatonEditor::onBackgroundClicked()
{
    // If user clicks background, always reset to the default SELECT tool.
    resetEditorState();
}

void AutomatonEditor::onAddStateClicked() {
    resetEditorState();
    QString name = "q" + QString::number(stateCounter++);
    auto *state = new StateItem(name);
    state->setPos(100.0 + (stateCounter % 5) * 80.0, 100.0 + (stateCounter / 5) * 80.0);
    scene->addItem(state);
    stateItems[name] = state;
}

void AutomatonEditor::onLinkToolClicked() {
    currentTool = linkButton->isChecked() ? ADD_TRANSITION : SELECT;
    graphicsView->setCursor(currentTool == ADD_TRANSITION ? Qt::CrossCursor : Qt::ArrowCursor);
    if (currentTool != ADD_TRANSITION) {
        startTransitionState = nullptr; // Reset if the tool is deselected
    }
}

void AutomatonEditor::onValidateToolClicked()
{
    bool isChecked = validateChainButton->isChecked();
    validationBox->setVisible(isChecked);
    adjustSidebarLayout();
    // If unchecking, reset the validation state
    if (!isChecked) onClearValidation();
}

// Toggle handler for generator panel button
void AutomatonEditor::onGenerateToolClicked() {
    generationBox->setVisible(generatePanelButton->isChecked());
    adjustSidebarLayout();
}

void AutomatonEditor::onStateClicked(StateItem* state) {
    switch (currentTool) {
        case ADD_TRANSITION:
            if (!startTransitionState) {
                startTransitionState = state;
            } else {
                StateItem* endState = state;
                // REMOVED: The check that prevented creating loops.
                auto* transition = new TransitionItem(startTransitionState, endState);
                scene->addItem(transition);
                connect(transition, &TransitionItem::itemSelected, this, &AutomatonEditor::onTransitionItemSelected);
                startTransitionState = endState;
            }
            break;

        case SET_INITIAL:
            // Unset the old initial state if it exists
            if (initialState) {
                initialState->setIsInitial(false);
            }
            initialState = state;
            initialState->setIsInitial(true);
            resetEditorState(); // Return to default mode
            break;

        case TOGGLE_FINAL:
            state->setIsFinal(!state->isFinal());
            resetEditorState(); // Return to default mode
            break;

        case SELECT:
        default:
            resetEditorState(); // Deselect any tool if we click a state in normal mode
            break;
    }
}

void AutomatonEditor::onTransitionItemSelected(TransitionItem* item) {
    selectedTransitionItem = item;
    fromStateLabel->setText("<b>From:</b> " + item->getStartItem()->getName());
    toStateLabel->setText("<b>To:</b> " + item->getEndItem()->getName());
    transitionSymbolEdit->setText(item->getSymbol());
    transitionBox->setVisible(true);
    adjustSidebarLayout();
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
    alphabetVec.reserve(currentAlphabet.size());
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

    selectedTransitionItem->setSelected(false);
    selectedTransitionItem = nullptr;
    transitionBox->setVisible(false);
    adjustSidebarLayout();
}

void AutomatonEditor::deleteState(StateItem* stateToDelete)
{
    if (!stateToDelete) return;

    QString deletedName = stateToDelete->getName();
    bool isNumeric = false;
    int deletedIndex = deletedName.right(deletedName.length() - 1).toInt(&isNumeric);

    // --- 1. Remove transitions FIRST ---
    QList<TransitionItem*> transitionsToDelete;
    for (QGraphicsItem* item : scene->items()) {
        if (auto* trans = qgraphicsitem_cast<TransitionItem*>(item)) {
            if (trans->getStartItem() == stateToDelete || trans->getEndItem() == stateToDelete)
                transitionsToDelete.append(trans);
        }
    }
    for (TransitionItem* trans : transitionsToDelete)
        deleteTransition(trans);

    // --- 2. Remove the state from the map BEFORE renaming others ---
    stateItems.erase(deletedName);

    // --- 3. Reindex other states ---
    if (isNumeric) {
        std::vector<StateItem*> statesToReIndex;
        for (auto const& [name, state] : stateItems) {
            bool ok;
            int currentIndex = name.right(name.length() - 1).toInt(&ok);
            if (ok && currentIndex > deletedIndex)
                statesToReIndex.push_back(state);
        }

        std::sort(statesToReIndex.begin(), statesToReIndex.end(),
                  [](StateItem* a, StateItem* b) {
                      return a->getName().right(a->getName().length() - 1).toInt() <
                             b->getName().right(b->getName().length() - 1).toInt();
                  });

        for (StateItem* state : statesToReIndex) {
            int currentIndex = state->getName().right(state->getName().length() - 1).toInt();
            QString newName = "q" + QString::number(currentIndex - 1);
            state->setName(newName);
        }

        // --- 4. Rebuild map cleanly ---
        std::map<QString, StateItem*> rebuilt;
        for (auto const& pair : stateItems)
            rebuilt[pair.second->getName()] = pair.second;
        stateItems.swap(rebuilt);
    }

    // --- 5. Now it's safe to delete the state itself ---
    if (initialState == stateToDelete)
        initialState = nullptr;

    scene->removeItem(stateToDelete);
    delete stateToDelete;

    stateCounter = std::max(0, stateCounter - 1);
}

void AutomatonEditor::deleteTransition(TransitionItem* transitionToDelete)
{
    if (!transitionToDelete) return;

    // Remove from scene and delete
    scene->removeItem(transitionToDelete);
    delete transitionToDelete;
}

void AutomatonEditor::resetEditorState() {
    startTransitionState = nullptr;

    // Deselect all buttons in the exclusive group
    if (toolButtonGroup->checkedButton()) {
        toolButtonGroup->setExclusive(false); // Temporarily disable exclusivity to uncheck
        toolButtonGroup->checkedButton()->setChecked(false);
        toolButtonGroup->setExclusive(true);
    }

    currentTool = SELECT;
    if(graphicsView) graphicsView->setCursor(Qt::ArrowCursor);
    if(scene) scene->clearSelection();
    if(transitionBox) transitionBox->setVisible(false);
    if (validationBox) validationBox->setVisible(false);
    if (generationBox) generationBox->setVisible(false);
    adjustSidebarLayout();
}

void AutomatonEditor::onClearValidation()
{
    if(validationTimer) validationTimer->stop();
    unhighlightAllStates();
    currentValidationStates.clear();
    validationStep = 0;
    validationChain.clear();
    if(chainInput) {
        chainInput->clear();
        chainInput->setEnabled(true);
    }
    if(playButton) playButton->setEnabled(true);
    if(nextStepButton) nextStepButton->setEnabled(true);
    if(validationStatusLabel) {
        validationStatusLabel->setText("Status: Idle");
        validationStatusLabel->setStyleSheet("font-weight: bold; color: black;");
    }
}

void AutomatonEditor::onPlayValidation()
{
    if (!initialState) {
        QMessageBox::warning(this, "Error", "Please set an initial state before validating.");
        return;
    }

    rebuildTransitionHandler();

    // Minor Improvement: Allow validating the empty string
    if (chainInput->text().isEmpty()) {
        // The existing logic will correctly accept/reject it.
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
        for (StateItem* state : currentValidationStates) {
            if (state->isFinal()) {
                accepted = true;
                break;
            }
        }
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
    std::set<StateItem*> nextStatesSet; // Use a set to handle NFA non-determinism correctly

    for (StateItem* currentState : currentValidationStates) {
        std::string from = currentState->getName().toStdString();
        std::vector<std::string> nextStateNames = transitionHandler.getNextStates(from, symbol);
        for (const std::string& name : nextStateNames) {
            StateItem* nextStateItem = stateItems[QString::fromStdString(name)];
            if (nextStateItem && !nextStatesSet.count(nextStateItem)) {
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
    resetEditorState(); // Deselect other tools first
    currentTool = SET_INITIAL;
    graphicsView->setCursor(Qt::PointingHandCursor);
    // Optionally, provide user feedback, e.g., via a status bar
}

void AutomatonEditor::onToggleFinalState()
{
    resetEditorState(); // Deselect other tools first
    currentTool = TOGGLE_FINAL;
    graphicsView->setCursor(Qt::PointingHandCursor);
    // Optionally, provide user feedback
}

/**
 * @brief Loads an automaton from a .zflap file.
 * @param filePath The path to the file to load.
 *
 * This function parses a .zflap file, reconstructing the automaton's states,
 * transitions, and visual layout within the editor.
 */
void AutomatonEditor::loadFromFile(const QString &filePath) {
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        QMessageBox::warning(this, "Error", "Could not open file: " + file.errorString());
        return;
    }

    clearAutomaton(); // Reset the editor before loading

    QTextStream in(&file);
    QString currentSection;

    // Temporary map to find states by name when creating transitions
    std::map<QString, StateItem*> loadedStates;

    while (!in.atEnd()) {
        QString line = in.readLine().trimmed();
        if (line.startsWith('#') || line.isEmpty()) continue;

        if (line.startsWith("Automaton:")) {
            automatonName = line.section(':', 1).trimmed();
            setWindowTitle("Editor - " + automatonName);
        } else if (line.startsWith("Alphabet:")) {
            QStringList chars = line.section(':', 1).trimmed().split(' ', Qt::SkipEmptyParts);
            for (const QString& ch : chars) {
                if (!ch.isEmpty()) {
                    currentAlphabet.insert(ch.at(0).toLatin1());
                }
            }
        } else if (line == "[States]") {
            currentSection = "States";
        } else if (line == "[Transitions]") {
            currentSection = "Transitions";
        } else {
            if (currentSection == "States") {
                QStringList parts = line.split(',');
                if (parts.size() != 5) continue; // Malformed line

                QString name = parts[0].trimmed();
                qreal x = parts[1].toDouble();
                qreal y = parts[2].toDouble();
                bool isInitial = (parts[3].toInt() == 1);
                bool isFinal = (parts[4].toInt() == 1);

                auto* state = new StateItem(name);
                state->setPos(x, y);
                state->setIsFinal(isFinal);
                if (isInitial) {
                    initialState = state;
                    initialState->setIsInitial(true);
                }

                scene->addItem(state);
                stateItems[name] = state;
                loadedStates[name] = state;

                // Keep stateCounter updated to avoid name collisions
                bool ok;
                int num = name.mid(1).toInt(&ok);
                if (ok) {
                    stateCounter = std::max(stateCounter, num + 1);
                }

            } else if (currentSection == "Transitions") {
                QStringList parts = line.split(',');
                if (parts.size() != 3) continue; // Malformed line

                QString fromName = parts[0].trimmed();
                QString toName = parts[1].trimmed();
                QString symbols = parts[2].trimmed();

                if (loadedStates.count(fromName) && loadedStates.count(toName)) {
                    StateItem* start = loadedStates[fromName];
                    StateItem* end = loadedStates[toName];
                    auto* transition = new TransitionItem(start, end);
                    transition->setSymbol(symbols);
                    scene->addItem(transition);
                    connect(transition, &TransitionItem::itemSelected, this, &AutomatonEditor::onTransitionItemSelected);
                }
            }
        }
    }
    file.close();
    rebuildTransitionHandler(); // Build the logic backend from the loaded items
}

void AutomatonEditor::onSaveAutomatonClicked() {
    resetEditorState();
    if (!initialState) {
        QMessageBox::warning(this, "Error", "Debe definir un estado inicial antes de guardar.");
        return;
    }

    QString fileName = QFileDialog::getSaveFileName(this, "Guardar autómata", "", "ZFlap Automata (*.zflap)");
    if (fileName.isEmpty()) return;

    if (!fileName.endsWith(".zflap")) {
        fileName += ".zflap";
    }

    // --- ADDED: Update automaton name from the chosen file name ---
    QFileInfo fileInfo(fileName);
    automatonName = fileInfo.baseName(); // e.g., "MyAutomaton" from "/path/to/MyAutomaton.zflap"
    setWindowTitle("Editor - " + automatonName); // Update the window title as well
    // --- END OF CHANGE ---

    QFile file(fileName);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        QMessageBox::warning(this, "Error", "No se pudo abrir el archivo para escritura.");
        return;
    }

    QTextStream out(&file);

    // --- NEW SAVE FORMAT ---
    out << "# ZFlap Automaton File v2.0\n";
    out << "Automaton: " << automatonName << "\n";
    out << "Alphabet: ";
    for (char c : currentAlphabet) out << c << " ";
    out << "\n";

    out << "[States]\n";
    out << "# name, x, y, initial, final\n";
    for (const auto& [name, state] : stateItems) {
        out << name << "," << state->pos().x() << "," << state->pos().y() << ","
            << (state->isInitial() ? "1" : "0") << "," << (state->isFinal() ? "1" : "0") << "\n";
    }
    out << "\n";

    out << "[Transitions]\n";
    out << "# from, to, symbol(s)\n";
    for (auto *item : scene->items()) {
        auto *transition = qgraphicsitem_cast<TransitionItem*>(item);
        if (!transition) continue;
        out << transition->getStartItem()->getName() << "," << transition->getEndItem()->getName() << "," << transition->getSymbol() << "\n";
    }
    // --- END OF NEW FORMAT ---

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
