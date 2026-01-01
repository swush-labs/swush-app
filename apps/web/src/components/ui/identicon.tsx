/**
 * Identicon replacement component
 *
 * This component replaces @polkadot/react-identicon to avoid WASM memory
 * allocation issues. Uses a simple gradient-based avatar instead.
 */

import AccountAvatar from "./account-avatar";

interface IdenticonProps {
  value: string;
  size?: number;
  theme?: string;
  className?: string;
}

export default function Identicon({ value, size, className }: IdenticonProps) {
  return <AccountAvatar value={value} size={size} className={className} />;
}
