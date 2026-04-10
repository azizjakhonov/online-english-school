import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    LayoutGrid,
    Calendar,
    Users,
    Wallet,
    User,
    Search,
    Home,
    Trophy,
    BookOpen,
} from 'lucide-react-native';
import StudentDashboard from '../features/dashboard/StudentDashboard';
import TeacherDashboard from '../features/dashboard/TeacherDashboard';
import TeacherDiscovery from '../features/teachers/TeacherDiscovery';
import StudentProfileScreen from '../features/dashboard/StudentProfileScreen';
import TeacherProfileScreen from '../features/dashboard/TeacherProfileScreen';
import TeacherEarningsScreen from '../features/dashboard/TeacherEarningsScreen';
import TeacherHistoryScreen from '../features/dashboard/TeacherHistoryScreen';
import TeacherScheduleScreen from '../features/dashboard/TeacherScheduleScreen';
import LeaderboardScreen from '../features/dashboard/LeaderboardScreen';
import HomeworkScreen from '../features/dashboard/HomeworkScreen';
import { Colors } from '../theme';
import { useAuth } from '../features/auth/AuthContext';
import { usePushToken } from '../hooks/usePushToken';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
    const { user } = useAuth();
    const role = user?.role?.toUpperCase();

    // Register / refresh the Expo push token once per authenticated session.
    // Fires on mount — this component is only rendered when the user is logged in.
    usePushToken();
    const isTeacher = role === 'TEACHER';

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                    height: 85,
                    paddingBottom: 28,
                    paddingTop: 12,
                    backgroundColor: Colors.white,
                    borderTopColor: '#F1F5F9',
                    borderTopWidth: 1,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '700',
                    marginTop: 4,
                },
                tabBarIcon: ({ color, focused }) => {
                    const iconSize = 24;
                    const iconColor = color;

                    if (route.name === 'Dashboard' || route.name === 'Home')
                        return <Home size={iconSize} color={iconColor} />;
                    if (route.name === 'Schedule')
                        return <Calendar size={iconSize} color={iconColor} />;
                    if (route.name === 'Leaderboard')
                        return <Trophy size={iconSize} color={iconColor} />;
                    if (route.name === 'Teachers' || route.name === 'Discover')
                        return <Users size={iconSize} color={iconColor} />;
                    if (route.name === 'Profile')
                        return <User size={iconSize} color={iconColor} />;
                    if (route.name === 'Students')
                        return <Users size={iconSize} color={iconColor} />;
                    if (route.name === 'Earnings')
                        return <Wallet size={iconSize} color={iconColor} />;
                    if (route.name === 'Homework')
                        return <BookOpen size={iconSize} color={iconColor} />;

                    return <LayoutGrid size={iconSize} color={iconColor} />;
                },
            })}
        >
            <Tab.Screen
                name={isTeacher ? "Dashboard" : "Home"}
                component={isTeacher ? TeacherDashboard : StudentDashboard}
            />

            {isTeacher ? (
                <>
                    <Tab.Screen name="Schedule" component={TeacherScheduleScreen} />
                    <Tab.Screen name="Students" component={TeacherHistoryScreen} />
                    <Tab.Screen name="Earnings" component={TeacherEarningsScreen} />
                </>
            ) : (
                <>
                    <Tab.Screen name="Homework" component={HomeworkScreen} />
                    <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
                    <Tab.Screen name="Teachers" component={TeacherDiscovery} />
                </>
            )}

            <Tab.Screen
                name="Profile"
                component={isTeacher ? TeacherProfileScreen : StudentProfileScreen}
            />
        </Tab.Navigator>
    );
}
