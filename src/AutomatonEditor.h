/**
 * @file AutomatonEditor.h
 * @brief Header for the AutomatonEditor class, a graphical automaton editor widget.
 * @author ZFlap Project
 * @version 1.2.0
 * @date 2024
 */

#ifndef AUTOMATONEDITOR_H
#define AUTOMATONEDITOR_H

#include <QWidget>
#include <QGraphicsView>
#include <QGraphicsEllipseItem>
#include <QGraphicsLineItem>
#include <QMouseEvent>
#include <QGraphicsSceneMouseEvent>
#include <QObject>
#include "Transition.h"
#include <set>
#include <map>
#include <vector>
#include "validacion_cadenas.h"


// Forward declarations
class StateItem;
class TransitionItem;
class QTimer;
class QGraphicsScene;
class QPushButton;
class QVBoxLayout;
class QHBoxLayout;
class QLabel;
class QLineEdit;
class QGroupBox;
class QTextEdit;
class QButtonGroup;
class QSpinBox;
class QPainter;
class QStyleOptionGraphicsItem;
class QGraphicsTextItem;


/**
 * @class EditorView
 * @brief Custom QGraphicsView to handle mouse events for creating transitions.
 */
class EditorView : public QGraphicsView
{
    Q_OBJECT

public:
    explicit EditorView(QGraphicsScene *scene, QWidget *parent = nullptr);

signals:
    void stateClicked(StateItem *state);
    void backgroundClicked();
    void viewTransformed();

protected:
    void mousePressEvent(QMouseEvent *event) override;
    // ADDED: Declarations for zoom and pan event handlers.
    void wheelEvent(QWheelEvent *event) override;
    bool event(QEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
};


/**
 * @class AutomatonEditor
 * @brief A widget for graphically creating and editing a finite automaton.
 *
 * This class provides a canvas for adding states, drawing transitions between them,
 * and specifying the symbols for each transition using a sidebar. It integrates
 * with the Transition backend class to store the automaton's logic.
 */
class AutomatonEditor : public QWidget
{
    Q_OBJECT

public:
    explicit AutomatonEditor(QWidget *parent = nullptr);
    ~AutomatonEditor() override;
    void loadAutomaton(const QString& name, const std::set<char>& alphabet);

private slots:
    void onSaveAutomatonClicked();
    // --- Existing Slots ---
    void onAddStateClicked();
    void onLinkToolClicked();
    void onStateClicked(StateItem* state);
    void onTransitionItemSelected(TransitionItem* item);
    void onUpdateTransitionSymbol();
    void onSetInitialState();
    void onToggleFinalState();

    // --- Visual Validation Slots ---
    void onValidateToolClicked();
    void onPlayValidation();
    void onPauseValidation();
    void onNextStepValidation();
    void onClearValidation();

    // ADDED: Slots for new backend functionality
    void onInstantValidateClicked();
    void onGenerateStringsClicked();
    void onGenerateToolClicked();

    // ADDED: Slots for zoom reset button
    void onBackgroundClicked();
    void onResetZoomClicked();
    void updateResetZoomButtonVisibility();

private:
    void setupUI();
    void resetEditorState();
    void applyStyles();
    void deleteState(StateItem* state);
    void adjustSidebarLayout();
    void deleteTransition(TransitionItem* transition);
    void clearAutomaton();
    StateItem* getSelectedState();
    void unhighlightAllStates();

    void rebuildTransitionHandler();
    void keyPressEvent(QKeyEvent *event) override;

    // ADDED: Helper functions to gather automaton data for backend calls
    std::set<std::string> getFinalStates() const;
    std::vector<char> getAlphabetVector() const;

