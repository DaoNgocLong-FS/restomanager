import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/AuthContext';
import { ConfirmProvider, ConfirmBridge, ToastHost } from './src/components/Notify';
import { colors } from './src/theme';

import SettingsScreen from './src/screens/SettingsScreen';
import LoginScreen    from './src/screens/LoginScreen';
import TablesScreen   from './src/screens/TablesScreen';
import MenuScreen     from './src/screens/MenuScreen';
import DetailScreen   from './src/screens/DetailScreen';
import PaymentScreen  from './src/screens/PaymentScreen';
import OrdersScreen   from './src/screens/OrdersScreen';
import ProfileScreen  from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { paddingTop:4, height:60, paddingBottom:8 },
        tabBarLabelStyle: { fontSize:11, fontWeight:'600' },
        tabBarIcon: ({ color, size }) => {
          const map = { TablesTab:'grid-outline', OrdersTab:'receipt-outline', ProfileTab:'person-outline' };
          return <Ionicons name={map[route.name] || 'ellipse-outline'} size={size} color={color}/>;
        },
      })}
    >
      <Tab.Screen name="TablesTab"  component={TablesScreen}  options={{ title:'Bàn' }} />
      <Tab.Screen name="OrdersTab"  component={OrdersScreen}  options={{ title:'Đơn hàng' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title:'Cá nhân' }} />
    </Tab.Navigator>
  );
}

function RootNav() {
  const { booting, user, apiBase } = useAuth();

  if (booting) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color="#fff" size="large"/>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight:'700' },
    }}>
      {!apiBase ? (
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title:'Cấu hình server', headerShown:false }} />
      ) : !user ? (
        <>
          <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown:false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title:'Cấu hình server' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main"     component={MainTabs}       options={{ headerShown:false }} />
          <Stack.Screen name="Menu"     component={MenuScreen}     options={({ route }) => ({ title: `Gọi món – Bàn ${route.params?.table?.code || ''}` })} />
          <Stack.Screen name="Detail"   component={DetailScreen}   options={({ route }) => ({ title: `Chi tiết – Bàn ${route.params?.table?.code || ''}` })} />
          <Stack.Screen name="Payment"  component={PaymentScreen}  options={{ title:'Thanh toán' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title:'Cấu hình server' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content"/>
      <ConfirmProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNav/>
          </NavigationContainer>
          {/* ConfirmBridge phải nằm trong ConfirmProvider để hook hợp lệ;
              cho phép gọi confirm() từ bất kỳ đâu kể cả ngoài component */}
          <ConfirmBridge />
          {/* ToastHost render ở root để toast hiện trên mọi màn hình */}
          <ToastHost />
        </AuthProvider>
      </ConfirmProvider>
    </SafeAreaProvider>
  );
}
