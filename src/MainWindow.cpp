#include "MainWindow.h"
#include <QApplication>
#include <QScreen>
#include <QMessageBox>
#include <QSizePolicy>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    setupWordleStyle();
    setupUI();
    createMainMenu();
    createCreateDialog();
    createSelectDialog();
}

MainWindow::~MainWindow()
{
}

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

void MainWindow::setupWordleStyle()
{
    // Updated color palette
    wordlePalette.setColor(QPalette::Window, QColor(255, 254, 245)); // Off-white background
    wordlePalette.setColor(QPalette::WindowText, QColor(0, 0, 0)); // Black text
    wordlePalette.setColor(QPalette::Button, QColor(240, 207, 96)); // Brown buttons
    wordlePalette.setColor(QPalette::ButtonText, QColor(0, 0, 0)); // Black button text
    wordlePalette.setColor(QPalette::Base, QColor(255, 255, 255)); // White input fields
    wordlePalette.setColor(QPalette::Text, QColor(0, 0, 0)); // Black input text
    wordlePalette.setColor(QPalette::Highlight, QColor(240, 207, 96)); // Brown highlight
    wordlePalette.setColor(QPalette::HighlightedText, QColor(255, 255, 255)); // White highlighted text

    setPalette(wordlePalette);

    // Updated fonts - try different Charter variations
    titleFont.setFamily("Charter");
    if (titleFont.family() != "Charter") {
        // Fallback options for Charter
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

    buttonFont.setFamily("Arial");
    buttonFont.setPointSize(16);
    buttonFont.setBold(true);

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

    // Create horizontal layout for buttons
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
    createDialog->show();
    automatonNameEdit->setFocus();
}

void MainWindow::onSelectAutomaton()
{
    selectDialog->show();
}

void MainWindow::onCreateNewAutomaton()
{
    QString name = automatonNameEdit->text().trimmed();
    if (name.isEmpty()) {
        QMessageBox::warning(this, "Advertencia", "Por favor ingrese un nombre para el autómata.");
        return;
    }

    QMessageBox::information(this, "Éxito",
        QString("¡Autómata '%1' creado exitosamente!\n\nIntegración con backend pendiente.").arg(name));

    // Clear the form
    automatonNameEdit->clear();
    descriptionEdit->clear();
    createDialog->hide();
}

void MainWindow::onCancelCreate()
{
    automatonNameEdit->clear();
    descriptionEdit->clear();
    createDialog->hide();
}

void MainWindow::onCancelSelect()
{
    selectDialog->hide();
}

void MainWindow::setupButtonAnimation(QPushButton* button)
{
    // Create a custom event filter class to handle hover events
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

            // Scale up the button using stylesheet
            QString currentStyle = button->styleSheet();
            QString newStyle = currentStyle + " QPushButton { transform: scale(1.1); }";
            button->setStyleSheet(newStyle);

            // Resize the button geometry for the scale effect
            QRect scaledGeometry = originalGeometry.adjusted(-10, -5, 10, 5);
            button->setGeometry(scaledGeometry);

            // Create smooth shake with more keyframes for smoother motion
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

            // Return to original size smoothly
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