    // --- UI Members ---
    QHBoxLayout *mainLayout; // Changed from QVBoxLayout to QHBoxLayout
    QHBoxLayout *contentLayout; // Make contentLayout a member
    EditorView *graphicsView;
    QGraphicsScene *scene;
    QVBoxLayout *toolbarLayout; // Changed from QHBoxLayout to QVBoxLayout
    QButtonGroup *toolButtonGroup;
    QGroupBox *toolsGroup;
    QPushButton *addStateButton;
    QPushButton *linkButton;
    QPushButton *setInitialButton;
    QPushButton *toggleFinalButton;
    QPushButton *saveButton;
    QPushButton *validateChainButton;
    QPushButton *generatePanelButton;
    QPushButton *resetZoomButton;

    // --- Validation Sidebar ---
    QGroupBox *validationBox;
    QLineEdit *chainInput;
    QPushButton *playButton; // For visualizer
    QPushButton *pauseButton;
    QPushButton *nextStepButton;
    QPushButton *clearButton;
    QPushButton *instantValidateButton;
    QLabel *validationStatusLabel;

    // --- Transition Sidebar ---
    QGroupBox *transitionBox;
    QLineEdit *transitionSymbolEdit;
    QLabel *fromStateLabel;
    QLabel *toStateLabel;
    QPushButton *updateTransitionButton;

    // ADDED: New sidebar for generating strings
    QGroupBox *generationBox;
    QSpinBox *maxLengthSpinBox;
    QPushButton *generateButton;
    QTextEdit *resultsTextEdit;

    // --- Static Labels ---
    QLabel *inputSymbolLabel;
    QLabel *inputChainLabel;
    QLabel *maxLengthLabel;
    QLabel *resultsLabel;

    // --- Automaton Data & State ---
    Transition transitionHandler;
    std::set<char> currentAlphabet;
    QString automatonName;
    int stateCounter;
    StateItem* initialState;
    std::map<QString, StateItem*> stateItems;
    enum Tool { SELECT, ADD_TRANSITION, SET_INITIAL, TOGGLE_FINAL };
    Tool currentTool;
    StateItem* startTransitionState;
    TransitionItem* selectedTransitionItem;
    QTimer *validationTimer;
    std::vector<StateItem*> currentValidationStates;
    int validationStep;
    QString validationChain;
};

/**
 * @class StateItem
 * @brief Represents a state graphically in the editor.
 */
class StateItem : public QObject, public QGraphicsEllipseItem
{
    Q_OBJECT
public:
    void setName(const QString& newName);
    StateItem(const QString& name, QGraphicsItem *parent = nullptr);
    QString getName() const;
    void setIsFinal(bool final);
    bool isFinal() const;
    void setIsInitial(bool initial);
    bool isInitial() const;
    void highlight(bool on);

protected:
    void mousePressEvent(QGraphicsSceneMouseEvent *event) override;

private:
    QString stateName;
    QGraphicsTextItem *label;
    bool isFinalState;
    bool isInitialState;
    // ADDED: Declaration for the final state indicator to fix the memory leak.
    QGraphicsEllipseItem* finalIndicator;
};

/**
 * @class TransitionItem
 * @brief Represents a transition graphically as an arrow.
 */
class TransitionItem : public QObject, public QGraphicsLineItem
{
    Q_OBJECT
public:
    TransitionItem(StateItem* start, StateItem* end, QGraphicsItem* parent = nullptr);
    StateItem* getStartItem() const;
    StateItem* getEndItem() const;
    void setSymbol(const QString& symbol);
    QString getSymbol() const;
    void paint(QPainter *painter, const QStyleOptionGraphicsItem *option, QWidget *widget) override;
    // ADDED: Overrides to increase the clickable area of the transition line.
    QRectF boundingRect() const override;
    QPainterPath shape() const override;

    // ADDED: Declaration for the new geometry update method.
    void updatePosition();

signals:
    void itemSelected(TransitionItem* item);

protected:
    void mousePressEvent(QGraphicsSceneMouseEvent *event) override;

private:
    StateItem *startItem;
    StateItem *endItem;
    QGraphicsTextItem* label;
    QString transitionSymbol;
};


#endif // AUTOMATONEDITOR_H
