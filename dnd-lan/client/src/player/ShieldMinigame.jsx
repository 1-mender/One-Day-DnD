import React from 'react';
// 1. Импортируем правильное имя со скриншота
import { AVAILABLE_MINIGAMES } from '../dm/dmPlayersDomain'; 

export const MinigameWindow = ({ activeMinigameId }) => {
  // 2. Ищем игру по правильному свойству (game.key, как у вас на 15 строке)
  const gameInfo = AVAILABLE_MINIGAMES.find(game => game.key === activeMinigameId);

  if (!gameInfo) return null;

  return (
    <div className="minigame-overlay">
      <div className="minigame-header">
        <strong>{gameInfo.label} открыт мастером</strong>
      </div>
      
      <iframe 
        src={`/minigames/${gameInfo.folder}/index.html`} 
        title={gameInfo.label}
        style={{ width: '100%', height: '80vh', border: 'none' }}
      ></iframe>
    </div>
  );
};