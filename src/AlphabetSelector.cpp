#include "AlphabetSelector.h"
#include <QApplication>
#include <QScreen>
#include <QMessageBox>
#include <algorithm>
#include <QTabBar> // <-- Add this line
#include "FlowLayout.h"

FlowLayout::FlowLayout(QWidget *parent, int margin, int hSpacing, int vSpacing)
    : QLayout(parent), m_hSpace(hSpacing), m_vSpace(vSpacing)
{
    setContentsMargins(margin, margin, margin, margin);
}

FlowLayout::FlowLayout(int margin, int hSpacing, int vSpacing)
    : m_hSpace(hSpacing), m_vSpace(vSpacing)
{
    setContentsMargins(margin, margin, margin, margin);
}

FlowLayout::~FlowLayout()
{
    QLayoutItem *item;
    while ((item = takeAt(0)))
        delete item;
}

void FlowLayout::addItem(QLayoutItem *item)
{
    itemList.append(item);
}

int FlowLayout::horizontalSpacing() const
{
    if (m_hSpace >= 0) {
        return m_hSpace;
    } else {
        return smartSpacing(QStyle::PM_LayoutHorizontalSpacing);
    }
}

int FlowLayout::verticalSpacing() const
{
    if (m_vSpace >= 0) {
        return m_vSpace;
    } else {
        return smartSpacing(QStyle::PM_LayoutVerticalSpacing);
    }
}

int FlowLayout::count() const
{
    return itemList.size();
}

QLayoutItem *FlowLayout::itemAt(int index) const
{
    return itemList.value(index);
}

QLayoutItem *FlowLayout::takeAt(int index)
{
    if (index >= 0 && index < itemList.size())
        return itemList.takeAt(index);
    return nullptr;
}

Qt::Orientations FlowLayout::expandingDirections() const
{
    return Qt::Orientations(0);
}

bool FlowLayout::hasHeightForWidth() const
{
    return true;
}

int FlowLayout::heightForWidth(int width) const
{
    int height = doLayout(QRect(0, 0, width, 0), true);
    return height;
}

void FlowLayout::setGeometry(const QRect &rect)
{
    QLayout::setGeometry(rect);
    doLayout(rect, false);
}

QSize FlowLayout::sizeHint() const
{
    return minimumSize();
}

QSize FlowLayout::minimumSize() const
{
    QSize size;
    for (const QLayoutItem *item : qAsConst(itemList))
        size = size.expandedTo(item->minimumSize());

    const QMargins margins = contentsMargins();
    size += QSize(margins.left() + margins.right(), margins.top() + margins.bottom());
    return size;
}

int FlowLayout::doLayout(const QRect &rect, bool testOnly) const
{
    int left, top, right, bottom;
    getContentsMargins(&left, &top, &right, &bottom);
    QRect effectiveRect = rect.adjusted(+left, +top, -right, -bottom);
    int x = effectiveRect.x();
    int y = effectiveRect.y();
    int lineHeight = 0;

    for (QLayoutItem *item : qAsConst(itemList)) {
        QWidget *wid = item->widget();
        int spaceX = horizontalSpacing();
        if (spaceX == -1)
            spaceX = wid->style()->layoutSpacing(QSizePolicy::PushButton, QSizePolicy::PushButton, Qt::Horizontal);
        int spaceY = verticalSpacing();
        if (spaceY == -1)
            spaceY = wid->style()->layoutSpacing(QSizePolicy::PushButton, QSizePolicy::PushButton, Qt::Vertical);

        int nextX = x + item->sizeHint().width() + spaceX;
        if (nextX - spaceX > effectiveRect.right() && lineHeight > 0) {
            x = effectiveRect.x();
            y = y + lineHeight + spaceY;
            nextX = x + item->sizeHint().width() + spaceX;
            lineHeight = 0;
        }

        if (!testOnly)
            item->setGeometry(QRect(QPoint(x, y), item->sizeHint()));

        x = nextX;
        lineHeight = qMax(lineHeight, item->sizeHint().height());
    }
    return y + lineHeight - effectiveRect.y() + bottom;
}

