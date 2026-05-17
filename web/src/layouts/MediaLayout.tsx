import { Outlet } from 'react-router';
import { MediaAppProvider } from '../contexts/MediaAppContext';

export default function MediaLayout() {
  return (
    <MediaAppProvider>
      <Outlet />
    </MediaAppProvider>
  );
}
