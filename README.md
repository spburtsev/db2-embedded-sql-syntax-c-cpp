# Db2 embedded SQL syntax for C/C++

## Features

This extension provides syntax highlighting and snippets for [Db2 embedded SQL statements in C/C++ code][examples].

- Syntax highlighting for embedded SQL statements in C/C++ files
- Enhanced C syntax highlighting via Better C Syntax
- Enhanced C++ syntax highlighting via Better C++ Syntax
- Full support for .sqc files (C source files with embedded IBM Db2 SQL)
- Full support for .sqC files (C++ source files with embedded IBM Db2 SQL)
- Snippets for common SQL operations

![highlighting example](images/highlighting-1.png)

## Release Notes

### 0.3.0

- Enhanced C/C++ syntax highlighting
- Added support for .sqc files (C source files with embedded IBM Db2 SQL)
- Added support for .sqC files (C++ source files with embedded IBM Db2 SQL)

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

## SQC Files

This extension provides full syntax highlighting for both .sqc and .sqC files:

- **.sqc** - C source files containing embedded SQL statements (common in IBM Db2 application development)
- **.sqC** - C++ source files containing embedded SQL statements

The syntax highlighting combines:
1. Enhanced language syntax (C or C++) from the respective Better Syntax project
2. Embedded SQL syntax for Db2 statements

## Special Sections

SQL declare sections are specially highlighted and can be folded in the editor:

```c
EXEC SQL BEGIN DECLARE SECTION;
// Host variables here
EXEC SQL END DECLARE SECTION;
```

[examples]: https://www.ibm.com/docs/en/db2-for-zos/12.0.0?topic=statements-c-c-programming-examples