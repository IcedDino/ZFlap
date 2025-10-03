/**
 * @file MainWindow.h
 * @brief Main window interface for ZFlap automaton manager
 *
 * This file defines the MainWindow class which provides the primary user interface
 * for the ZFlap application. ZFlap is a JFlap-inspired tool for creating and
 * managing finite automata with a modern Qt-based interface.
 *
 * Features:
 * - Clean, minimalist design with Charter Roman typography
 * - Spanish localization ("JFlap con esteroides")
 * - Animated button interactions with hover effects
 * - Modal dialogs for automaton creation and selection
 * - Warm color scheme with custom RGB values
 *
 * @author ZFlap Team
 * @version 1.0.0
 */

#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QPushButton>
#include <QLabel>
#include <QFrame>
#include <QDialog>
#include <QLineEdit>
#include <QTextEdit>
#include <QComboBox>
#include <QListWidget>
#include <QScrollArea>
#include <QGridLayout>
#include <QSpacerItem>
#include <QFont>
#include <QPalette>
#include <QStyle>
#include <QPropertyAnimation>
#include <QGraphicsEffect>
#include <QSequentialAnimationGroup>
#include <QParallelAnimationGroup>
#include <QEasingCurve>
#include "AlphabetSelector.h"

/**
 * @class MainWindow
 * @brief Primary application window for ZFlap automaton manager
 *
 * MainWindow provides the main user interface for ZFlap, featuring:
 * - A welcome screen with title and subtitle
 * - Two primary action buttons: "Crear Automata" and "Seleccionar Automata"
 * - Modal dialogs for creating new automata and selecting existing ones
 * - Animated button interactions with growth and shake effects on hover
 * - Custom styling with warm color palette and Charter Roman font
 *
 * The interface is designed to be intuitive and visually appealing, with
 * smooth animations and a clean layout that guides users through the
 * automaton management workflow.
 */
class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    /**
     * @brief Construct a new MainWindow object
     * @param parent Optional parent widget (typically nullptr for main window)
     */
    MainWindow(QWidget *parent = nullptr);

    /**
     * @brief Destroy the MainWindow object
     */
    ~MainWindow();

private slots:
    /** @brief Show the create automaton dialog */
    void onCreateAutomaton();
    /** @brief Show the select automaton dialog */
    void onSelectAutomaton();
    /** @brief Handle creation of new automaton from dialog */
    void onCreateNewAutomaton();
    /** @brief Show alphabet selector dialog */
    void onSelectAlphabet();
    /** @brief Cancel automaton creation and close dialog */
    void onCancelCreate();
    /** @brief Cancel automaton selection and close dialog */
    void onCancelSelect();

private:
    /** @brief Initialize main UI layout and window properties */
    void setupUI();
    /** @brief Configure color palette and fonts */
    void setupWordleStyle();
    /** @brief Create main menu with title and action buttons */
    void createMainMenu();
    /** @brief Create modal dialog for new automaton creation */
    void createCreateDialog();
    /** @brief Create modal dialog for automaton selection */
    void createSelectDialog();
    /** @brief Add hover animations (grow + shake) to button */
    void setupButtonAnimation(QPushButton* button);
    
    // Main UI components
    QWidget *centralWidget;              ///< Central widget container
    QVBoxLayout *mainLayout;             ///< Main vertical layout
    QLabel *titleLabel;                  ///< "zFlap" title label
    QPushButton *createButton;           ///< "Crear Automata" button
    QPushButton *selectButton;           ///< "Seleccionar Automata" button

    // Create Automaton Dialog components
    QDialog *createDialog;               ///< Modal dialog for creating automata
    QVBoxLayout *createLayout;           ///< Create dialog layout
    QLabel *createTitleLabel;            ///< Create dialog title
    QLineEdit *automatonNameEdit;        ///< Name input field
    QTextEdit *descriptionEdit;          ///< Optional description field
    QPushButton *selectAlphabetButton;   ///< Button to open alphabet selector
    QLabel *selectedAlphabetLabel;       ///< Display selected alphabet
    QHBoxLayout *createButtonLayout;     ///< Button layout for create dialog
    QPushButton *createConfirmButton;    ///< "CREAR" confirmation button
    QPushButton *createCancelButton;     ///< "CANCELAR" cancel button

    // Alphabet Selector
    AlphabetSelector *alphabetSelector;  ///< Alphabet selection dialog
    std::vector<char> selectedAlphabet;  ///< Currently selected alphabet

    // Select Automaton Dialog components
    QDialog *selectDialog;               ///< Modal dialog for selecting automata
    QVBoxLayout *selectLayout;           ///< Select dialog layout
    QLabel *selectTitleLabel;            ///< Select dialog title
    QListWidget *automatonList;          ///< List of available automata
    QHBoxLayout *selectButtonLayout;     ///< Button layout for select dialog
    QPushButton *selectConfirmButton;    ///< "SELECCIONAR" confirmation button
    QPushButton *selectCancelButton;     ///< "CANCELAR" cancel button

    // Styling components
    QPalette wordlePalette;              ///< Custom color palette (RGB 255,254,245 bg)
    QFont titleFont;                     ///< Charter Roman font for title
    QFont buttonFont;                    ///< Arial font for buttons
    QFont textFont;                      ///< Arial font for regular text
};

#endif // MAINWINDOW_H
