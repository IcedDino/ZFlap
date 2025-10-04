/**
 * @file MainWindow.cpp
 * @brief Implementation of MainWindow class for ZFlap automaton manager
 *
 * This file contains the implementation of the MainWindow class, providing
 * the complete user interface functionality for ZFlap. The implementation
 * includes UI setup, styling, dialog management, and interactive animations.
 *
 * Key Implementation Features:
 * - Modern Qt-based interface with custom styling
 * - Animated button interactions using QPropertyAnimation
 * - Modal dialogs for automaton creation and selection
 * - Spanish localization throughout the interface
 * - Responsive design with Charter Roman typography
 * - Custom color scheme (RGB 120,104,48 for buttons, RGB 255,254,245 for the background)
 *
 * Animation System:
 * The button animations use a custom event filter system to detect hover events
 * and apply smooth scaling and shaking animations. Each button grows by 20x10 pixels
 * and continuously shakes with a smooth sine wave motion while hovered.
 *
 * @author ZFlap Team
 * @version 1.0.0
 */

#include "MainWindow.h"
#include <QApplication>
#include <QScreen>
#include <QMessageBox>
#include <QSizePolicy>
#include "AutomatonEditor.h"
#include <QInputDialog> // Add this include at the top of MainWindow.cpp


/**
 * @brief MainWindow constructor
 *
 * Initializes the main window by setting up styling, UI components, and dialogs.
 * The constructor calls setup methods in a specific order to ensure proper
 * initialization of fonts, colors, layouts, and interactive elements.
 */
MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    setupWordleStyle();    // Initialize fonts and color palette
    setupUI();            // Set up basic window properties
    createMainMenu();     // Create title, buttons, and layout
    createCreateDialog(); // Initialize create automaton dialog
    createSelectDialog(); // Initialize select automaton dialog

    // Initialize alphabet selector
    alphabetSelector = new AlphabetSelector(this);
}

/**
 * @brief MainWindow destructor
 *
 * Qt handles cleanup of child widgets automatically, so no explicit
 * cleanup is needed for UI components.
 */
MainWindow::~MainWindow()
{
}

/**
 * @brief Set up basic window properties and layout
 *
 * Configures the central widget, main layout, window size, and position.
 * Centers the window on the screen and sets a fixed size for a consistent appearance.
 */
void MainWindow::setupUI()
{
    centralWidget = new QWidget(this);
    setCentralWidget(centralWidget);

    mainLayout = new QVBoxLayout(centralWidget);
    mainLayout->setSpacing(30);
    mainLayout->setContentsMargins(40, 40, 40, 40);

    // Center the window
    QScreen *screen = QApplication::primaryScreen();
    QRect screenGeometry = screen->availableGeometry();
    int x = (screenGeometry.width() - 600) / 2;
    int y = (screenGeometry.height() - 400) / 2;
    setGeometry(x, y, 600, 400);

    setWindowTitle("ZFlap - Automaton Manager");
    setFixedSize(600, 400);
}

/**
 * @brief Configure application color palette and fonts
 *
 * Sets up the visual styling for the entire application including
 * - Custom color palette with a warm off-white background (RGB 255,254,245)
 * - Brown button colors (RGB 120,104,48) with proper contrast
 * - Charter Roman font for the main title with fallback options
 * - Arial fonts for buttons and regular text
 *
 * The color scheme creates a warm, inviting appearance while maintaining
 * good readability and accessibility standards.
 */
