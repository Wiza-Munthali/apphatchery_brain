import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, type LinkProps } from 'react-router-dom'
import { Theme } from '@astryxdesign/core/theme'
import { LinkProvider } from '@astryxdesign/core/Link'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import './index.css'
import App from './App.tsx'
import { captureTokenFromHash } from './lib/gatewayAuth'

// Must run before HashRouter mounts and reads location.hash.
captureTokenFromHash()

function RouterLinkAdapter({ href, ...rest }: Omit<LinkProps, 'to'> & { href?: string }) {
  return <Link to={href ?? '#'} {...rest} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={neutralTheme}>
      <LinkProvider component={RouterLinkAdapter}>
        <App />
      </LinkProvider>
    </Theme>
  </StrictMode>,
)
