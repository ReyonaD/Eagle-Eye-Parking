import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
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
        //save token and role to AsyncStorage
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('role', data.role);
        return data;
    } catch (error){
        throw error;
    }
};
//LOGOUT
export const logout = async () => {
    //destroy token and role to logout
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('role');
};
//ADMIN TOOLS
export const promoteToAdmin = async (targetEmail) => {
    //get admin's token
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(targetEmail)}/promote')`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
    });

}
//FORGOT PASSWORD - request a reset email
export const requestPasswordReset = async (email) => {
    const response = await fetch(`${BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
    }
    return data;
};
//RESET PASSWORD - submit token + new password
export const resetPassword = async (token, newPassword) => {
    const response = await fetch(`${BASE_URL}/reset-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ token, new_password: newPassword }),
    });
    const data = await response.json();
    if (!response.ok) {
        let errorMessage = "Reset failed.";
        if (typeof data.detail === 'string') errorMessage = data.detail;
        else if (Array.isArray(data.detail)) errorMessage = data.detail[0].msg;
        throw new Error(errorMessage);
    }
    return data;
};
