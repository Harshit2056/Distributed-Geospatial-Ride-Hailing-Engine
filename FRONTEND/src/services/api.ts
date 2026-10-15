import axios from 'axios';
import type { LocationCoordinate, User, UserRole, RideRecord, NearbyDriver } from '../types';

export const API_BASE_URL = 'http://localhost:8080/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.accesstoken = token;
  }
  return config;
});

// Auth API
export const authApi = {
  register: async (name: string, email: string, password: string, role: UserRole) => {
    const res = await api.post('/auth/register', { name, email, password, role });
    return res.data;
  },

  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  getCurrentUser: async (): Promise<{ data: User }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

// Driver API
export const driverApi = {
  updateLocation: async (latitude: number, longitude: number) => {
    const res = await api.post('/drivers/location', { latitude, longitude });
    return res.data;
  },

  getNearby: async (latitude: number, longitude: number, ringSize: number = 1): Promise<{ data: { totalNearby: number; drivers: NearbyDriver[] } }> => {
    const res = await api.get('/drivers/nearby', {
      params: { latitude, longitude, ringSize },
    });
    return res.data;
  },
};

// Ride API
export const rideApi = {
  requestRide: async (
    pickup: LocationCoordinate,
    dropoff: LocationCoordinate,
    pickupNodeId: number = 1,
    dropoffNodeId: number = 5
  ): Promise<{ data: RideRecord }> => {
    const res = await api.post('/rides/request', {
      pickup,
      dropoff,
      pickupNodeId,
      dropoffNodeId,
    });
    return res.data;
  },

  updateStatus: async (rideId: string, status: string): Promise<{ data: RideRecord }> => {
    const res = await api.patch(`/rides/${rideId}/status`, { status });
    return res.data;
  },

  getActiveRide: async (): Promise<{ data: RideRecord | null }> => {
    const res = await api.get('/rides/active');
    return res.data;
  },
};

// Route API
export const routeApi = {
  calculateRoute: async (pickup: LocationCoordinate, dropoff: LocationCoordinate) => {
    const res = await api.post('/routes/calculate', { pickup, dropoff });
    return res.data;
  },
};
