import type { Collection, Tweet } from '@/types/database';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function generateCollectionMarkdown(collection: Collection, tweets: Tweet[]): string {
  const lines: string[] = [];

  lines.push(`# ${collection.name}`);
  lines.push(`Last updated: ${formatDate(collection.updated_at)} | ${tweets.length} tweets`);
  lines.push('');

  if (collection.ai_summary) {
    lines.push('## Summary');
    lines.push(collection.ai_summary);
    lines.push('');
  }

  if (collection.ai_conclusions && collection.ai_conclusions.length > 0) {
    lines.push('## Actionable Conclusions');
    for (const conclusion of collection.ai_conclusions) {
      lines.push(`- ${conclusion}`);
    }
    lines.push('');
  }

  if (collection.ai_key_people && collection.ai_key_people.length > 0) {
    lines.push('## Key People');
    for (const person of collection.ai_key_people as { handle: string; reason: string }[]) {
      lines.push(`- **@${person.handle}** — ${person.reason}`);
    }
    lines.push('');
  }

  if (tweets.length > 0) {
    lines.push('## Sources');
    for (const tweet of tweets) {
      const date = tweet.tweet_date ? formatDate(tweet.tweet_date) : 'Unknown date';
      lines.push(`### @${tweet.author_handle} — ${date}`);
      lines.push(`> ${tweet.content.split('\n').join('\n> ')}`);
      lines.push(`> URL: ${tweet.tweet_url}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