void MainWindow::setupWordleStyle()
{
    // Custom color palette for a warm, professional appearance
    wordlePalette.setColor(QPalette::Window, QColor(255, 254, 245));    // Warm off-white background
    wordlePalette.setColor(QPalette::WindowText, QColor(0, 0, 0));      // Black text for contrast
    wordlePalette.setColor(QPalette::Button, QColor(120, 104, 48));     // Brown button background
    wordlePalette.setColor(QPalette::ButtonText, QColor(0, 0, 0));      // Black button text
    wordlePalette.setColor(QPalette::Base, QColor(255, 255, 255));      // White input fields
    wordlePalette.setColor(QPalette::Text, QColor(0, 0, 0));            // Black input text
    wordlePalette.setColor(QPalette::Highlight, QColor(120, 104, 48));  // Brown selection highlight
    wordlePalette.setColor(QPalette::HighlightedText, QColor(255, 255, 255)); // White selected text

    setPalette(wordlePalette);

    // Title font: Charter Roman with fallbacks for cross-platform compatibility
    titleFont.setFamily("Charter");
    if (titleFont.family() != "Charter") {
        QStringList charterFonts = {"Charter BT", "Bitstream Charter", "Charter Roman", "Times", "Times New Roman"};
        for (const QString &fontName : charterFonts) {
            titleFont.setFamily(fontName);
            if (titleFont.family() == fontName) {
                break;
            }
        }
    }
    titleFont.setPointSize(36);
    titleFont.setBold(true);

    // Button font: Bold Arial for clear readability
    buttonFont.setFamily("Arial");
    buttonFont.setPointSize(16);
    buttonFont.setBold(true);

    // Text font: Regular Arial for form fields and labels
    textFont.setFamily("Arial");
    textFont.setPointSize(12);
}

void MainWindow::createMainMenu()
{
    // Subtitle
    QLabel *subtitleLabel = new QLabel("JFlap con esteroides", this);
    QFont subtitleFont("Arial", 12);
    subtitleFont.setItalic(true);
    subtitleLabel->setFont(subtitleFont);
    subtitleLabel->setAlignment(Qt::AlignCenter);
    subtitleLabel->setStyleSheet("color: #666666; margin-bottom: 10px;");
    mainLayout->addWidget(subtitleLabel);

    // Title
    titleLabel = new QLabel("zFlap", this);
    titleLabel->setFont(titleFont);
    titleLabel->setAlignment(Qt::AlignCenter);
    titleLabel->setStyleSheet("color: #000000; margin-bottom: 40px;");
    mainLayout->addWidget(titleLabel);

    // Create a horizontal layout for buttons
    QHBoxLayout *buttonLayout = new QHBoxLayout();
    buttonLayout->setSpacing(40);

    // Create Automaton Button
    createButton = new QPushButton("Crear Automata", this);
    createButton->setFont(buttonFont);
    createButton->setMinimumSize(200, 60);
    createButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(240, 207, 96);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 0px;"
        "    font-weight: normal;"
        "    padding: 15px 30px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(240, 207, 96);"
        "}"
        "QPushButton:pressed {"
        "    background-color: rgb(240, 207, 96);"
        "}"
    );
    connect(createButton, &QPushButton::clicked, this, &MainWindow::onCreateAutomaton);
    setupButtonAnimation(createButton);
    buttonLayout->addWidget(createButton);

    // Select Automaton Button
    selectButton = new QPushButton("Seleccionar Automata", this);
    selectButton->setFont(buttonFont);
    selectButton->setMinimumSize(200, 60);
    selectButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(240, 207, 96);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 0px;"
        "    font-weight: normal;"
        "    padding: 15px 30px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(240, 207, 96);"
        "}"
        "QPushButton:pressed {"
        "    background-color: rgb(100, 84, 28);"
        "}"
    );
    connect(selectButton, &QPushButton::clicked, this, &MainWindow::onSelectAutomaton);
    setupButtonAnimation(selectButton);
    buttonLayout->addWidget(selectButton);

    // Center the button layout
    QHBoxLayout *centerLayout = new QHBoxLayout();
    centerLayout->addStretch();
    centerLayout->addLayout(buttonLayout);
    centerLayout->addStretch();

    mainLayout->addLayout(centerLayout);

    // Add vertical spacer to push everything up slightly
    mainLayout->addStretch();
}

