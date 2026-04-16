import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000');
//REGISTER
export const register = async (email, password) => {
    const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok){
        throw new Error(data.detail || 'Registration failed');
    }

    return data;
};
//LOGIN
export const login = async (email, password) => {
    try{
        console.log("ATTEMPTING TO SEND -> Email:", email, "| Password:", password);
        //FastAPI login requires form-urlencoded, NOT JSON!
        const formData = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
        console.log("EXACT PACKAGE BEING SENT:", formData);
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData,
    });
        const data = await res.json();
        if (!res.ok){
            let errorMessage = "Authentication failed.";
    
        // If FastAPI sends a simple text message (like "Incorrect email or password")
        if (typeof data.detail === 'string') {
        errorMessage = data.detail;
        } 
        // If FastAPI sends an array of validation errors (like "Not a valid email")
        else if (Array.isArray(data.detail)) {
        errorMessage = data.detail[0].msg; 
        }

        console.log("BACKEND REJECTION:", JSON.stringify(data, null, 2));
        throw new Error(errorMessage);
        } 
        //save token to AsyncStorage
        await AsyncStorage.setItem('token', data.access_token);
        return data;
    } catch (error){
        throw error;
    }
};
//LOGOUT
export const logout = async () => {
    //destroy token to logout
    await AsyncStorage.removeItem('token');
};