int FlowLayout::smartSpacing(QStyle::PixelMetric pm) const
{
    QObject *parent = this->parent();
    if (!parent) {
        return -1;
    } else if (parent->isWidgetType()) {
        QWidget *pw = static_cast<QWidget *>(parent);
        return pw->style()->pixelMetric(pm, nullptr, pw);
    } else {
        return static_cast<QLayout *>(parent)->spacing();
    }
}

// File-scope color constants (warm palette — no blue, green or red)
static const QString kColorBg                 = "#FFFEF5"; // warm off-white
static const QString kColorButton             = "#F0CF60"; // cream/yellow
static const QString kColorButtonHover        = "#DCBB4C";
static const QString kColorButtonPressed      = "#C8A738";
static const QString kColorSelected           = "#A8781E"; // darker golden/brown for "selected"
static const QString kColorSelectedHover      = "#8C6118";
static const QString kColorSelectedPressed    = "#6F4810";
static const QString kColorText               = "#000000"; // black
static const QString kColorMutedText          = "#666666";
static const QString kColorInput              = "#FFFFFF"; // white input
static const QString kColorSelectedDisplayBg  = "#FFF9E6"; // light warm background for selected display
static const QString kColorSelectedDisplayBd  = "#B8860B"; // goldenrod border
static const QString kColorMutedBorder        = "#CCCCCC";
static const QString kColorCancel             = "#B4B4B4"; // neutral gray for cancel/less-prominent actions

const QString AlphabetSelector::UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const QString AlphabetSelector::LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const QString AlphabetSelector::SYMBOL_CHARS    = "0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~";

AlphabetSelector::AlphabetSelector(QWidget *parent)
    : QDialog(parent)
{
    setupStyling();
    setupUI();

    // Center the dialog
    QScreen *screen = QApplication::primaryScreen();
    QRect screenGeometry = screen->availableGeometry();
    int x = (screenGeometry.width() - 800) / 2;
    int y = (screenGeometry.height() - 600) / 2;
    setGeometry(x, y, 800, 600);

    setWindowTitle("Seleccionar Alfabeto");
    setModal(true);
}

AlphabetSelector::~AlphabetSelector()
{
}

void AlphabetSelector::setupStyling()
{
    // Use the same fonts defined in MainWindow for consistency

    // Title font: Charter Roman with fallbacks
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
    titleFont.setPointSize(24); // Size adjusted for the dialog
    titleFont.setBold(true);

    // Button font: Bold Arial for clear readability
    buttonFont.setFamily("Arial");
    buttonFont.setPointSize(16);
    buttonFont.setBold(true);

    // Character button font: Bold Arial
    charFont.setFamily("Arial");
    charFont.setPointSize(14);
    charFont.setBold(true);

    // Palette using warm tones only
    customPalette.setColor(QPalette::Window, QColor(kColorBg));
    customPalette.setColor(QPalette::WindowText, QColor(kColorText));
    customPalette.setColor(QPalette::Button, QColor(kColorButton));
    customPalette.setColor(QPalette::ButtonText, QColor(kColorText));
    customPalette.setColor(QPalette::Base, QColor(kColorInput));
    customPalette.setColor(QPalette::Text, QColor(kColorText));
    customPalette.setColor(QPalette::Highlight, QColor(kColorSelected));
    customPalette.setColor(QPalette::HighlightedText, QColor(kColorText));

    setPalette(customPalette);
}

void AlphabetSelector::setupUI()
{
    mainLayout = new QVBoxLayout(this);
    mainLayout->setSpacing(20);
    mainLayout->setContentsMargins(30, 30, 30, 30);

    // Title
    titleLabel = new QLabel("Seleccionar Caracteres del Alfabeto", this);
    titleLabel->setFont(titleFont);
    titleLabel->setAlignment(Qt::AlignCenter);
    titleLabel->setStyleSheet(QString("color: %1; margin-bottom: 10px;").arg(kColorText));
    mainLayout->addWidget(titleLabel);

    // Selected characters display
    selectedLabel = new QLabel("Caracteres seleccionados:", this);
    selectedLabel->setFont(buttonFont);
    selectedLabel->setStyleSheet(QString("color: %1;").arg(kColorText));
    mainLayout->addWidget(selectedLabel);

    selectedCharsLabel = new QLabel("(ninguno)", this);
    selectedCharsLabel->setFont(QFont(QApplication::font().family(), 12));
    selectedCharsLabel->setStyleSheet(
        QString("color: %1; background-color: %2; padding: 10px; border: 1px solid %3; border-radius: 5px; min-height: 20px;")
               .arg(kColorMutedText)
               .arg("#f0f0f0")
               .arg(kColorMutedBorder)
    );
    selectedCharsLabel->setWordWrap(true);
    mainLayout->addWidget(selectedCharsLabel);

    // Create tabs
    createTabs();
    mainLayout->addWidget(tabWidget);

    // Create bottom buttons
    createButtonLayout();
    mainLayout->addLayout(buttonLayout);
}

