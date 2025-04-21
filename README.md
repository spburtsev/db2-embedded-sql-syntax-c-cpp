# Db2 embedded SQL syntax for C/C++

## Features

This extension provides syntax highlighting and snippets for [Db2 embedded SQL statements in C/C++ code][examples].

![highlighting example](images/highlighting-1.png)

## Release Notes

### 0.3.0

Automatic language mode detection for C/C++ files with embedded SQL

### 0.2.0

Some snippets for SQL statements added

### 0.1.0

Initial release with basic syntax highlighting for embedded SQL keywords, types and functions

## Snippets

Below is a list of all available snippets and the triggers of each one. The **⇥** means the `TAB` key.

|  Trigger       | Content                                  |
| -------------: | ---------------------------------------- |
|   `db2declhv→` | Declare host variables section           |
|  `db2declcur→` | Declare cursor                           |
|  `db2opencur→` | Open cursor                              |
|    `db2fetch→` | Fetch from cursor                        |
| `db2closecur→` | Close currsor                            |
|      `db2inc→` | Include member (SQLCA, SQLDA or custom)  |
|   `db2select→` | Select                                   |
|   `db2commit→` | Commit                                   |

[examples]: https://www.ibm.com/docs/en/db2-for-zos/12.0.0?topic=statements-c-c-programming-examples