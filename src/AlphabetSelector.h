#ifndef ALPHABETSELECTOR_H
#define ALPHABETSELECTOR_H

#include <QDialog>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QGridLayout>
#include <QTabWidget>
#include <QPushButton>
#include <QLabel>
#include <QSet>
#include <QScrollArea>
#include <QWidget>
#include <QFont>
#include <QPalette>
#include "Alfabeto.h"
#include <set>

class AlphabetSelector : public QDialog
{
    Q_OBJECT

public:
    explicit AlphabetSelector(QWidget *parent = nullptr);
    ~AlphabetSelector();

    std::set<char> getSelectedAlphabet() const;
    void clearSelection();

private slots:
    void onCharacterButtonClicked();
    void onSelectAll();
    void onClearAll();
    void onConfirm();
    void onCancel();

private:
    void setupUI();
    void setupStyling();
    void createTabs();
    void createButtonLayout();
    QWidget* createKeyboardTab(const QString& characters, const QString& tabName);
    void updateSelectedDisplay();
    void styleCharacterButton(QPushButton* button, bool selected = false);
    
    // UI Components
    QVBoxLayout* mainLayout;
    QTabWidget* tabWidget;
    QLabel* titleLabel;
    QLabel* selectedLabel;
    QLabel* selectedCharsLabel;
    QHBoxLayout* buttonLayout;
    QPushButton* selectAllButton;
    QPushButton* clearAllButton;
    QPushButton* confirmButton;
    QPushButton* cancelButton;
    
    // Data
    QSet<char> selectedChars;
    QList<QPushButton*> allCharButtons;
    
    // Styling
    QFont titleFont;
    QFont buttonFont;
    QFont charFont;
    QPalette customPalette;
    
    // Character sets
    static const QString UPPERCASE_CHARS;
    static const QString LOWERCASE_CHARS;
    static const QString SYMBOL_CHARS;
};

#endif // ALPHABETSELECTOR_H