void AlphabetSelector::createTabs()
{
    tabWidget = new QTabWidget(this);

    // This line should remain, as it's still good practice.
    tabWidget->tabBar()->setExpanding(false);

    QString tabStyle = QString(
    "QTabWidget::pane { border: 1px solid %1; background-color: %2; }"
        // --- START OF FIX ---
        "QTabWidget::tab-bar { alignment: left; }" // Use a more specific selector
        // --- END OF FIX ---
        "QTabBar::tab:first { margin-left: 0; }"
        "QTabBar::tab { background-color: %3; color: %4; padding: 8px 20px; margin-right: 2px; border: 1px solid %5; font-weight: bold; }"
        "QTabBar::tab:selected { background-color: %6; color: %7; border: 2px solid %8; }"
        "QTabBar::tab:hover:!selected { background-color: %9; }"
        "QTabBar::tab:selected:hover { background-color: %10; }"
        "QTabBar::tab:pressed { background-color: %11; }"
    ).arg(kColorMutedBorder)
     .arg(kColorBg)
     .arg(kColorButton)
     .arg(kColorText)
     .arg(kColorText)
     .arg(kColorSelected)
     .arg("#FFFFFF")
     .arg(kColorSelectedDisplayBd)
     .arg(kColorButtonHover)
     .arg(kColorSelectedHover)
     .arg(kColorButtonPressed);

    tabWidget->setStyleSheet(tabStyle);

    // Create tabs
    QWidget* uppercaseTab = createKeyboardTab(UPPERCASE_CHARS, "Mayúsculas");
    QWidget* lowercaseTab = createKeyboardTab(LOWERCASE_CHARS, "Minúsculas");
    QWidget* symbolsTab = createKeyboardTab(SYMBOL_CHARS, "Símbolos");

    tabWidget->addTab(uppercaseTab, "Mayúsculas");
    tabWidget->addTab(lowercaseTab, "Minúsculas");
    tabWidget->addTab(symbolsTab, "Símbolos");
}

QWidget* AlphabetSelector::createKeyboardTab(const QString& characters, const QString& tabName)
{
    QWidget* tab = new QWidget();
    QScrollArea* scrollArea = new QScrollArea(tab);
    scrollArea->setWidgetResizable(true);
    scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAsNeeded);
    scrollArea->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);

    // Force the scroll area to be transparent
    scrollArea->setStyleSheet("QScrollArea { background: transparent; border: none; }");
    scrollArea->viewport()->setStyleSheet("background: transparent;");

    QWidget* scrollWidget = new QWidget();

    // --- START OF CHANGES ---
    // Use FlowLayout instead of QGridLayout
    FlowLayout* flowLayout = new FlowLayout(scrollWidget, 10, 5, 5);
    // --- END OF CHANGES ---

    for (int i = 0; i < characters.length(); ++i) {
        char ch = characters[i].toLatin1();
        QPushButton* charButton = new QPushButton(QString(ch), scrollWidget);
        charButton->setFont(charFont);
        charButton->setFixedSize(50, 50);
        charButton->setProperty("character", ch);

        styleCharacterButton(charButton, false);

        connect(charButton, &QPushButton::clicked, this, &AlphabetSelector::onCharacterButtonClicked);

        allCharButtons.append(charButton);

        // --- START OF CHANGES ---
        // Just add the button; the flow layout handles the rest
        flowLayout->addWidget(charButton);
        // --- END OF CHANGES ---
    }

    scrollArea->setWidget(scrollWidget);

    QVBoxLayout* tabLayout = new QVBoxLayout(tab);
    tabLayout->setContentsMargins(0, 0, 0, 0);
    tabLayout->addWidget(scrollArea);

    return tab;
}

