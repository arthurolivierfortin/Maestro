fix(ui): prevent crash when sidebar is empty

Add null checks for sidebar items to avoid NRE when rendering with empty collections.
