# Banner Carousel / Campaign Slider

This feature allows admins to manage marketing campaigns and banners that appear on the home screens of both the Web and Mobile applications.

## Admin Features
- Create and edit banner campaigns.
- Target specific roles (Student, Teacher, or Both).
- Choose placement (e.g., `student_home_top`, `teacher_home_top`).


- Schedule start and end dates.
- Upload separate images for Web and Mobile.
- Set background colors and text (title, subtitle, CTA).
- Define click actions: 
  - **EXTERNAL**: Opens a URL in a new tab/browser.
  - **INTERNAL**: Navigates to a route within the app.

## Backend Implementation
- **App**: `banners`
- **Model**: `BannerCampaign`
- **API**: `GET /api/banners/?placement=...`
  - Automatically filters by authenticated user's role.
  - Only returns active and scheduled banners.
  - Ordered by `priority` (desc) and `created_at` (desc).

## Frontend Implementation
- **Web (React)**: `BannerCarousel` component in `frontend/src/features/dashboard/ui/`.
- **Mobile (Expo)**: `BannerCarousel` component in `mobileapp/src/features/dashboard/`.
- **Auto-scroll**: Both platforms advance slides every 5 seconds.

## Examples of Internal Routes
### Web
- `/student/credits`
- `/student/schedule`
- `/teacher/earnings`

### Mobile
- `BuyCredits`
- `TeacherEarnings`
- `Profile`

## Configuration
- **Auto-advance**: 5 seconds (hardcoded in components).
- **Default Color**: `#4A90E2` (if no background color is set).