void AlphabetSelector::styleCharacterButton(QPushButton* button, bool selected)
{
    if (selected) {
        QString style = QString(
            "QPushButton { "
            "    background-color: %1; "
            "    color: %2; "
            "    border: 2px solid %3; "
            "    border-radius: 5px; "
            "    font-weight: bold; "
            "} "
            "QPushButton:hover { "
            "    background-color: %4; "
            "} "
            "QPushButton:pressed { "
            "    background-color: %5; "
            "}"
        ).arg(kColorSelected)
         .arg("#FFFFFF")
         .arg(kColorSelectedDisplayBd)
         .arg(kColorSelectedHover)
         .arg(kColorSelectedPressed);

        button->setStyleSheet(style);
    } else {
        QString style = QString(
            "QPushButton { "
            "    background-color: %1; "
            "    color: %2; "
            "    border: 1px solid %3; "
            "    border-radius: 5px; "
            "    font-weight: bold; "
            "} "
            "QPushButton:hover { "
            "    background-color: %4; "
            "} "
            "QPushButton:pressed { "
            "    background-color: %5; "
            "}"
        ).arg(kColorButton)
         .arg(kColorText)
         .arg(kColorText)
         .arg(kColorButtonHover)
         .arg(kColorButtonPressed);

        button->setStyleSheet(style);
    }
}

void AlphabetSelector::createButtonLayout()
{
    buttonLayout = new QHBoxLayout();
    buttonLayout->setSpacing(15);

    // Select All button (uses warm accent — not green)
    selectAllButton = new QPushButton("Seleccionar Todo", this);
    selectAllButton->setFont(buttonFont);
    selectAllButton->setMinimumSize(120, 40);
    selectAllButton->setStyleSheet(QString(
        "QPushButton { background-color: %1; color: %2; border: 1px solid %3; border-radius: 5px; padding: 8px 16px; }"
        "QPushButton:hover { background-color: %4; }"
        "QPushButton:pressed { background-color: %5; }"
    ).arg(kColorButton).arg(kColorText).arg(kColorText).arg(kColorButtonHover).arg(kColorButtonPressed));
    connect(selectAllButton, &QPushButton::clicked, this, &AlphabetSelector::onSelectAll);

    // Clear All button (neutral gray — not red)
    clearAllButton = new QPushButton("Limpiar Todo", this);
    clearAllButton->setFont(buttonFont);
    clearAllButton->setMinimumSize(120, 40);
    clearAllButton->setStyleSheet(QString(
        "QPushButton { background-color: %1; color: %2; border: 1px solid %3; border-radius: 5px; padding: 8px 16px; }"
        "QPushButton:hover { background-color: %4; }"
        "QPushButton:pressed { background-color: %5; }"
    ).arg(kColorCancel).arg(kColorText).arg(kColorText).arg(kColorCancel).arg(kColorCancel));
    connect(clearAllButton, &QPushButton::clicked, this, &AlphabetSelector::onClearAll);

    buttonLayout->addWidget(selectAllButton);
    buttonLayout->addWidget(clearAllButton);
    buttonLayout->addStretch();

    // Confirm button
    confirmButton = new QPushButton("CONFIRMAR", this);
    confirmButton->setFont(buttonFont);
    confirmButton->setMinimumSize(120, 40);
    confirmButton->setStyleSheet(QString(
        "QPushButton { background-color: %1; color: %2; border: 1px solid %3; border-radius: 5px; padding: 8px 16px; }"
        "QPushButton:hover { background-color: %4; }"
        "QPushButton:pressed { background-color: %5; }"
    ).arg(kColorButton).arg(kColorText).arg(kColorText).arg(kColorButtonHover).arg(kColorButtonPressed));
    connect(confirmButton, &QPushButton::clicked, this, &AlphabetSelector::onConfirm);

    // Cancel button
    cancelButton = new QPushButton("CANCELAR", this);
    cancelButton->setFont(buttonFont);
    cancelButton->setMinimumSize(120, 40);
    cancelButton->setStyleSheet(QString(
        "QPushButton { background-color: %1; color: %2; border: 1px solid %3; border-radius: 5px; padding: 8px 16px; }"
        "QPushButton:hover { background-color: %4; }"
        "QPushButton:pressed { background-color: %5; }"
    ).arg(kColorCancel).arg(kColorText).arg(kColorText).arg(kColorCancel).arg(kColorCancel));
    connect(cancelButton, &QPushButton::clicked, this, &AlphabetSelector::onCancel);

    buttonLayout->addWidget(confirmButton);
    buttonLayout->addWidget(cancelButton);
}

