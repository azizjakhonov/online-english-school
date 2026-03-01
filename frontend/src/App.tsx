import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const MarketingLayout = lazy(() => import('./views/marketing/MarketingLayout'))
const MarketingOverview = lazy(() => import('./views/marketing/Overview'))
const BannerManager = lazy(() => import('./views/marketing/BannerManager'))
const AnnouncementManager = lazy(() => import('./views/marketing/AnnouncementManager'))
const EmailCampaigns = lazy(() => import('./views/marketing/EmailCampaigns'))
const SmsCampaigns = lazy(() => import('./views/marketing/SmsCampaigns'))
const PushCampaigns = lazy(() => import('./views/marketing/PushCampaigns'))
const DiscountCodes = lazy(() => import('./views/marketing/DiscountCodes'))
const RevenuePanel = lazy(() => import('./views/marketing/RevenuePanel'))
const FunnelPanel = lazy(() => import('./views/marketing/FunnelPanel'))
const RetentionPanel = lazy(() => import('./views/marketing/RetentionPanel'))

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
import StudentEnrollments from './features/dashboard/StudentEnrollments';
import StudentPackages from './features/dashboard/StudentPackages';
import StudentCoins from './features/dashboard/StudentCoins';
import TeacherLoginPage from './features/teachers/TeacherLoginPage';
import TeacherRegisterPage from './features/teachers/TeacherRegisterPage';
import TeacherVerifyOtpPage from './features/teachers/TeacherVerifyOtpPage';
import TeacherOnboardingPage from './features/teachers/TeacherOnboardingPage';
import TeacherPendingApprovalPage from './features/teachers/TeacherPendingApprovalPage';
import RateLessonPage from './features/students/RateLessonPage';
import AppLayout from './layouts/AppLayout';

// ─── ProtectedRoute ────────────────────────────────────────────────────────────

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

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public auth routes (no announcement bar) ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/teacher/login" element={<TeacherLoginPage />} />
          <Route path="/teacher/register" element={<TeacherRegisterPage />} />
          <Route path="/teacher/verify-otp" element={<TeacherVerifyOtpPage />} />
          <Route path="/teacher/onboarding" element={<TeacherOnboardingPage />} />
          <Route path="/teacher/pending-approval" element={<TeacherPendingApprovalPage />} />

          {/* ── Classroom (full-screen, no announcement bar) ── */}
          <Route path="/classroom/:id?" element={
            <ProtectedRoute>
              <Classroom />
            </ProtectedRoute>
          } />

          {/* ── Admin (own layout) ── */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route path="lessons" element={<AdminLessons />} />
            <Route path="upload" element={<AdminUpload />} />
            <Route index element={<Navigate to="lessons" replace />} />
          </Route>
          <Route path="/admin/homeworks" element={<AdminHomeworks />} />

          {/* ── Marketing dashboard (own layout) ── */}
          <Route path="/marketing" element={
            <Suspense fallback={<div className="h-screen flex items-center justify-center bg-stone-50" />}>
              <MarketingLayout />
            </Suspense>
          }>
            <Route index element={<Suspense fallback={null}><MarketingOverview /></Suspense>} />
            <Route path="banners" element={<Suspense fallback={null}><BannerManager /></Suspense>} />
            <Route path="announcements" element={<Suspense fallback={null}><AnnouncementManager /></Suspense>} />
            <Route path="email" element={<Suspense fallback={null}><EmailCampaigns /></Suspense>} />
            <Route path="sms" element={<Suspense fallback={null}><SmsCampaigns /></Suspense>} />
            <Route path="push" element={<Suspense fallback={null}><PushCampaigns /></Suspense>} />
            <Route path="discounts" element={<Suspense fallback={null}><DiscountCodes /></Suspense>} />
            <Route path="revenue" element={<Suspense fallback={null}><RevenuePanel /></Suspense>} />
            <Route path="funnel" element={<Suspense fallback={null}><FunnelPanel /></Suspense>} />
            <Route path="retention" element={<Suspense fallback={null}><RetentionPanel /></Suspense>} />
          </Route>

          {/* ── All other routes: wrapped with AppLayout (announcement bar) ── */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/calendar" element={
              <ProtectedRoute>
                <TeacherCalendar />
              </ProtectedRoute>
            } />

            {/* Teacher pages */}
            <Route path="/teacher/settings" element={<TeacherSettings />} />
            <Route path="/teacher/:id" element={<TeacherProfilePage />} />
            <Route path="/teacher/schedule" element={<TeacherSchedulePage />} />
            <Route path="/teacher/students" element={<TeacherStudents />} />
            <Route path="/teacher/earnings" element={<TeacherEarnings />} />
            <Route path="/teacher/history" element={<TeacherLessonHistory />} />
            <Route path="/teacher/homework" element={<TeacherHomework />} />
            <Route path="/teacher/create-lesson" element={<LessonBuilder />} />
            <Route path="/find-teachers" element={<FindTeachersPage />} />

            {/* Student pages */}
            <Route path="/student/profile" element={<StudentProfilePage />} />
            <Route path="/student/schedule" element={<StudentSchedule />} />
            <Route path="/student/achievements" element={<StudentAchievements />} />
            <Route path="/student/goals" element={<StudentGoals />} />
            <Route path="/student/homework" element={<StudentHomework />} />
            <Route path="/student/homework/:assignmentId" element={<HomeworkPlayer />} />
            <Route path="/student/leaderboard" element={<Leaderboard />} />
            <Route path="/student/rate-lesson/:lessonId" element={<RateLessonPage />} />
            <Route path="/student/quiz/:id" element={<StudentQuiz />} />
            <Route path="/student/enrollments" element={<StudentEnrollments />} />
            <Route path="/student/packages" element={<StudentPackages />} />
            <Route path="/student/coins" element={<StudentCoins />} />

            {/* Builder / lesson creation */}
            <Route path="/builder/lesson/new" element={<LessonBuilder />} />
            <Route path="/builder/homework/new" element={<LessonBuilder />} />
            <Route path="/builder/lesson/:id" element={<LessonBuilder />} />
            <Route path="/builder/homework/:id" element={<LessonBuilder />} />
            <Route path="lessons/create" element={<AdminLessonCreate />} />

            {/* Misc */}
            <Route path="/buy-credits" element={<BuyCredits />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
