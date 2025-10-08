/**
 * @file AutomatonEditor.h
 * @brief Header for the AutomatonEditor class, a graphical automaton editor widget.
 * @author ZFlap Project
 * @version 1.1.0
 * @date 2024
 */

#ifndef AUTOMATONEDITOR_H
#define AUTOMATONEDITOR_H

#include <QWidget>
#include <QGraphicsView>
#include <QGraphicsScene>
#include <QPushButton>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QGroupBox>
#include <QGraphicsEllipseItem>
#include <QGraphicsLineItem>
#include <QMouseEvent>
#include "Transition.h"
#include <set>
#include <map>


// Forward declaration
class StateItem;
class TransitionItem;

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

protected:
    void mousePressEvent(QMouseEvent *event) override;
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

    QPushButton *saveButton; // botón de guardar

private slots:
    void onSaveAutomatonClicked();


public:
    explicit AutomatonEditor(QWidget *parent = nullptr);
    void loadAutomaton(const QString& name, const std::set<char>& alphabet);

private slots:
    void onAddStateClicked();
    void onLinkToolClicked();
    void onStateSelectedForTransition(StateItem* state);
    void onTransitionItemSelected(TransitionItem* item);
    void onUpdateTransitionSymbol();
    void onSetInitialState();
    void onToggleFinalState();


private:
    void setupUI();
    void resetEditorState();
    void applyStyles();
    StateItem* getSelectedState();


    // Main layout
    QVBoxLayout *mainLayout;

    // Graphics View & Scene
    EditorView *graphicsView;
    QGraphicsScene *scene;

    // Toolbar
    QHBoxLayout *toolbarLayout;
    QGroupBox *toolsGroup;
    QPushButton *addStateButton;
    QPushButton *linkButton;
    QPushButton *setInitialButton;
    QPushButton *toggleFinalButton;


    // Sidebar for Transition Editing
    QGroupBox *transitionBox;
    QLineEdit *transitionSymbolEdit;
    QLabel *fromStateLabel;
    QLabel *toStateLabel;
    QPushButton *updateTransitionButton;


    // Automaton Data
    Transition transitionHandler;
    std::set<char> currentAlphabet;
    QString automatonName;
    int stateCounter;
    StateItem* initialState;
    std::map<QString, StateItem*> stateItems;

    // Editor state
    enum Tool { SELECT, ADD_TRANSITION };
    Tool currentTool;
    StateItem* startTransitionState;
    TransitionItem* selectedTransitionItem;
};

/**
 * @class StateItem
 * @brief Represents a state graphically in the editor.
 */
class StateItem : public QObject, public QGraphicsEllipseItem
{
    Q_OBJECT
public:
    StateItem(const QString& name, QGraphicsItem *parent = nullptr);
    QString getName() const;
    void setIsFinal(bool final);
    bool isFinal() const;
    void setIsInitial(bool initial);

protected:
    void mousePressEvent(QGraphicsSceneMouseEvent *event) override;

private:
    QString stateName;
    QGraphicsTextItem *label;
    bool isFinalState;
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
