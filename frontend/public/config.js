// This file is overwritten by entrypoint.sh in production.
// In development, it falls back to this (or import.meta.env).
window._env_ = {
    OIDC_AUTH: "false",
    OIDC_AUTHORITY: "",
    OIDC_CLIENT_ID: ""
};
