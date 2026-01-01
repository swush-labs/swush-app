/**
 * Simple account avatar component
 *
 * Replaces @polkadot/react-identicon to avoid WASM memory allocation issues.
 * Uses a deterministic gradient based on the account address.
 */

interface AccountAvatarProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Generate a deterministic color from a string (address)
 */
function stringToColor(str: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = hash % 360;
  const hue2 = (hash + 137) % 360; // Golden angle for nice color pairing

  return {
    from: `hsl(${hue1}, 70%, 60%)`,
    to: `hsl(${hue2}, 70%, 50%)`,
  };
}

/**
 * Get initials from address (first 2 characters after 0x if present)
 */
function getInitials(address: string): string {
  const cleaned = address.replace(/^0x/, '');
  return cleaned.slice(0, 2).toUpperCase();
}

export default function AccountAvatar({ value, size = 40, className = '' }: AccountAvatarProps) {
  const colors = stringToColor(value);
  const initials = getInitials(value);

  return (
    <div
      className={`flex items-center justify-center rounded-full font-mono font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
