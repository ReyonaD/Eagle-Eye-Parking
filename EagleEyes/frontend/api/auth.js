import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://127.0.0.1:5000';
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
        //FastAPI login requires form-urlencoded, NOT JSON!
        const formData = `username=${encodeURIComponent(email)}&passqword=${encodeURIComponent(password)}`;
    
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData,
    });
        const data = await res.json();
        if (!res.ok){
            throw new Error(data.detail || 'Login failed');
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
