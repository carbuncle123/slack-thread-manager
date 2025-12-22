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
 * テキスト装飾（太字、イタリック、打ち消し線、コード）を適用
 */
function applyTextFormatting(text: string, keyCounter: { value: number }): React.ReactNode[] {
  const results: React.ReactNode[] = [];

  // すべての装飾パターンを収集
  interface FormatMatch {
    index: number;
    length: number;
    type: 'bold' | 'italic' | 'strike' | 'code';
    content: string;
  }

  const formatMatches: FormatMatch[] = [];

  // 太字 *text*（単語境界を考慮）
  const boldPattern = /(?<![*\w])\*([^*\n]+)\*(?![*\w])/g;
  let match: RegExpExecArray | null;
  while ((match = boldPattern.exec(text)) !== null) {
    formatMatches.push({
      index: match.index,
      length: match[0].length,
      type: 'bold',
      content: match[1],
    });
  }

  // イタリック _text_（単語境界を考慮）
  const italicPattern = /(?<![_\w])_([^_\n]+)_(?![_\w])/g;
  while ((match = italicPattern.exec(text)) !== null) {
    // 既にマッチしていないか確認
    const alreadyMatched = formatMatches.some(
      m => (m.index <= match!.index && match!.index < m.index + m.length)
    );
    if (!alreadyMatched) {
      formatMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'italic',
        content: match[1],
      });
    }
  }

  // 打ち消し線 ~text~
  const strikePattern = /(?<![~\w])~([^~\n]+)~(?![~\w])/g;
  while ((match = strikePattern.exec(text)) !== null) {
    const alreadyMatched = formatMatches.some(
      m => (m.index <= match!.index && match!.index < m.index + m.length)
    );
    if (!alreadyMatched) {
      formatMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'strike',
        content: match[1],
      });
    }
  }

  // インラインコード `text`
  const codePattern = /`([^`\n]+)`/g;
  while ((match = codePattern.exec(text)) !== null) {
    const alreadyMatched = formatMatches.some(
      m => (m.index <= match!.index && match!.index < m.index + m.length)
    );
    if (!alreadyMatched) {
      formatMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'code',
        content: match[1],
      });
    }
  }

  // インデックスでソート
  formatMatches.sort((a, b) => a.index - b.index);

  // マッチがなければ元のテキストを返す
  if (formatMatches.length === 0) {
    return [text];
  }

  // テキストを組み立て
  let lastIndex = 0;

  for (const m of formatMatches) {
    // マッチ前のテキストを追加
    if (m.index > lastIndex) {
      results.push(text.substring(lastIndex, m.index));
    }

    // 装飾要素を追加
    const key = `format-${keyCounter.value++}`;
    switch (m.type) {
      case 'bold':
        results.push(<strong key={key} className="slack-bold">{m.content}</strong>);
        break;
      case 'italic':
        results.push(<em key={key} className="slack-italic">{m.content}</em>);
        break;
      case 'strike':
        results.push(<del key={key} className="slack-strike">{m.content}</del>);
        break;
      case 'code':
        results.push(<code key={key} className="slack-code">{m.content}</code>);
        break;
    }

    lastIndex = m.index + m.length;
  }

  // 残りのテキストを追加
  if (lastIndex < text.length) {
    results.push(text.substring(lastIndex));
  }

  return results;
}

/**
 * Slackのメンション記法とリンク記法を変換します
 * - <@U12345> → @ユーザー名
 * - <URL|表示テキスト> → HTMLリンク
 * - プレーンなURI → リンク
 * - HTMLエスケープ文字 → 元の文字
 * - *太字*, _イタリック_, ~打ち消し線~, `コード`
 */
export function formatSlackText(
  text: string,
  userMappings?: Record<string, string>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // まずHTMLエスケープを解除（引用判定用に元テキストは保持）
  const currentText = decodeHtmlEntities(text);
  const keyCounter = { value: 0 };

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
    // マッチ前のテキストを追加（テキスト装飾を適用）
    if (m.index > lastIndex) {
      const textBefore = currentText.substring(lastIndex, m.index);
      parts.push(...applyTextFormatting(textBefore, keyCounter));
    }

    // マッチした要素を追加
    if (m.type === 'mention' && m.userId) {
      const displayName = userMappings?.[m.userId] || m.userId;
      parts.push(
        <span key={`mention-${keyCounter.value++}`} className="slack-mention">
          @{displayName}
        </span>
      );
    } else if ((m.type === 'link' || m.type === 'plainUrl') && m.url) {
      parts.push(
        <a
          key={`link-${keyCounter.value++}`}
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

  // 残りのテキストを追加（テキスト装飾を適用）
  if (lastIndex < currentText.length) {
    const textAfter = currentText.substring(lastIndex);
    parts.push(...applyTextFormatting(textAfter, keyCounter));
  }

  // マッチがなかった場合もテキスト装飾を適用
  if (matches.length === 0) {
    return applyTextFormatting(currentText, keyCounter);
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

/**
 * コードブロックを含むメッセージ全体をフォーマット
 * ```で囲まれたコードブロックを検出して処理
 */
export function formatSlackMessage(
  text: string,
  userMappings?: Record<string, string>
): React.ReactNode[] {
  const results: React.ReactNode[] = [];
  let keyCounter = 0;

  // HTMLエスケープを解除
  const decodedText = decodeHtmlEntities(text);

  // コードブロックパターン ```code``` （複数行対応）
  const codeBlockPattern = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockPattern.exec(decodedText)) !== null) {
    // コードブロック前のテキストを処理
    if (match.index > lastIndex) {
      const beforeText = decodedText.substring(lastIndex, match.index);
      results.push(...formatTextWithLines(beforeText, userMappings, keyCounter));
      keyCounter += 100; // キーの衝突を避けるため
    }

    // コードブロックを追加
    const codeContent = match[1];
    results.push(
      <pre key={`codeblock-${keyCounter++}`} className="slack-codeblock">
        <code>{codeContent}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  // 残りのテキストを処理
  if (lastIndex < decodedText.length) {
    const afterText = decodedText.substring(lastIndex);
    results.push(...formatTextWithLines(afterText, userMappings, keyCounter));
  }

  // コードブロックがなかった場合
  if (results.length === 0) {
    return formatTextWithLines(decodedText, userMappings, 0);
  }

  return results;
}

/**
 * テキストを行ごとに分割してフォーマット（引用対応）
 */
function formatTextWithLines(
  text: string,
  userMappings?: Record<string, string>,
  startKey: number = 0
): React.ReactNode[] {
  const results: React.ReactNode[] = [];
  const lines = text.split('\n');
  let keyCounter = startKey;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isQuoteLine(line)) {
      const quotedText = stripQuotePrefix(line);
      results.push(
        <p key={`line-${keyCounter++}`}>
          <blockquote className="slack-quote">
            {formatSlackText(quotedText, userMappings)}
          </blockquote>
        </p>
      );
    } else if (line) {
      results.push(
        <p key={`line-${keyCounter++}`}>
          {formatSlackText(line, userMappings)}
        </p>
      );
    } else {
      // 空行
      results.push(<p key={`line-${keyCounter++}`}>{'\u00A0'}</p>);
    }
  }

  return results;
}
