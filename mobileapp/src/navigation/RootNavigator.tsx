import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../features/auth/AuthContext';
import LoginScreen from '../features/auth/LoginScreen';
import OtpScreen from '../features/auth/OtpScreen';
import OnboardingScreen from '../features/auth/OnboardingScreen';
import MainTabNavigator from './MainTabNavigator';
import TeacherProfile from '../features/teachers/TeacherProfile';
import MobileClassroom from '../features/classroom/MobileClassroom';
import BuyCreditsScreen from '../features/dashboard/BuyCreditsScreen';
import TeacherEarningsScreen from '../features/dashboard/TeacherEarningsScreen';
import TeacherHistoryScreen from '../features/dashboard/TeacherHistoryScreen';
import TeacherScheduleScreen from '../features/dashboard/TeacherScheduleScreen';
import NotificationsScreen from '../features/dashboard/NotificationsScreen';
import HomeworkPlayerScreen from '../features/dashboard/HomeworkPlayerScreen';
import EditProfileScreen from '../features/dashboard/EditProfileScreen';
import StudentHistoryScreen from '../features/dashboard/StudentHistoryScreen';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../theme';

const Stack = createStackNavigator();

export default function RootNavigator() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    // Authenticated Stack
                    <>
                        <Stack.Screen name="Main" component={MainTabNavigator} />
                        <Stack.Screen name="TeacherProfile" component={TeacherProfile} />
                        <Stack.Screen name="Classroom" component={MobileClassroom} />
                        <Stack.Screen name="BuyCredits" component={BuyCreditsScreen} />
                        <Stack.Screen name="TeacherEarnings" component={TeacherEarningsScreen} />
                        <Stack.Screen name="TeacherHistory" component={TeacherHistoryScreen} />
                        <Stack.Screen name="Schedule" component={TeacherScheduleScreen} />
                        <Stack.Screen name="Notifications" component={NotificationsScreen} />
                        <Stack.Screen name="HomeworkPlayer" component={HomeworkPlayerScreen} />
                        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                        <Stack.Screen name="StudentHistory" component={StudentHistoryScreen} />
                    </>
                ) : (
                    // Auth Stack
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Otp" component={OtpScreen} />
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
