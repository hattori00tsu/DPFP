import { Post } from '@/types';
import { Card } from './ui/Card';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ExternalLink, Heart, Repeat, Eye } from 'lucide-react';

interface PostCardProps {
  post: Post;
}

const categoryColors = {
  policy: 'bg-blue-100 text-blue-700',
  event: 'bg-green-100 text-green-700',
  media: 'bg-purple-100 text-purple-700',
  sns: 'bg-pink-100 text-pink-700',
  parliament: 'bg-indigo-100 text-indigo-700',
};

const categoryLabels = {
  policy: '政策',
  event: 'イベント',
  media: 'メディア',
  sns: 'SNS',
  parliament: '国会',
};

const sourceTypeLabels = {
  party_hq: '党本部',
  politician: '議員',
  media: 'メディア',
  sns: 'SNS',
};

export function PostCard({ post }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.published_at), {
    addSuffix: true,
    locale: ja,
  });

  return (
    <Card className="p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${categoryColors[post.category]}`}>
            {categoryLabels[post.category]}
          </span>
          {post.tags.length > 0 && (
            <span className="text-xs text-gray-500">
              {post.tags.map((tag) => `#${tag}`).join(' ')}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{timeAgo}</span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {post.title}
      </h3>

      {post.content && (
        <p className="text-gray-600 mb-4 line-clamp-3">{post.content}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span className="font-medium">{sourceTypeLabels[post.source_type]}</span>
          {post.politician && (
            <span>{post.politician.name}</span>
          )}
          {post.region && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{post.region}</span>
          )}
        </div>

        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            <span>詳細を見る</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {(post.engagement.likes || post.engagement.retweets || post.engagement.views) && (
        <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          {post.engagement.likes && (
            <div className="flex items-center space-x-1">
              <Heart className="w-4 h-4" />
              <span>{post.engagement.likes.toLocaleString()}</span>
            </div>
          )}
          {post.engagement.retweets && (
            <div className="flex items-center space-x-1">
              <Repeat className="w-4 h-4" />
              <span>{post.engagement.retweets.toLocaleString()}</span>
            </div>
          )}
          {post.engagement.views && (
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{post.engagement.views.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
