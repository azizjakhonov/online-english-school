import { Platform } from 'react-native';

// Cross-platform storage: SecureStore on native, localStorage on web.
let _getItem: (key: string) => Promise<string | null>;
let _setItem: (key: string, value: string) => Promise<void>;
let _deleteItem: (key: string) => Promise<void>;

if (Platform.OS === 'web') {
    _getItem = async (key) => localStorage.getItem(key);
    _setItem = async (key, value) => localStorage.setItem(key, value);
    _deleteItem = async (key) => localStorage.removeItem(key);
} else {
    // Lazy-require so the web bundle never touches the native module
    const SecureStore = require('expo-secure-store');
    _getItem = (key) => SecureStore.getItemAsync(key);
    _setItem = (key, value) => SecureStore.setItemAsync(key, value);
    _deleteItem = (key) => SecureStore.deleteItemAsync(key);
}

const storage = {
    getItemAsync: _getItem,
    setItemAsync: _setItem,
    deleteItemAsync: _deleteItem,
};

export default storage;
