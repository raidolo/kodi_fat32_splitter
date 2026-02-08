import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthProvider, useAuth as useOidcAuth } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

const RuntimeConfigContext = createContext(null);

// Helper to get config
export const getRuntimeConfig = () => {
    // If running in Docker (prod), window._env_ should be populated by entrypoint.sh
    // If running locally (dev), fall back to import.meta.env
    const env = window._env_ || {};

    // Helper to read with fallback
    const get = (key, viteKey) => env[key] || import.meta.env[viteKey];

    return {
        oidcAuth: get('OIDC_AUTH', 'VITE_OIDC_AUTH') === 'true', // Default to false if missing, or check string
        authority: get('OIDC_AUTHORITY', 'VITE_OIDC_AUTHORITY'),
        clientId: get('OIDC_CLIENT_ID', 'VITE_OIDC_CLIENT_ID'),
        clientSecret: get('OIDC_CLIENT_SECRET', 'VITE_OIDC_CLIENT_SECRET'),
        oidcLogout: get('OIDC_LOGOUT', 'VITE_OIDC_LOGOUT'),
    };
};

const MockAuthContext = createContext(null);

export const AuthProviderWrapper = ({ children }) => {
    const config = getRuntimeConfig();

    // OIDC Configuration
    const oidcConfig = {
        authority: config.authority,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: window.location.origin,
        silent_redirect_uri: window.location.origin + "/silent-renew.html",
        response_type: "code",
        scope: "openid profile email",
        userStore: new WebStorageStateStore({ store: window.localStorage }),
        automaticSilentRenew: true,
        onSigninCallback: () => {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    if (config.oidcAuth) {
        return (
            <AuthProvider {...oidcConfig}>
                {children}
            </AuthProvider>
        );
    } else {
        // Mock Auth Provider Logic
        const mockAuth = {
            isAuthenticated: true,
            user: { profile: { name: "Local User", preferred_username: "admin" } },
            isLoading: false,
            signinRedirect: () => console.log("Mock Login"),
            removeUser: () => console.log("Mock Logout"),
            error: null
        };

        return (
            <MockAuthContext.Provider value={mockAuth}>
                {children}
            </MockAuthContext.Provider>
        );
    }
};

// Custom Hook to replace useAuth anywhere in the app
export const useAppAuth = () => {
    const config = getRuntimeConfig();

    if (config.oidcAuth) {
        return useOidcAuth();
    } else {
        return useContext(MockAuthContext);
    }
};
