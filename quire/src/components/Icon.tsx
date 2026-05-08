import { CSSProperties } from 'react';

export type IconName =
  | 'search'
  | 'plus'
  | 'pin'
  | 'star'
  | 'tag'
  | 'close'
  | 'edit'
  | 'eye'
  | 'book'
  | 'river'
  | 'stack'
  | 'cmd'
  | 'chevR'
  | 'chevD'
  | 'sun'
  | 'moon'
  | 'dot'
  | 'drag'
  | 'link'
  | 'arrow'
  | 'sidebar'
  | 'plug'
  | 'gear'
  | 'download'
  | 'check';

interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 14 }: IconProps) {
  const s: CSSProperties = {
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  let body: JSX.Element = <></>;
  switch (name) {
    case 'search':
      body = (<><circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" /></>);
      break;
    case 'plus':
      body = (<path d="M8 2v12M2 8h12" />);
      break;
    case 'pin':
      body = (<path d="M8 1v6M5 7l3 3 3-3M8 10v5" />);
      break;
    case 'star':
      body = (<path d="M8 1.5l1.9 4 4.4.6-3.2 3 .8 4.4L8 11.4l-3.9 2.1.8-4.4-3.2-3 4.4-.6z" />);
      break;
    case 'tag':
      body = (<><path d="M2 2h5l7 7-5 5-7-7z" /><circle cx="5" cy="5" r=".8" fill="currentColor" stroke="none" /></>);
      break;
    case 'close':
      body = (<><path d="M3 3l10 10M13 3L3 13" /></>);
      break;
    case 'edit':
      body = (<path d="M2 14h12M3 11l7-7 3 3-7 7H3z" />);
      break;
    case 'eye':
      body = (<><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2" /></>);
      break;
    case 'book':
      body = (<path d="M2 3h5a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H2zM14 3H9a2 2 0 0 0-2 2v9a2 2 0 0 1 2-2h5z" />);
      break;
    case 'river':
      body = (<path d="M2 4h12M2 8h12M2 12h12" />);
      break;
    case 'stack':
      body = (<><rect x="2" y="2" width="12" height="3" /><rect x="2" y="6.5" width="12" height="3" /><rect x="2" y="11" width="12" height="3" /></>);
      break;
    case 'cmd':
      body = (<path d="M5 5h6v6H5zM5 5V3a2 2 0 0 0-2 2 2 2 0 0 0 2 2zM11 5V3a2 2 0 0 1 2 2 2 2 0 0 1-2 2zM5 11v2a2 2 0 0 1-2-2 2 2 0 0 1 2-2zM11 11v2a2 2 0 0 0 2-2 2 2 0 0 0-2-2z" />);
      break;
    case 'chevR':
      body = (<path d="M5 3l5 5-5 5" />);
      break;
    case 'chevD':
      body = (<path d="M3 5l5 5 5-5" />);
      break;
    case 'sun':
      body = (<><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" /></>);
      break;
    case 'moon':
      body = (<path d="M13 9.5A6 6 0 0 1 6.5 3 6 6 0 1 0 13 9.5z" />);
      break;
    case 'dot':
      body = (<circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />);
      break;
    case 'drag':
      body = (<>
        <circle cx="6" cy="4" r=".8" fill="currentColor" stroke="none" />
        <circle cx="10" cy="4" r=".8" fill="currentColor" stroke="none" />
        <circle cx="6" cy="8" r=".8" fill="currentColor" stroke="none" />
        <circle cx="10" cy="8" r=".8" fill="currentColor" stroke="none" />
        <circle cx="6" cy="12" r=".8" fill="currentColor" stroke="none" />
        <circle cx="10" cy="12" r=".8" fill="currentColor" stroke="none" />
      </>);
      break;
    case 'link':
      body = (<path d="M6 9.5L9.5 6M6 4.5l1-1a3 3 0 0 1 4 4l-1 1M10 11.5l-1 1a3 3 0 0 1-4-4l1-1" />);
      break;
    case 'arrow':
      body = (<path d="M3 8h10M9 4l4 4-4 4" />);
      break;
    case 'sidebar':
      body = (<><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 3v10" /></>);
      break;
    case 'plug':
      body = (<path d="M5 1v4M11 1v4M3 5h10v3a5 5 0 0 1-10 0zM8 13v2" />);
      break;
    case 'gear':
      body = (<>
        <path d="M9.1 1.5l.35 1.7a5 5 0 0 1 1.5.86l1.65-.55 1.1 1.9-1.3 1.15a5 5 0 0 1 0 1.74l1.3 1.15-1.1 1.9-1.65-.55a5 5 0 0 1-1.5.86l-.35 1.7h-2.2l-.35-1.7a5 5 0 0 1-1.5-.86l-1.65.55-1.1-1.9 1.3-1.15a5 5 0 0 1 0-1.74l-1.3-1.15 1.1-1.9 1.65.55a5 5 0 0 1 1.5-.86l.35-1.7z" />
        <circle cx="8" cy="8" r="1.8" />
      </>);
      break;
    case 'download':
      body = (<><path d="M8 2v8M4 7l4 4 4-4M2 14h12" /></>);
      break;
    case 'check':
      body = (<path d="M3 8l3 3 7-7" />);
      break;
  }
  return <svg viewBox="0 0 16 16" style={s}>{body}</svg>;
}