void MainWindow::createCreateDialog()
{
    createDialog = new QDialog(this);
    createDialog->setWindowTitle("Crear Nuevo Autómata");
    createDialog->setFixedSize(500, 400);
    createDialog->setModal(true);

    createLayout = new QVBoxLayout(createDialog);
    createLayout->setSpacing(20);
    createLayout->setContentsMargins(30, 30, 30, 30);

    // Title
    createTitleLabel = new QLabel("CREAR NUEVO AUTÓMATA", createDialog);
    createTitleLabel->setFont(titleFont);
    createTitleLabel->setAlignment(Qt::AlignCenter);
    createTitleLabel->setStyleSheet("color: #000000; margin-bottom: 20px;");
    createLayout->addWidget(createTitleLabel);

    // Name input
    QLabel *nameLabel = new QLabel("Nombre del Autómata:", createDialog);
    nameLabel->setFont(textFont);
    nameLabel->setStyleSheet("color: #000000; font-weight: bold;");
    createLayout->addWidget(nameLabel);

    automatonNameEdit = new QLineEdit(createDialog);
    automatonNameEdit->setFont(textFont);
    automatonNameEdit->setMinimumHeight(40);
    automatonNameEdit->setStyleSheet(
        "QLineEdit {"
        "    background-color: #FFFFFF;"
        "    color: #000000;"
        "    border: 2px solid #000000;"
        "    border-radius: 4px;"
        "    padding: 8px;"
        "    font-size: 14px;"
        "}"
    );
    createLayout->addWidget(automatonNameEdit);

    // Description input
    QLabel *descLabel = new QLabel("Descripción (Opcional):", createDialog);
    descLabel->setFont(textFont);
    descLabel->setStyleSheet("color: #000000; font-weight: bold;");
    createLayout->addWidget(descLabel);

    descriptionEdit = new QTextEdit(createDialog);
    descriptionEdit->setFont(textFont);
    descriptionEdit->setMinimumHeight(100);
    descriptionEdit->setStyleSheet(
        "QTextEdit {"
        "    background-color: #FFFFFF;"
        "    color: #000000;"
        "    border: 2px solid #000000;"
        "    border-radius: 4px;"
        "    padding: 8px;"
        "    font-size: 14px;"
        "}"
    );
    createLayout->addWidget(descriptionEdit);

    // Alphabet selection
    QLabel *alphabetLabel = new QLabel("Alfabeto:", createDialog);
    alphabetLabel->setFont(textFont);
    alphabetLabel->setStyleSheet("color: #000000; font-weight: bold;");
    createLayout->addWidget(alphabetLabel);

    selectAlphabetButton = new QPushButton("Seleccionar Alfabeto", createDialog);
    selectAlphabetButton->setFont(buttonFont);
    selectAlphabetButton->setMinimumHeight(40);
    selectAlphabetButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(100, 150, 200);"
        "    color: white;"
        "    border: 1px solid #000000;"
        "    border-radius: 4px;"
        "    font-weight: bold;"
        "    padding: 8px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(80, 130, 180);"
        "}"
    );
    connect(selectAlphabetButton, &QPushButton::clicked, this, &MainWindow::onSelectAlphabet);
    createLayout->addWidget(selectAlphabetButton);

    selectedAlphabetLabel = new QLabel("(ningún alfabeto seleccionado)", createDialog);
    selectedAlphabetLabel->setFont(QFont("Arial", 10));
    selectedAlphabetLabel->setStyleSheet(
        "color: #666666; "
        "background-color: #f0f0f0; "
        "padding: 8px; "
        "border: 1px solid #cccccc; "
        "border-radius: 4px;"
    );
    selectedAlphabetLabel->setWordWrap(true);
    createLayout->addWidget(selectedAlphabetLabel);

    // Button layout
    createButtonLayout = new QHBoxLayout();
    createButtonLayout->setSpacing(20);

    createConfirmButton = new QPushButton("CREAR", createDialog);
    createConfirmButton->setFont(buttonFont);
    createConfirmButton->setMinimumHeight(50);
    createConfirmButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(240, 207, 96);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 0px;"
        "    font-weight: normal;"
        "    padding: 10px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(240, 207, 96);"
        "}"
    );
    connect(createConfirmButton, &QPushButton::clicked, this, &MainWindow::onCreateNewAutomaton);
    createButtonLayout->addWidget(createConfirmButton);

    createCancelButton = new QPushButton("CANCELAR", createDialog);
    createCancelButton->setFont(buttonFont);
    createCancelButton->setMinimumHeight(50);
    createCancelButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(255, 254, 245);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 0px;"
        "    font-weight: normal;"
        "    padding: 10px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(235, 234, 225);"
        "}"
    );
    connect(createCancelButton, &QPushButton::clicked, this, &MainWindow::onCancelCreate);
    createButtonLayout->addWidget(createCancelButton);

    createLayout->addLayout(createButtonLayout);
}

