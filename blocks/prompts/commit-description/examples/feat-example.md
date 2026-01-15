feat(auth): add token refresh handler

Adds a refresh routine that automatically obtains a new access token when the current one expires. This reduces user friction and avoids 401s during long-running sessions.
