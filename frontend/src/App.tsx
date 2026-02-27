import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import Login from './features/auth/Login';
import Classroom from './features/classroom/Classroom';
import { Loader2 } from 'lucide-react';
import DashboardPage from './features/dashboard/DashboardPage';
import TeacherCalendar from './features/dashboard/TeacherCalendar';
import FindTeachersPage from './features/teachers/FindTeachersPage';
import TeacherSettings from './features/dashboard/TeacherSettings';
import TeacherProfilePage from './features/teachers/TeacherProfilePage';
import TeacherSchedulePage from './features/dashboard/TeacherSchedulePage';
import StudentHomework from './features/dashboard/StudentHomework';
// --- NEW IMPORTS ---

import HomeworkPlayer from './features/dashboard/HomeworkPlayer';
import AdminLayout from './features/admin/AdminLayout';
import AdminLessons from './features/admin/AdminLessons';
import BuyCredits from './features/dashboard/BuyCredits';
import AdminUpload from './features/admin/AdminUpload';
import StudentQuiz from './features/dashboard/StudentQuiz';
import AdminHomeworks from './features/admin/AdminHomeworks';
import AdminLessonCreate from './features/admin/AdminLessonCreate';
import LessonBuilder from './features/teachers/LessonBuilder';
import StudentProfilePage from './features/dashboard/StudentProfilePage';
import TeacherStudents from './features/dashboard/TeacherStudents';
import TeacherEarnings from './features/dashboard/TeacherEarnings';
import TeacherHomework from './features/dashboard/TeacherHomework';
import StudentSchedule from './features/dashboard/StudentSchedule';
import StudentAchievements from './features/dashboard/StudentAchievements';
import StudentGoals from './features/dashboard/StudentGoals';
import Leaderboard from './features/dashboard/Leaderboard';
import TeacherLessonHistory from './features/dashboard/TeacherLessonHistory';


// 1. ProtectedRoute Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-emerald-600 w-8 h-8" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 2. ROOT REDIRECT */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
          {/* 3. PUBLIC ROUTES */}
          <Route path="/login" element={<Login />} />

          {/* 4. PRIVATE CLASSROOM */}
          <Route path="/classroom/:id?" element={
            <ProtectedRoute>
              <Classroom />
            </ProtectedRoute>
          } />
          <Route path="/student/leaderboard" element={<Leaderboard />} />
          <Route path="/student/homework/:assignmentId" element={<HomeworkPlayer />} />
          <Route path="lessons/create" element={<AdminLessonCreate />} />
          {/* 5. PRIVATE DASHBOARD ROUTES */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/teacher/create-lesson" element={<LessonBuilder />} />
          <Route path="/buy-credits" element={<BuyCredits />} />
          <Route path="/dashboard/calendar" element={
            <ProtectedRoute>
              <TeacherCalendar />
            </ProtectedRoute>
          } />
          {/* CREATE Routes */}
          <Route path="/builder/lesson/new" element={<LessonBuilder />} />
          <Route path="/builder/homework/new" element={<LessonBuilder />} />

          {/* EDIT Routes (The :id tells it to load existing data) */}
          <Route path="/builder/lesson/:id" element={<LessonBuilder />} />
          <Route path="/builder/homework/:id" element={<LessonBuilder />} />
          <Route path="/teacher/settings" element={<TeacherSettings />} />
          <Route path="/teacher/:id" element={<TeacherProfilePage />} />
          <Route path="/find-teachers" element={<FindTeachersPage />} />
          <Route path="/teacher/schedule" element={<TeacherSchedulePage />} />
          <Route path="/student/schedule" element={<StudentSchedule />} />
          <Route path="/student/achievements" element={<StudentAchievements />} />
          <Route path="/student/goals" element={<StudentGoals />} />
          <Route path="/student/homework" element={<StudentHomework />} />
          <Route path="/teacher/homework" element={<TeacherHomework />} />

          <Route path="/student/quiz/:id" element={<StudentQuiz />} />
          <Route path="/admin/homeworks" element={<AdminHomeworks />} />

          <Route path="lessons/create" element={<AdminLessonCreate />} />
          {/* --- 6. NEW ADMIN ROUTES --- */}
          {/* This creates a separate section for /admin that uses the AdminLayout */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route path="lessons" element={<AdminLessons />} />
            <Route path="upload" element={<AdminUpload />} />
            {/* Redirect /admin to /admin/lessons by default */}
            <Route index element={<Navigate to="lessons" replace />} />
          </Route>
          <Route path="/teacher/students" element={<TeacherStudents />} />
          <Route path="/teacher/earnings" element={<TeacherEarnings />} />
          <Route path="/teacher/history" element={<TeacherLessonHistory />} />
          {/* 7. CATCH-ALL */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;