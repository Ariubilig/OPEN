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
    ],
  },
])
