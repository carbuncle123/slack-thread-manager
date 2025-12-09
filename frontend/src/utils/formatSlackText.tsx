import React from 'react';

/**
 * Slackのメンション記法とリンク記法を変換します
 * - <@U12345> → @ユーザー名
 * - <URL|表示テキスト> → HTMLリンク
 */
export function formatSlackText(
  text: string,
  userMappings?: Record<string, string>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentText = text;
  let keyCounter = 0;

  // パターンを定義（メンションとリンク）
  const patterns = [
    { regex: /<@([A-Z0-9]+)>/g, type: 'mention' },
    { regex: /<([^@|>]+)\|([^>]+)>/g, type: 'link' },
  ];

  // すべてのマッチを収集
  interface Match {
    index: number;
    length: number;
    type: 'mention' | 'link';
    userId?: string;
    url?: string;
    displayText?: string;
  }

  const matches: Match[] = [];

  // メンションパターン
  const mentionPattern = /<@([A-Z0-9]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(currentText)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'mention',
      userId: match[1],
    });
  }

  // リンクパターン
  const linkPattern = /<([^@|>]+)\|([^>]+)>/g;
  while ((match = linkPattern.exec(currentText)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'link',
      url: match[1],
      displayText: match[2],
    });
  }

  // インデックスでソート
  matches.sort((a, b) => a.index - b.index);

  // テキストを組み立て
  let lastIndex = 0;

  for (const m of matches) {
    // マッチ前のテキストを追加
    if (m.index > lastIndex) {
      parts.push(currentText.substring(lastIndex, m.index));
    }

    // マッチした要素を追加
    if (m.type === 'mention' && m.userId) {
      const displayName = userMappings?.[m.userId] || m.userId;
      parts.push(
        <span key={`mention-${keyCounter++}`} className="slack-mention">
          @{displayName}
        </span>
      );
    } else if (m.type === 'link' && m.url && m.displayText) {
      parts.push(
        <a
          key={`link-${keyCounter++}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="slack-link"
        >
          {m.displayText}
        </a>
      );
    }

    lastIndex = m.index + m.length;
  }

  // 残りのテキストを追加
  if (lastIndex < currentText.length) {
    parts.push(currentText.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
