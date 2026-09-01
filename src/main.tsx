import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { NotFoundPage } from './components/NotFoundPage.tsx'

// Only the root path "/" (and "") is valid for this single-page app.
// Any other pathname (e.g. /about, /whatever) shows a 404 page.
const isValidRoute = ['/', ''].includes(window.location.pathname);

function Root() {
  if (!isValidRoute) {
    return (
      <NotFoundPage
        onGoHome={() => {
          window.location.href = '/';
        }}
      />
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