void MainWindow::createSelectDialog()
{
    selectDialog = new QDialog(this);
    selectDialog->setWindowTitle("Seleccionar Autómata");
    selectDialog->setFixedSize(500, 400);
    selectDialog->setModal(true);

    selectLayout = new QVBoxLayout(selectDialog);
    selectLayout->setSpacing(20);
    selectLayout->setContentsMargins(30, 30, 30, 30);

    // Title
    selectTitleLabel = new QLabel("SELECCIONAR AUTÓMATA", selectDialog);
    selectTitleLabel->setFont(titleFont);
    selectTitleLabel->setAlignment(Qt::AlignCenter);
    selectTitleLabel->setStyleSheet("color: #000000; margin-bottom: 20px;");
    selectLayout->addWidget(selectTitleLabel);

    // Automaton list
    automatonList = new QListWidget(selectDialog);
    automatonList->setFont(textFont);
    automatonList->setStyleSheet(
        "QListWidget {"
        "    background-color: #FFFFFF;"
        "    color: #000000;"
        "    border: 2px solid #000000;"
        "    border-radius: 4px;"
        "    padding: 8px;"
        "    font-size: 14px;"
        "}"
        "QListWidget::item {"
        "    padding: 10px;"
        "    border-bottom: 1px solid #E0E0E0;"
        "}"
        "QListWidget::item:selected {"
        "    background-color: #FFFF00;"
        "    color: #000000;"
        "}"
        "QListWidget::item:hover {"
        "    background-color: #F0F0F0;"
        "}"
    );

    // Add some sample automatons for demonstration
    automatonList->addItem("Sample DFA - Even Length Strings");
    automatonList->addItem("Sample NFA - Contains 'ab'");
    automatonList->addItem("Sample DFA - Binary Numbers");
    automatonList->addItem("Sample NFA - Ends with '01'");

    selectLayout->addWidget(automatonList);

    // Button layout
    selectButtonLayout = new QHBoxLayout();
    selectButtonLayout->setSpacing(20);

    selectConfirmButton = new QPushButton("SELECCIONAR", selectDialog);
    selectConfirmButton->setFont(buttonFont);
    selectConfirmButton->setMinimumHeight(50);
    selectConfirmButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(240, 207, 96);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 0px;"
        "    font-weight: normal;"
        "    padding: 10px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(240, 207, 96);"
        "}"
    );
    connect(selectConfirmButton, &QPushButton::clicked, this, &MainWindow::onSelectAutomaton);
    selectButtonLayout->addWidget(selectConfirmButton);

    selectCancelButton = new QPushButton("CANCELAR", selectDialog);
    selectCancelButton->setFont(buttonFont);
    selectCancelButton->setMinimumHeight(50);
    selectCancelButton->setStyleSheet(
        "QPushButton {"
        "    background-color: rgb(255, 254, 245);"
        "    color: #000000;"
        "    border: 1px solid #000000;"
        "    border-radius: 0px;"
        "    font-weight: normal;"
        "    padding: 10px;"
        "}"
        "QPushButton:hover {"
        "    background-color: rgb(235, 234, 225);"
        "}"
    );
    connect(selectCancelButton, &QPushButton::clicked, this, &MainWindow::onCancelSelect);
    selectButtonLayout->addWidget(selectCancelButton);

    selectLayout->addLayout(selectButtonLayout);
}

