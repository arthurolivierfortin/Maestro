refactor(storage): split repository responsibilities

Extract persistence logic into `FileSystemRepository` and `DbRepository` to follow SRP and simplify testing.
