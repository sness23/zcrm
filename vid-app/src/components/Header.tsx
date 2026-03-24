import UserMenu from './UserMenu';
import doibioLogo from '../assets/doibio.png';

interface HeaderProps {
  onSettingsClick: () => void;
}

export default function Header({ onSettingsClick }: HeaderProps) {
  const getLoginUrl = () => {
    const isDev = window.location.hostname.includes('local.')
    const isLocalhost = window.location.hostname === 'localhost'
    const protocol = window.location.protocol

    if (isLocalhost) {
      return 'http://localhost:9103'
    }
    if (isDev) {
      return `${protocol}//local.login.doi.bio`
    }
    return `${protocol}//login.doi.bio`
  }

  return (
    <header className="bg-gradient-to-r from-[#000040] via-purple-900 to-violet-900 text-white px-5 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3 cursor-pointer">
        <a href={getLoginUrl()} title="Go to App Launcher" className="flex items-center transition-opacity hover:opacity-80">
          <img src={doibioLogo} alt="WWW Logo" className="h-8 w-8 rounded-full" />
        </a>
        <h1 className="text-xl font-semibold m-0">WWW</h1>
      </div>
      <div className="flex items-center gap-3">
        <UserMenu onSettingsClick={onSettingsClick} />
      </div>
    </header>
  );
}