void MainWindow::onCreateAutomaton()
{
    alphabetSelector->clearSelection();

    // Use exec() to open the dialog and wait for the user to finish.
    if (alphabetSelector->exec() == QDialog::Accepted) {
        // This code only runs if the user clicks "CONFIRMAR"

        // 1. Get the selected alphabet (now as a std::set)
        std::set<char> alphabet = alphabetSelector->getSelectedAlphabet();

        // 2. Ask the user for the automaton's name
        bool ok;
        QString name = QInputDialog::getText(this, "Nombre del Autómata",
                                             "Ingrese un nombre para el nuevo autómata:", QLineEdit::Normal,
                                             "", &ok);

        if (ok && !name.isEmpty()) {
            // 3. If we have a valid name, create and show the editor
            automatonEditor = new AutomatonEditor();
            automatonEditor->loadAutomaton(name, alphabet);
            automatonEditor->resize(1024, 768);
            automatonEditor->show();

            // 4. Hide the main menu
            this->hide();
        } else {
            // User cancelled the name input or left it empty
            QMessageBox::warning(this, "Cancelado", "La creación del autómata fue cancelada.");
        }
    }
}

void MainWindow::onSelectAutomaton()
{
    selectDialog->show();
}

void MainWindow::onSelectAlphabet()
{
    alphabetSelector->clearSelection();

    if (alphabetSelector->exec() == QDialog::Accepted) {
        auto alphabetVector = alphabetSelector->getSelectedAlphabet();
        selectedAlphabet.insert(alphabetVector.begin(), alphabetVector.end());

        // Update the display label
        if (selectedAlphabet.empty()) {
            selectedAlphabetLabel->setText("(ningún alfabeto seleccionado)");
            selectedAlphabetLabel->setStyleSheet(
                "color: #666666; "
                "background-color: #f0f0f0; "
                "padding: 8px; "
                "border: 1px solid #cccccc; "
                "border-radius: 4px;"
            );
        } else {
            QStringList charList;
            for (char ch : selectedAlphabet) {
                charList << QString(ch);
            }

            QString displayText = "Alfabeto: {" + charList.join(", ") + "}";
            selectedAlphabetLabel->setText(displayText);
            selectedAlphabetLabel->setStyleSheet(
                "color: #000000; "
                "background-color: #e6f3ff; "
                "padding: 8px; "
                "border: 1px solid #0066cc; "
                "border-radius: 4px;"
            );
        }
    }
}

void MainWindow::onCreateNewAutomaton()
{
    QString name = automatonNameEdit->text().trimmed();
    if (name.isEmpty()) {
        QMessageBox::warning(this, "Advertencia", "Por favor ingrese un nombre para el autómata.");
        return;
    }

    if (selectedAlphabet.empty()) {
        QMessageBox::warning(this, "Advertencia", "Por favor seleccione un alfabeto para el autómata.");
        return;
    }

    // --- NEW LOGIC STARTS HERE ---

    // 1. Create an instance of the editor
    automatonEditor = new AutomatonEditor();

    // 2. Load the automaton's data (name and alphabet) into the editor
    automatonEditor->loadAutomaton(name, selectedAlphabet);

    // 3. Set a default size and show the editor window
    automatonEditor->resize(1024, 768);
    automatonEditor->show();

    // 4. Hide the main menu window
    this->hide();

    // --- END OF NEW LOGIC ---

    // Clear the form and hide the creation dialog
    automatonNameEdit->clear();
    descriptionEdit->clear();
    selectedAlphabet.clear();
    selectedAlphabetLabel->setText("(ningún alfabeto seleccionado)");
    selectedAlphabetLabel->setStyleSheet(
        "color: #666666; "
        "background-color: #f0f0f0; "
        "padding: 8px; "
        "border: 1px solid #cccccc; "
        "border-radius: 4px;"
    );
    createDialog->hide();
}

void MainWindow::onCancelCreate()
{
    automatonNameEdit->clear();
    descriptionEdit->clear();
    selectedAlphabet.clear();
    selectedAlphabetLabel->setText("(ningún alfabeto seleccionado)");
    selectedAlphabetLabel->setStyleSheet(
        "color: #666666; "
        "background-color: #f0f0f0; "
        "padding: 8px; "
        "border: 1px solid #cccccc; "
        "border-radius: 4px;"
    );
    createDialog->hide();
}

void MainWindow::onCancelSelect()
{
    selectDialog->hide();
}

