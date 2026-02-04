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

    fetchSettings: async () => {
        set({ loading: true });
        try {
            const response = await axios.get(`${API_URL}/settings`);
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

    updateSettings: async (newSettings) => {
        // Optimistic Update
        const oldSettings = get().settings;
        const updated = { ...oldSettings, ...newSettings };

        set({ settings: updated });

        // Apply theme immediately if changed
        if (newSettings.theme) {
            document.documentElement.setAttribute('data-theme', newSettings.theme);
        }

        try {
            await axios.post(`${API_URL}/settings`, updated);
        } catch (error) {
            console.error('Failed to update settings:', error);
            set({ settings: oldSettings, error: error.message }); // Revert
            return false;
        }
        return true;
    }
}));
