import React from 'react';

/**
 * Slackのリンク記法 <URL|表示テキスト> をHTMLリンクに変換します
 */
export function formatSlackText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // <URL|表示テキスト> のパターンにマッチ
  const linkPattern = /<([^|>]+)\|([^>]+)>/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    const [fullMatch, url, displayText] = match;
    const matchIndex = match.index;

    // マッチ前のテキストを追加
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // リンクを追加
    parts.push(
      <a
        key={matchIndex}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="slack-link"
      >
        {displayText}
      </a>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  // 残りのテキストを追加
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
