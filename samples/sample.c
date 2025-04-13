#include <stdio.h>
#include <stdlib.h>

int 
test(

)
{int name = 0;
        return name;}

// global host-variables
EXEC SQL BEGIN DECLARE SECTION;
int global_id;
char global_name[50];
EXEC SQL END DECLARE SECTION;

int main() {
    // Example of embedded SQL in C EXEC SQL nope;
    // EXEC SQL;
    /*
    /*
        EXEC SQL BEGIN DECLARE SECTION;
    */
    char address;
    if (test() == 0) {
        ;
    }

    EXEC SQL SELECT id, 'test' INTO :global_id, :global_name FROM employees WHERE id = 1;

    printf("Embedded SQL sample\n");
    return 0;
}

void select_by_id(int id) {
    EXEC SQL BEGIN DECLARE SECTION;
    char name[50];
    char address;
    int age;
    long item = 0;
    EXEC SQL END DECLARE SECTION;

    memset(name, 0, sizeof(name));
    
    EXEC SQL SELECT name 
        INTO :name 
        FROM employees 
        WHERE id = :id;

    printf("Selected name: %s\n", name);
}