import React from 'react';

/**
 * HTMLエスケープされた文字を元に戻す
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&gt;': '>',
    '&lt;': '<',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&(gt|lt|amp|quot|#39|apos|nbsp);/g, (match) => {
    return entities[match] || match;
  });
}

/**
 * 行が引用かどうかを判定
 */
export function isQuoteLine(text: string): boolean {
  // HTMLエスケープされた状態でも、デコード済みでも対応
  return text.startsWith('>') || text.startsWith('&gt;');
}

/**
 * 引用行からプレフィックスを取り除く
 */
function stripQuotePrefix(text: string): string {
  if (text.startsWith('&gt;')) {
    return text.slice(4).trim();
  }
  if (text.startsWith('>')) {
    return text.slice(1).trim();
  }
  return text;
}

/**
 * Slackのメンション記法とリンク記法を変換します
 * - <@U12345> → @ユーザー名
 * - <URL|表示テキスト> → HTMLリンク
 * - プレーンなURI → リンク
 * - HTMLエスケープ文字 → 元の文字
 */
export function formatSlackText(
  text: string,
  userMappings?: Record<string, string>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // まずHTMLエスケープを解除（引用判定用に元テキストは保持）
  let currentText = decodeHtmlEntities(text);
  let keyCounter = 0;

  // すべてのマッチを収集
  interface Match {
    index: number;
    length: number;
    type: 'mention' | 'link' | 'plainUrl';
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

  // Slack形式リンクパターン <URL|表示テキスト>
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

  // Slack形式リンクパターン <URL>（表示テキストなし）
  const simpleLinkPattern = /<(https?:\/\/[^|>]+)>/g;
  while ((match = simpleLinkPattern.exec(currentText)) !== null) {
    // すでにマッチしていないか確認
    const alreadyMatched = matches.some(
      m => m.index <= match!.index && match!.index < m.index + m.length
    );
    if (!alreadyMatched) {
      matches.push({
        index: match.index,
        length: match[0].length,
        type: 'link',
        url: match[1],
        displayText: match[1],
      });
    }
  }

  // プレーンURL（<>で囲まれていないURL）
  const plainUrlPattern = /(?<![<])(https?:\/\/[^\s<>]+)/g;
  while ((match = plainUrlPattern.exec(currentText)) !== null) {
    // すでにマッチしていないか確認（Slackリンク形式の中にあるURLを除外）
    const alreadyMatched = matches.some(
      m => (m.index <= match!.index && match!.index < m.index + m.length) ||
           (match!.index <= m.index && m.index < match!.index + match![0].length)
    );
    if (!alreadyMatched) {
      matches.push({
        index: match.index,
        length: match[0].length,
        type: 'plainUrl',
        url: match[1],
      });
    }
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
    } else if ((m.type === 'link' || m.type === 'plainUrl') && m.url) {
      parts.push(
        <a
          key={`link-${keyCounter++}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="slack-link"
        >
          {m.displayText || m.url}
        </a>
      );
    }

    lastIndex = m.index + m.length;
  }

  // 残りのテキストを追加
  if (lastIndex < currentText.length) {
    parts.push(currentText.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [currentText];
}

/**
 * メッセージの行をフォーマットする（引用を含む）
 * ThreadDetailPageで使用
 */
export function formatSlackLine(
  line: string,
  userMappings?: Record<string, string>,
  keyPrefix?: string
): React.ReactNode {
  // 引用行かどうかを判定（HTMLエスケープ解除前）
  if (isQuoteLine(line)) {
    const quotedText = stripQuotePrefix(decodeHtmlEntities(line));
    return (
      <blockquote key={keyPrefix} className="slack-quote">
        {formatSlackText(quotedText, userMappings)}
      </blockquote>
    );
  }

  // 通常の行
  const formatted = formatSlackText(line, userMappings);
  return <>{formatted}</>;
}
