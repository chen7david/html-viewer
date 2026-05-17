import { Rate } from 'antd';
import { MEDIA_RATING_MAX } from '../../utils/mediaRating';

interface MediaStarRatingProps {
  value?: number;
  onChange: (rating: number | undefined) => void;
  disabled?: boolean;
  size?: 'small' | 'default';
  className?: string;
}

export default function MediaStarRating({
  value,
  onChange,
  disabled = false,
  size = 'small',
  className = '',
}: MediaStarRatingProps) {
  return (
    <span className={className} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Rate
        count={MEDIA_RATING_MAX}
        value={value ?? 0}
        disabled={disabled}
        allowClear
        style={size === 'small' ? { fontSize: 14 } : { fontSize: 20 }}
        onChange={(stars) => onChange(stars > 0 ? stars : undefined)}
      />
    </span>
  );
}
