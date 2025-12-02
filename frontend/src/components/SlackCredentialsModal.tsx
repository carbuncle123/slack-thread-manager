import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi } from '../lib/api';
import './SlackCredentialsModal.css';

interface SlackCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentXoxcToken?: string;
  currentCookie?: string;
}

export const SlackCredentialsModal: React.FC<SlackCredentialsModalProps> = ({
  isOpen,
  onClose,
  currentXoxcToken = '',
  currentCookie = '',
}) => {
  const [xoxcToken, setXoxcToken] = useState('');
  const [cookie, setCookie] = useState('');
  const [showTokens, setShowTokens] = useState(false);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // モーダルが開かれたときに現在の値をマスキング表示
  useEffect(() => {
    if (isOpen) {
      setXoxcToken('');
      setCookie('');
      setShowTokens(false);
      setError('');
    }
  }, [isOpen]);

  const updateCredentialsMutation = useMutation({
    mutationFn: ({ xoxcToken, cookie }: { xoxcToken: string; cookie: string }) =>
      configApi.updateSlackCredentials(xoxcToken, cookie),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      alert('Slack認証情報を更新しました。新しい認証情報で通信が可能になります。');
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || '更新に失敗しました');
    },
  });

  const handleSave = async () => {
    if (!xoxcToken.trim() || !cookie.trim()) {
      setError('xoxc_tokenとcookieの両方を入力してください');
      return;
    }

    // xoxc_tokenの基本的なバリデーション
    if (!xoxcToken.startsWith('xoxc-')) {
      setError('xoxc_tokenは"xoxc-"で始まる必要があります');
      return;
    }

    setError('');
    updateCredentialsMutation.mutate({ xoxcToken, cookie });
  };

  const maskString = (str: string, visibleChars: number = 4): string => {
    if (!str || str.length <= visibleChars) return str;
    return str.substring(0, visibleChars) + '*'.repeat(Math.min(str.length - visibleChars, 20));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Slack認証情報設定</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="credentials-info">
            <p>
              Slack APIとの通信に使用する認証情報を設定します。
              <br />
              設定後、即座に新しい認証情報で通信が行われます。
            </p>
          </div>

          {currentXoxcToken && (
            <div className="current-credentials">
              <h3>現在の設定</h3>
              <div className="credential-item">
                <label>xoxc_token:</label>
                <span className="masked-value">{maskString(currentXoxcToken)}</span>
              </div>
              <div className="credential-item">
                <label>cookie:</label>
                <span className="masked-value">{maskString(currentCookie)}</span>
              </div>
            </div>
          )}

          <div className="form-section">
            <h3>新しい認証情報</h3>

            <div className="form-group">
              <label htmlFor="xoxc-token">
                xoxc_token <span className="required">*</span>
              </label>
              <div className="input-with-toggle">
                <input
                  id="xoxc-token"
                  type={showTokens ? 'text' : 'password'}
                  value={xoxcToken}
                  onChange={(e) => setXoxcToken(e.target.value)}
                  placeholder="xoxc-から始まるトークンを入力"
                  className="input-field"
                />
              </div>
              <p className="help-text">
                Slackのブラウザ版でデベロッパーツールを開き、ネットワークタブから取得できます
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="cookie">
                cookie (d= パラメータ) <span className="required">*</span>
              </label>
              <div className="input-with-toggle">
                <input
                  id="cookie"
                  type={showTokens ? 'text' : 'password'}
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  placeholder="cookieのdパラメータの値を入力"
                  className="input-field"
                />
              </div>
              <p className="help-text">
                Slackのブラウザ版でCookieから"d="の値を取得してください
              </p>
            </div>

            <div className="show-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={showTokens}
                  onChange={(e) => setShowTokens(e.target.checked)}
                />
                <span>認証情報を表示</span>
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={updateCredentialsMutation.isPending}
            className="btn btn-primary"
          >
            {updateCredentialsMutation.isPending ? '保存中...' : '保存して適用'}
          </button>
        </div>
      </div>
    </div>
  );
};
