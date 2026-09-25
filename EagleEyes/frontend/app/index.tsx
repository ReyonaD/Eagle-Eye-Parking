import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const decideRoute = async () => {
      const token = await AsyncStorage.getItem('token');
      const role = await AsyncStorage.getItem('role');
      if (!token) {
        setTarget('/login');
      } else if (role === 'admin') {
        setTarget('/(admin)');
      } else {
        setTarget('/(tabs)');
      }
    };
    decideRoute();
  }, []);

  //wait for AsyncStorage before redirecting so we never flash the wrong screen
  if (!target) return null;

  return <Redirect href={target as any} />;
}
