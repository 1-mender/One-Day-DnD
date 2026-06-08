import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { AVAILABLE_MINIGAMES } from '../dm/dmPlayersDomain.js';
import { api } from '../api.js';

export default function ShieldMinigame() {
  const { activeLiveActivity } = useOutletContext();
  const activeMinigameId = activeLiveActivity?.kind;

  const gameInfo = AVAILABLE_MINIGAMES.find(game => game.key === activeMinigameId);

  // Если игра не найдена, не пытаемся рендерить пустой экран
  if (!gameInfo) return null;

  const handlePlayerClose = async () => {
    try {
      if (api && api.playerCloseLiveActivity) {
        await api.playerCloseLiveActivity();
      }
    } catch (err) {
      console.error("Ошибка закрытия:", err);
    }
  };

  return (
    <div 
      className="minigame-fullscreen-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div 
        className="minigame-header" 
        style={{ 
          padding: '12px', 
          textAlign: 'center', 
          backgroundColor: '#111', 
          color: '#aaa',
          fontSize: '1em',
          borderBottom: '1px solid #333',
          position: 'relative'
        }}
      >
        <span>{gameInfo.label} открыт мастером</span>

        <button
          onClick={handlePlayerClose}
          style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#d9534f',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9em'
          }}
        >
          ✕ Закрыть
        </button>
      </div>
      
      <iframe 
        src={`/minigames/${gameInfo.folder}/index.html`} 
        title={gameInfo.label}
        style={{ 
          flex: 1, 
          width: '100%',
          border: 'none', 
          background: '#000',
          display: 'block'
        }}
      ></iframe>
    </div>
  );
}