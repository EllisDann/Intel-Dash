import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';

const OAuthCallbackPage = () => {
  const { type } = useParams();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Processing connection...');
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!type || !code || !state) {
      setMessage('Missing OAuth callback parameters.');
      return;
    }

    const completeConnection = async () => {
      try {
        await api.get(`/api/integrations/${type}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
        setMessage('Integration connected successfully. Redirecting...');
        setTimeout(() => navigate('/integrations'), 1500);
      } catch (error: any) {
        setMessage(error.response?.data?.error || 'Unable to complete the OAuth callback.');
      }
    };

    completeConnection();
  }, [type, searchParams, navigate]);

  return (
    <div className="page-shell">
      <div className="auth-card">
        <h1>OAuth callback</h1>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