void AlphabetSelector::onCharacterButtonClicked()
{
    QPushButton* button = qobject_cast<QPushButton*>(sender());
    if (!button) return;

    char ch = button->property("character").toChar().toLatin1();

    if (selectedChars.contains(ch)) {
        selectedChars.remove(ch);
        styleCharacterButton(button, false);
    } else {
        selectedChars.insert(ch);
        styleCharacterButton(button, true);
    }

    updateSelectedDisplay();
}

void AlphabetSelector::onSelectAll()
{
    // Get characters from current tab
    int currentTab = tabWidget->currentIndex();
    QString characters;

    switch (currentTab) {
        case 0: characters = UPPERCASE_CHARS; break;
        case 1: characters = LOWERCASE_CHARS; break;
        case 2: characters = SYMBOL_CHARS; break;
    }

    for (int i = 0; i < characters.length(); ++i) {
        char ch = characters[i].toLatin1();
        selectedChars.insert(ch);
    }

    // Update button styles
    for (QPushButton* button : allCharButtons) {
        char ch = button->property("character").toChar().toLatin1();
        styleCharacterButton(button, selectedChars.contains(ch));
    }

    updateSelectedDisplay();
}

void AlphabetSelector::onClearAll()
{
    selectedChars.clear();

    // Update all button styles
    for (QPushButton* button : allCharButtons) {
        styleCharacterButton(button, false);
    }

    updateSelectedDisplay();
}

void AlphabetSelector::onConfirm()
{
    if (selectedChars.isEmpty()) {
        QMessageBox::warning(this, "Advertencia",
                           "Debe seleccionar al menos un carácter para el alfabeto.");
        return;
    }

    accept();
}

void AlphabetSelector::onCancel()
{
    reject();
}

void AlphabetSelector::updateSelectedDisplay()
{
    if (selectedChars.isEmpty()) {
        selectedCharsLabel->setText("(ninguno)");
        selectedCharsLabel->setStyleSheet(
            QString("color: %1; background-color: %2; padding: 10px; border: 1px solid %3; border-radius: 5px; min-height: 20px;")
                   .arg(kColorMutedText)
                   .arg("#f0f0f0")
                   .arg(kColorMutedBorder)
        );
    } else {
        QStringList charList;
        QList<char> sortedChars = selectedChars.values();
        std::sort(sortedChars.begin(), sortedChars.end());

        for (char ch : sortedChars) {
            charList << QString(ch);
        }

        QString displayText = charList.join(", ");
        selectedCharsLabel->setText(displayText);
        selectedCharsLabel->setStyleSheet(
            QString("color: %1; background-color: %2; padding: 10px; border: 1px solid %3; border-radius: 5px; min-height: 20px;")
                   .arg(kColorText)
                   .arg(kColorSelectedDisplayBg)
                   .arg(kColorSelectedDisplayBd)
        );
    }
}

std::vector<char> AlphabetSelector::getSelectedAlphabet() const
{
    std::vector<char> alphabet;
    QList<char> sortedChars = selectedChars.values();
    std::sort(sortedChars.begin(), sortedChars.end());

    for (char ch : sortedChars) {
        alphabet.push_back(ch);
    }

    return alphabet;
}

void AlphabetSelector::clearSelection()
{
    selectedChars.clear();

    for (QPushButton* button : allCharButtons) {
        styleCharacterButton(button, false);
    }

    updateSelectedDisplay();
}