/**
 * @brief Set up hover animations for buttons
 * @param button The QPushButton to apply animations to
 *
 * Creates a custom event filter that adds cute hover effects to buttons:
 * - Growth: Button scales up by 20x10 pixels when hovered
 * - Shake: Continuous smooth horizontal oscillation (±3px) while hovering
 * - Smooth transitions: 800 ms animation cycle with infinite loop
 * - Return animation: Smooth scale-down when hover ends
 *
 * The animation system uses QPropertyAnimation with geometry manipulation
 * for precise control over size and position changes.
 */
void MainWindow::setupButtonAnimation(QPushButton* button)
{
    /**
     * @class AnimatedButton
     * @brief Custom event filter for button hover animations
     *
     * This inner class handles all hover-related animations by filtering
     * mouse enter/leave events and applying smooth property animations.
     */
    class AnimatedButton : public QObject
    {
    public:
        QPushButton* button;
        QPropertyAnimation* shakeAnimation;
        QRect originalGeometry;
        bool isHovering;

        AnimatedButton(QPushButton* btn) : QObject(btn), button(btn), isHovering(false)
        {
            originalGeometry = button->geometry();

            // Create smooth shake animation using geometry property
            shakeAnimation = new QPropertyAnimation(button, "geometry", this);
            shakeAnimation->setDuration(800);
            shakeAnimation->setEasingCurve(QEasingCurve::InOutSine);
            shakeAnimation->setLoopCount(-1); // Loop infinitely while hovering
        }

    protected:
        bool eventFilter(QObject* obj, QEvent* event) override
        {
            if (obj == button) {
                if (event->type() == QEvent::Enter) {
                    startHoverAnimation();
                } else if (event->type() == QEvent::Leave) {
                    stopHoverAnimation();
                }
            }
            return QObject::eventFilter(obj, event);
        }

    private:
        void startHoverAnimation()
        {
            isHovering = true;
            originalGeometry = button->geometry();

            // Scale up the button using the stylesheet
            QString currentStyle = button->styleSheet();
            QString newStyle = currentStyle + " QPushButton { transform: scale(1.1); }";
            button->setStyleSheet(newStyle);

            // Resize the button geometry for the scale effect
            QRect scaledGeometry = originalGeometry.adjusted(-10, -5, 10, 5);
            button->setGeometry(scaledGeometry);

            // Create a smooth shake with more keyframes for smoother motion
            QRect shakeLeft = scaledGeometry.adjusted(-3, 0, -3, 0);
            QRect shakeRight = scaledGeometry.adjusted(3, 0, 3, 0);

            shakeAnimation->setStartValue(scaledGeometry);
            shakeAnimation->setKeyValueAt(0.125, shakeLeft);
            shakeAnimation->setKeyValueAt(0.25, scaledGeometry);
            shakeAnimation->setKeyValueAt(0.375, shakeRight);
            shakeAnimation->setKeyValueAt(0.5, scaledGeometry);
            shakeAnimation->setKeyValueAt(0.625, shakeLeft);
            shakeAnimation->setKeyValueAt(0.75, scaledGeometry);
            shakeAnimation->setKeyValueAt(0.875, shakeRight);
            shakeAnimation->setEndValue(scaledGeometry);

            shakeAnimation->start();
        }

        void stopHoverAnimation()
        {
            isHovering = false;
            shakeAnimation->stop();

            // Reset stylesheet to remove scale
            QString currentStyle = button->styleSheet();
            currentStyle.remove(" QPushButton { transform: scale(1.1); }");
            button->setStyleSheet(currentStyle);

            // Return to the original size smoothly
            QPropertyAnimation* returnAnimation = new QPropertyAnimation(button, "geometry", this);
            returnAnimation->setDuration(150);
            returnAnimation->setEasingCurve(QEasingCurve::OutCubic);
            returnAnimation->setStartValue(button->geometry());
            returnAnimation->setEndValue(originalGeometry);

            connect(returnAnimation, &QPropertyAnimation::finished, returnAnimation, &QPropertyAnimation::deleteLater);
            returnAnimation->start();
        }
    };

    AnimatedButton* animatedButton = new AnimatedButton(button);
    button->installEventFilter(animatedButton);
}
