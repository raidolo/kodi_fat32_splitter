import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const useSettingsStore = create((set, get) => ({
    settings: {
        theme: 'dark',
        include_subtitles: true
    },
    loading: false,
    error: null,
    successMessage: null,

    setSuccessMessage: (msg) => set({ successMessage: msg }),

    fetchSettings: async (token) => {
        set({ loading: true });
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await axios.get(`${API_URL}/settings`, { headers });
            const newSettings = response.data;
            set({ settings: newSettings, loading: false });

            // Apply theme immediately
            if (newSettings.theme) {
                document.documentElement.setAttribute('data-theme', newSettings.theme);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            set({ error: error.message, loading: false });
        }
    },

    updateSettings: async (newSettings, token) => {
        // Optimistic Update
        const oldSettings = get().settings;
        const updated = { ...oldSettings, ...newSettings };

        set({ settings: updated });

        // Apply theme immediately if changed
        if (newSettings.theme) {
            document.documentElement.setAttribute('data-theme', newSettings.theme);
        }

        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post(`${API_URL}/settings`, updated, { headers });
        } catch (error) {
            console.error('Failed to update settings:', error);
            set({ settings: oldSettings, error: error.message }); // Revert
            return false;
        }
        return true;
    }
}));
