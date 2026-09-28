import { createBrowserRouter } from 'react-router'
import Layout from './components/Layout'
import { LoadingScreen, PageError, RootError } from './components/StatusScreens'
import Feed from './routes/Feed'
import {
  feedLoader,
  feedShouldRevalidate,
  notFoundLoader,
  rootLoader,
  rootShouldRevalidate,
  searchRedirect,
  storyLoader,
  storyShouldRevalidate,
} from './routes/loaders'
import NotFound from './routes/NotFound'

export const router = createBrowserRouter([
  {
    // channels and tax rules for every page (useSite)
    id: 'root',
    loader: rootLoader,
    shouldRevalidate: rootShouldRevalidate,
    HydrateFallback: LoadingScreen,
    errorElement: <RootError />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            // a page whose data fails to load shows the error inside the page frame
            errorElement: <PageError />,
            children: [
              {
                index: true,
                element: <Feed />,
                loader: feedLoader,
                shouldRevalidate: feedShouldRevalidate,
              },
              // Each page's code loads with its data (the loader is not lazy, so both start at once);
              // the feed and the page frame are in the main bundle.
              {
                path: 'story/:id',
                loader: storyLoader,
                shouldRevalidate: storyShouldRevalidate,
                lazy: async () => ({
                  Component: (await import('./routes/Story')).default,
                }),
              },
              {
                path: 'about',
                lazy: async () => ({
                  Component: (await import('./routes/About')).default,
                }),
              },
              // search lives in the feed now; old /search?q= links still work
              { path: 'search', loader: searchRedirect },
              // the pages the alert emails link to
              {
                path: 'alerts/confirm',
                lazy: async () => ({
                  Component: (await import('./routes/Alerts')).ConfirmAlerts,
                }),
              },
              {
                path: 'alerts/unsubscribe',
                lazy: async () => ({
                  Component: (await import('./routes/Alerts')).Unsubscribe,
                }),
              },
              { path: '*', element: <NotFound />, loader: notFoundLoader },
            ],
          },
        ],
      },
      {
        // staff only; every page is its own lazy chunk, so readers never download the admin
        path: 'admin',
        lazy: () => import('./admin/AdminFrame'),
        children: [
          { path: 'login', lazy: () => import('./admin/pages/Login') },
          {
            id: 'staff',
            lazy: () => import('./admin/StaffLayout'),
            children: [
              { index: true, lazy: () => import('./admin/pages/Dashboard') },
              {
                path: 'stories/new',
                lazy: () => import('./admin/pages/NewStory'),
              },
              {
                path: 'stories/:id',
                lazy: () => import('./admin/pages/Editor'),
              },
              { path: 'reports', lazy: () => import('./admin/pages/Reports') },
              { path: 'ai', lazy: () => import('./admin/pages/AiDraft') },
              { path: 'watch', lazy: () => import('./admin/pages/Watch') },
              {
                path: 'settings',
                lazy: () => import('./admin/pages/Settings'),
              },
              { path: '*', lazy: () => import('./admin/pages/AdminNotFound') },
            ],
          },
        ],
      },
    ],
  },
])
