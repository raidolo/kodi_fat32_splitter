import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthProvider, useAuth as useOidcAuth } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

// Helper to get config
export const getRuntimeConfig = () => {
    const env = window._env_ || {};
    const get = (key, viteKey) => env[key] || import.meta.env[viteKey];

    return {
        oidcAuth: get('OIDC_AUTH', 'VITE_OIDC_AUTH') === 'true',
        authority: get('OIDC_AUTHORITY', 'VITE_OIDC_AUTHORITY'),
        clientId: get('OIDC_CLIENT_ID', 'VITE_OIDC_CLIENT_ID'),
        oidcLogout: get('OIDC_LOGOUT', 'VITE_OIDC_LOGOUT'),
    };
};

const UnifiedAuthContext = createContext(null);

const UnifiedAuthContent = ({ children, oidcEnabled }) => {
    const oidc = oidcEnabled ? useOidcAuth() : null;
    const [localToken, setLocalToken] = useState(localStorage.getItem('kodi_local_token'));
    const [localUser, setLocalUser] = useState(null);
    const [loadingLocal, setLoadingLocal] = useState(!!localToken);

    // Initial check for local user if token exists
    useEffect(() => {
        if (localToken) {
            setLoadingLocal(true);
            fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${localToken}` }
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Invalid token');
                })
                .then(user => {
                    user.profile = { name: "Admin", preferred_username: user.email };
                    setLocalUser(user);
                })
                .catch(() => {
                    setLocalToken(null);
                    localStorage.removeItem('kodi_local_token');
                })
                .finally(() => setLoadingLocal(false));
        } else {
            setLoadingLocal(false);
        }
    }, [localToken]);

    const loginLocal = async (email, password) => {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Login failed');
        }

        const data = await res.json();
        setAuthToken(data.access_token);
    };

    const setAuthToken = (token) => {
        if (token) {
            localStorage.setItem('kodi_local_token', token);
            setLocalToken(token);
        } else {
            localStorage.removeItem('kodi_local_token');
            setLocalToken(null);
            setLocalUser(null);
        }
    };

    const logout = () => {
        if (localToken) {
            setLocalToken(null);
            setLocalUser(null);
            localStorage.removeItem('kodi_local_token');
        }
        if (oidcEnabled && oidc.isAuthenticated) {
            oidc.removeUser();
        }
    };

    const isAuthenticated = (oidcEnabled && oidc.isAuthenticated) || !!localToken;
    const isLoading = (oidcEnabled && oidc.isLoading) || loadingLocal;

    // Normalize user object
    let user = null;
    if (isAuthenticated) {
        if (oidcEnabled && oidc.user) {
            user = {
                ...oidc.user,
                email: oidc.user.profile.email || oidc.user.profile.preferred_username,
                token: oidc.user.access_token,
                isOidc: true
            };
        } else if (localUser) {
            user = {
                ...localUser,
                token: localToken,
                isOidc: false
            };
        }
    }

    const value = {
        isAuthenticated,
        user,
        isLoading,
        loginLocal,
        setAuthToken,
        logout,
        signinRedirect: oidcEnabled ? oidc.signinRedirect : () => { },
        signoutRedirect: oidcEnabled ? oidc.signoutRedirect : () => { },
        oidcEnabled
    };

    return (
        <UnifiedAuthContext.Provider value={value}>
            {children}
        </UnifiedAuthContext.Provider>
    );
};

export const AuthProviderWrapper = ({ children }) => {
    const config = getRuntimeConfig();

    if (config.oidcAuth) {
        const oidcConfig = {
            authority: config.authority,
            client_id: config.clientId,
            redirect_uri: window.location.origin,
            silent_redirect_uri: window.location.origin + "/silent-renew.html",
            response_type: "code",
            scope: "openid profile email",
            userStore: new WebStorageStateStore({ store: window.localStorage }),
            automaticSilentRenew: true,
            onSigninCallback: () => {
                window.history.replaceState({}, document.title, window.location.pathname);
            },
            monitorSession: false // Disable session monitoring to prevent polling loops
        };

        return (
            <AuthProvider {...oidcConfig}>
                <UnifiedAuthContent oidcEnabled={true}>
                    {children}
                </UnifiedAuthContent>
            </AuthProvider>
        );
    }

    return (
        <UnifiedAuthContent oidcEnabled={false}>
            {children}
        </UnifiedAuthContent>
    );
};

export const useAppAuth = () => {
    return useContext(UnifiedAuthContext);
};
