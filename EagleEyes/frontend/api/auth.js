import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
//REGISTER
export const register = async (email, password) => {
    const response = await apiFetch(`${BASE_URL}/register`, {
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
        console.log("[Auth] Logging in as:", email);
        //FastAPI login requires form-urlencoded, NOT JSON!
        const formData = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
        const res = await apiFetch(`${BASE_URL}/login`, {
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
        //save token, role, and owner status to AsyncStorage
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('role', data.role);
        await AsyncStorage.setItem('isOwner', data.is_owner ? 'true' : 'false');
        return data;
    } catch (error){
        throw error;
    }
};
//LOGOUT
export const logout = async () => {
    //destroy token, role, and owner status to logout
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('role');
    await AsyncStorage.removeItem('isOwner');
};
//GET CURRENT USER - includes the permit saved on the account (null if never set)
export const getCurrentUser = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch account details');
    return await response.json();
};
//GET PERMIT TYPES - the real, live list of ParkZen permit names (for the picker)
export const getPermitTypes = async () => {
    const response = await apiFetch(`${BASE_URL}/api/permits`);
    if (!response.ok) throw new Error('Failed to fetch permit types');
    return await response.json();
};
//GET PERMIT HOURS - when each ParkZen permit may park ({name, type, dailyTimeSlots})
export const getPermitHours = async () => {
    const response = await apiFetch(`${BASE_URL}/api/permit-hours`);
    if (!response.ok) throw new Error('Failed to fetch permit hours');
    return await response.json();
};
//UPDATE PERMIT - save the account's chosen permit type to the backend
export const updatePermit = async (permitType) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/users/me/permit`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ permit_type: permitType }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to update permit');
    }
    return data;
};
//UPDATE PLATE - save the account's vehicle license plate to the backend
export const updatePlate = async (plateState, plateNumber) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/users/me/plate`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plate_state: plateState, plate_number: plateNumber }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to update plate');
    }
    return data;
};
//UPDATE NAME - save the account's display name to the backend
export const updateName = async (name) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/users/me/name`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to update name');
    }
    return data;
};
//ADMIN TOOLS
export const promoteToAdmin = async (targetEmail) => {
    //get admin's token
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/admin/users/${encodeURIComponent(targetEmail)}/promote`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to promote user');
    }
    return data;
}
//GET ADMINS - owner-only: the full admin roster
export const getAdmins = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/admin/admins`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch admin list');
    return await response.json();
};
//GRANT OWNER - owner-only: gives an existing admin owner-level access
export const grantOwner = async (targetEmail) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/admin/users/${encodeURIComponent(targetEmail)}/grant-owner`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to grant owner access');
    }
    return data;
};
//REVOKE ADMIN - owner-only: strips a user's admin/owner access back to commuter
export const revokeAdmin = async (targetEmail) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) { throw new Error("No authorization token found"); }

    const response = await apiFetch(`${BASE_URL}/admin/users/${encodeURIComponent(targetEmail)}/revoke`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to revoke admin access');
    }
    return data;
};
//FORGOT PASSWORD - request a reset email
export const requestPasswordReset = async (email) => {
    const response = await apiFetch(`${BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
        let errorMessage = "Request failed.";
        if (typeof data.detail === 'string') errorMessage = data.detail;
        //validation errors come back as an array of objects; the only field here is email
        else if (Array.isArray(data.detail)) errorMessage = "Please enter a valid email address.";
        throw new Error(errorMessage);
    }
    return data;
};
//VERIFY RESET CODE - check the 6-digit code before asking for a new password
export const verifyResetCode = async (email, code) => {
    const response = await apiFetch(`${BASE_URL}/verify-reset-code`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (!response.ok) {
        let errorMessage = "Verification failed.";
        if (typeof data.detail === 'string') errorMessage = data.detail;
        else if (Array.isArray(data.detail)) errorMessage = data.detail[0].msg;
        throw new Error(errorMessage);
    }
    return data;
};
//RESET PASSWORD - submit email + 6-digit code + new password
export const resetPassword = async (email, code, newPassword) => {
    const response = await apiFetch(`${BASE_URL}/reset-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, code, new_password: newPassword }),
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
