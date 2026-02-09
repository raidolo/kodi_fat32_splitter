#!/bin/sh

# Default values if not set
export OIDC_AUTH=${OIDC_AUTH:-false}
export OIDC_AUTHORITY=${OIDC_AUTHORITY:-""}
export OIDC_CLIENT_ID=${OIDC_CLIENT_ID:-""}
export OIDC_LOGOUT=${OIDC_LOGOUT:-""}

# Create config.js with current environment variables
echo "window._env_ = {" > /usr/share/nginx/html/config.js
echo "  OIDC_AUTH: \"$OIDC_AUTH\"," >> /usr/share/nginx/html/config.js
echo "  OIDC_AUTHORITY: \"$OIDC_AUTHORITY\"," >> /usr/share/nginx/html/config.js
echo "  OIDC_CLIENT_ID: \"$OIDC_CLIENT_ID\"," >> /usr/share/nginx/html/config.js
echo "  OIDC_LOGOUT: \"$OIDC_LOGOUT\"" >> /usr/share/nginx/html/config.js
echo "};" >> /usr/share/nginx/html/config.js

# Execute the CMD (nginx)
exec "$@"
