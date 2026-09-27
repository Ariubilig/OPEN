import { createBrowserRouter } from 'react-router'
import Layout from './components/Layout'
import { LoadingScreen, PageError, RootError } from './components/StatusScreens'
import About from './routes/About'
import Feed from './routes/Feed'
import {
  feedLoader,
  feedShouldRevalidate,
  notFoundLoader,
  rootLoader,
  rootShouldRevalidate,
  storyLoader,
  storyShouldRevalidate,
} from './routes/loaders'
import NotFound from './routes/NotFound'
import Story from './routes/Story'

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
              {
                path: 'story/:id',
                element: <Story />,
                loader: storyLoader,
                shouldRevalidate: storyShouldRevalidate,
              },
              { path: 'about', element: <About /> },
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
