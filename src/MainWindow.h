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

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void onCreateAutomaton();
    void onSelectAutomaton();
    void onCreateNewAutomaton();
    void onCancelCreate();
    void onCancelSelect();

private:
    void setupUI();
    void setupWordleStyle();
    void createMainMenu();
    void createCreateDialog();
    void createSelectDialog();
    void setupButtonAnimation(QPushButton* button);
    
    // Main UI components
    QWidget *centralWidget;
    QVBoxLayout *mainLayout;
    QLabel *titleLabel;
    QPushButton *createButton;
    QPushButton *selectButton;
    
    // Create Automaton Dialog
    QDialog *createDialog;
    QVBoxLayout *createLayout;
    QLabel *createTitleLabel;
    QLineEdit *automatonNameEdit;
    QTextEdit *descriptionEdit;
    QHBoxLayout *createButtonLayout;
    QPushButton *createConfirmButton;
    QPushButton *createCancelButton;
    
    // Select Automaton Dialog
    QDialog *selectDialog;
    QVBoxLayout *selectLayout;
    QLabel *selectTitleLabel;
    QListWidget *automatonList;
    QHBoxLayout *selectButtonLayout;
    QPushButton *selectConfirmButton;
    QPushButton *selectCancelButton;
    
    // Wordle-like styling
    QPalette wordlePalette;
    QFont titleFont;
    QFont buttonFont;
    QFont textFont;
};

#endif // MAINWINDOW_H
